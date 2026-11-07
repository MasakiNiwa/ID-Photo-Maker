import type { CropState } from '@/domain/edit';
import type { PhotoSpec } from '@/domain/specs';
import { COLOR_FILTER_ID } from './ColorFilter';
import { type DisplayImage, maskStyle } from './useMaskUrl';

/** 構図の縮小プレビュー（Cropper と同じ座標系を CSS で再現） */
export function PhotoThumb({
  display,
  imageAspect,
  spec,
  crop,
  background,
  height = 64,
  maskUrl = null,
}: {
  display: DisplayImage | null;
  imageAspect: number;
  spec: PhotoSpec;
  crop: CropState | undefined;
  background: string;
  height?: number;
  maskUrl?: string | null;
}) {
  const w = (height * spec.widthMm) / spec.heightMm;
  return (
    <div className="thumb" style={{ width: w, height, background }}>
      {display && crop && (
        <img
          src={display.url}
          alt=""
          style={{
            width: crop.scale * height * imageAspect * (1 + 2 * display.fx),
            height: crop.scale * height * (1 + 2 * display.fy),
            filter: `url(#${COLOR_FILTER_ID})`,
            ...maskStyle(maskUrl),
            transform: `translate(-50%, -50%) translate(${crop.x * height}px, ${crop.y * height}px) rotate(${crop.rotation}deg) scaleX(${crop.flipH ? -1 : 1})`,
          }}
        />
      )}
    </div>
  );
}
