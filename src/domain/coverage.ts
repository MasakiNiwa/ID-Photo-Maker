import type { CropState } from './edit';
import type { PhotoSpec } from './specs';

/** 端をのばして補う量（元画像の長辺に対する比率、各辺） */
export const EXTEND_PAD = 0.5;

/** 元画像の幅・高さに対する、各辺ののばし量の比率 */
export function extendFractions(width: number, height: number): { fx: number; fy: number } {
  const p = EXTEND_PAD * Math.max(width, height);
  return { fx: p / width, fy: p / height };
}

export interface Coverage {
  covered: boolean;
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * 写真の枠が元画像で覆われているか（覆われていない辺はどこか）。
 * 枠の四隅を画像座標に戻して、画像の範囲内かを調べる。
 */
export function frameCoverage(
  crop: CropState,
  image: { width: number; height: number },
  spec: Pick<PhotoSpec, 'widthMm' | 'heightMm'>,
): Coverage {
  const aspect = spec.widthMm / spec.heightMm;
  const t = (-crop.rotation * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const halfW = image.width / image.height / 2;
  const tol = 1e-3;
  const res: Coverage = { covered: true, top: false, bottom: false, left: false, right: false };
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const fx = (sx * aspect) / 2 - crop.x;
    const fy = sy / 2 - crop.y;
    // 逆回転 → 逆スケール → 逆反転
    let ux = (fx * cos - fy * sin) / crop.scale;
    const uy = (fx * sin + fy * cos) / crop.scale;
    if (crop.flipH) ux = -ux;
    const out = Math.abs(ux) > halfW + tol || Math.abs(uy) > 0.5 + tol;
    if (out) {
      res.covered = false;
      if (sy < 0) res.top ||= uy < -0.5 - tol || Math.abs(ux) > halfW + tol;
      if (sy > 0) res.bottom ||= uy > 0.5 + tol || Math.abs(ux) > halfW + tol;
      if (sx < 0) res.left ||= Math.abs(ux) > halfW + tol;
      if (sx > 0) res.right ||= Math.abs(ux) > halfW + tol;
    }
  }
  return res;
}
