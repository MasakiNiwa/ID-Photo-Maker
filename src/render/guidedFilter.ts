/**
 * カラーガイデッドフィルタ（He et al., "Guided Image Filtering"）。
 * 粗い人物マスクを、元画像の色の境界に沿うように整える（髪の毛などの細かい境界の精度を上げる）。
 * すべて 0〜1 の Float32Array で計算する。
 */

/** 半径 r の平均フィルタ（分離型・累積和で O(N)、端は実際の画素数で割る） */
export function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x] ?? 0;
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      tmp[row + x] = sum / (hi - lo + 1);
      const add = x + r + 1;
      const sub = x - r;
      if (add < w) sum += src[row + add] ?? 0;
      if (sub >= 0) sum -= src[row + sub] ?? 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += tmp[y * w + x] ?? 0;
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      out[y * w + x] = sum / (hi - lo + 1);
      const add = y + r + 1;
      const sub = y - r;
      if (add < h) sum += tmp[add * w + x] ?? 0;
      if (sub >= 0) sum -= tmp[sub * w + x] ?? 0;
    }
  }
  return out;
}

function mul(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = (a[i] ?? 0) * (b[i] ?? 0);
  return o;
}

export interface ColorGuide {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
}

export function guidedFilter(
  I: ColorGuide,
  p: Float32Array,
  w: number,
  h: number,
  radius: number,
  eps: number,
): Float32Array {
  const box = (a: Float32Array) => boxFilter(a, w, h, radius);
  const mR = box(I.r);
  const mG = box(I.g);
  const mB = box(I.b);
  const mP = box(p);
  const mRP = box(mul(I.r, p));
  const mGP = box(mul(I.g, p));
  const mBP = box(mul(I.b, p));
  const vRR = box(mul(I.r, I.r));
  const vRG = box(mul(I.r, I.g));
  const vRB = box(mul(I.r, I.b));
  const vGG = box(mul(I.g, I.g));
  const vGB = box(mul(I.g, I.b));
  const vBB = box(mul(I.b, I.b));

  const n = w * h;
  const aR = new Float32Array(n);
  const aG = new Float32Array(n);
  const aB = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const mr = mR[i] ?? 0;
    const mg = mG[i] ?? 0;
    const mb = mB[i] ?? 0;
    const mp = mP[i] ?? 0;
    const cr = (mRP[i] ?? 0) - mr * mp;
    const cg = (mGP[i] ?? 0) - mg * mp;
    const cb = (mBP[i] ?? 0) - mb * mp;
    // 共分散行列 Σ + εU（対称）
    const s00 = (vRR[i] ?? 0) - mr * mr + eps;
    const s01 = (vRG[i] ?? 0) - mr * mg;
    const s02 = (vRB[i] ?? 0) - mr * mb;
    const s11 = (vGG[i] ?? 0) - mg * mg + eps;
    const s12 = (vGB[i] ?? 0) - mg * mb;
    const s22 = (vBB[i] ?? 0) - mb * mb + eps;
    // 3×3 対称行列の逆行列（余因子）
    const i00 = s11 * s22 - s12 * s12;
    const i01 = s02 * s12 - s01 * s22;
    const i02 = s01 * s12 - s02 * s11;
    const i11 = s00 * s22 - s02 * s02;
    const i12 = s01 * s02 - s00 * s12;
    const i22 = s00 * s11 - s01 * s01;
    const det = s00 * i00 + s01 * i01 + s02 * i02;
    const inv = det !== 0 ? 1 / det : 0;
    const ar = (i00 * cr + i01 * cg + i02 * cb) * inv;
    const ag = (i01 * cr + i11 * cg + i12 * cb) * inv;
    const ab = (i02 * cr + i12 * cg + i22 * cb) * inv;
    aR[i] = ar;
    aG[i] = ag;
    aB[i] = ab;
    b[i] = mp - ar * mr - ag * mg - ab * mb;
  }
  const maR = box(aR);
  const maG = box(aG);
  const maB = box(aB);
  const mb2 = box(b);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v =
      (maR[i] ?? 0) * (I.r[i] ?? 0) +
      (maG[i] ?? 0) * (I.g[i] ?? 0) +
      (maB[i] ?? 0) * (I.b[i] ?? 0) +
      (mb2[i] ?? 0);
    q[i] = v < 0 ? 0 : Math.min(v, 1);
  }
  return q;
}
