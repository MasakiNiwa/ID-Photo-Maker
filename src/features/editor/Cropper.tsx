import { type KeyboardEvent, type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CropState } from '@/domain/edit';
import type { PhotoSpec } from '@/domain/specs';
import { clamp } from '@/domain/units';
import { COLOR_FILTER_ID } from './ColorFilter';

export const SCALE_MIN = 0.2;
export const SCALE_MAX = 8;

interface Props {
  imageUrl: string;
  imageAspect: number;
  spec: PhotoSpec;
  crop: CropState;
  background: string;
  showGuides: boolean;
  onChange: (patch: Partial<CropState>) => void;
}

interface Pt {
  x: number;
  y: number;
}

/** 枠中心を原点、枠の高さを1とした座標で、点 p を中心に k 倍ズームしたときの新しい構図 */
export function zoomAt(crop: CropState, k: number, p: Pt): Partial<CropState> {
  const next = clamp(crop.scale * k, SCALE_MIN, SCALE_MAX);
  const kk = next / crop.scale;
  return { scale: next, x: p.x + (crop.x - p.x) * kk, y: p.y + (crop.y - p.y) * kk };
}

/**
 * 写真の位置合わせ。ドラッグで移動、ピンチ/ホイールで拡大縮小、矢印キーでも操作できる。
 * 描画は CSS transform のみ（GPU合成）で、実際の切り抜きは出力時に Worker で行う。
 */
export function Cropper({ imageUrl, imageAspect, spec, crop, background, showGuides, onChange }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pointers = useRef(new Map<number, Pt>());
  const cropRef = useRef(crop);
  cropRef.current = crop;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const aspect = spec.widthMm / spec.heightMm;
  const frameH = Math.max(1, Math.min(size.h * 0.84, (size.w * 0.84) / aspect));
  const frameW = frameH * aspect;

  /** クライアント座標 → 枠座標 */
  const toFrame = (cx: number, cy: number): Pt => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - r.width / 2) / frameH, y: (cy - r.top - r.height / 2) / frameH };
  };

  // ホイールは passive: false にしないとページがスクロールしてしまう
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      const r = el.getBoundingClientRect();
      const fh = Math.min(r.height * 0.84, (r.width * 0.84) / aspect);
      onChange(
        zoomAt(cropRef.current, k, {
          x: (e.clientX - r.left - r.width / 2) / fh,
          y: (e.clientY - r.top - r.height / 2) / fh,
        }),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [aspect, onChange]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (map.size === 1) {
      onChange({
        x: cropRef.current.x + (cur.x - prev.x) / frameH,
        y: cropRef.current.y + (cur.y - prev.y) / frameH,
      });
    } else if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
        const mid0 = toFrame((prev.x + other.x) / 2, (prev.y + other.y) / 2);
        const mid1 = toFrame((cur.x + other.x) / 2, (cur.y + other.y) / 2);
        const z = zoomAt(cropRef.current, d0 > 0 ? d1 / d0 : 1, mid0);
        onChange({ ...z, x: (z.x ?? 0) + mid1.x - mid0.x, y: (z.y ?? 0) + mid1.y - mid0.y });
      }
    }
    map.set(e.pointerId, cur);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.02 : 0.004;
    const c = cropRef.current;
    const map: Record<string, Partial<CropState>> = {
      ArrowLeft: { x: c.x - step },
      ArrowRight: { x: c.x + step },
      ArrowUp: { y: c.y - step },
      ArrowDown: { y: c.y + step },
    };
    const patch = map[e.key];
    if (patch) {
      e.preventDefault();
      onChange(patch);
    } else if (e.key === '+' || e.key === '=') {
      onChange(zoomAt(c, 1.03, { x: 0, y: 0 }));
    } else if (e.key === '-') {
      onChange(zoomAt(c, 1 / 1.03, { x: 0, y: 0 }));
    }
  };

  const imgH = crop.scale * frameH;
  const imgW = imgH * imageAspect;
  const g = spec.guide;
  const pct = (mm: number) => `${(mm / spec.heightMm) * 100}%`;
  const topMid = g ? (g.topMarginMm[0] + g.topMarginMm[1]) / 2 : 0;

  return (
    <div
      ref={stageRef}
      className="cropper"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: キーボードでも位置合わせできるようにする
      tabIndex={0}
      role="application"
      aria-label="写真の位置合わせ。ドラッグで移動、ピンチまたはホイールで拡大縮小、矢印キーで微調整"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {size.w > 0 && (
        <>
          <div className="cropper-bg" style={{ width: frameW, height: frameH, background }} />
          <img
            className="cropper-img"
            src={imageUrl}
            alt=""
            draggable={false}
            style={{
              width: imgW,
              height: imgH,
              filter: `url(#${COLOR_FILTER_ID})`,
              transform: `translate(-50%, -50%) translate(${crop.x * frameH}px, ${crop.y * frameH}px) rotate(${crop.rotation}deg) scaleX(${crop.flipH ? -1 : 1})`,
            }}
          />
          <div className="cropper-frame" style={{ width: frameW, height: frameH }}>
            {showGuides && (
              <>
                <div className="guide-center" />
                {g && (
                  <>
                    <div
                      className="guide-band"
                      style={{ top: pct(g.topMarginMm[0]), height: pct(g.topMarginMm[1] - g.topMarginMm[0]) }}
                    >
                      <span>頭頂</span>
                    </div>
                    <div
                      className="guide-band"
                      style={{
                        top: pct(topMid + g.headHeightMm[0]),
                        height: pct(g.headHeightMm[1] - g.headHeightMm[0]),
                      }}
                    >
                      <span>あご</span>
                    </div>
                  </>
                )}
              </>
            )}
            <span className="cropper-size">
              {spec.widthMm}×{spec.heightMm}mm
            </span>
          </div>
        </>
      )}
    </div>
  );
}
