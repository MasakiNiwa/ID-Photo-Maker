import type { Adjustments } from '@/domain/edit';

/**
 * 色調整を 4×5 のカラーマトリクス（SVG feColorMatrix と同じ形式、オフセットは 0〜1）に変換する。
 * プレビュー（SVGフィルタ / GPU）と出力（Worker の画素処理）で同じ行列を使うので、見た目が一致する。
 */
export type ColorMatrix = number[]; // 20要素

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** a ∘ b（先に b を適用してから a） */
function multiply(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Array<number>(20).fill(0);
  const at = (m: ColorMatrix, r: number, c: number) => m[r * 5 + c] ?? 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += at(a, r, k) * at(b, k, c);
      if (c === 4) v += at(a, r, 4);
      out[r * 5 + c] = v;
    }
  }
  return out;
}

function brightness(b: number): ColorMatrix {
  return [b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
}

function contrast(c: number): ColorMatrix {
  const o = 0.5 - 0.5 * c;
  return [c, 0, 0, 0, o, 0, c, 0, 0, o, 0, 0, c, 0, o, 0, 0, 0, 1, 0];
}

function saturate(s: number): ColorMatrix {
  // W3C Filter Effects の saturate 行列
  return [
    0.213 + 0.787 * s,
    0.715 - 0.715 * s,
    0.072 - 0.072 * s,
    0,
    0,
    0.213 - 0.213 * s,
    0.715 + 0.285 * s,
    0.072 - 0.072 * s,
    0,
    0,
    0.213 - 0.213 * s,
    0.715 - 0.715 * s,
    0.072 + 0.928 * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

function warmth(w: number): ColorMatrix {
  const k = 0.12 * w;
  return [1 + k, 0, 0, 0, 0, 0, 1 + k * 0.25, 0, 0, 0, 0, 0, 1 - k, 0, 0, 0, 0, 0, 1, 0];
}

export function adjustmentsToMatrix(a: Adjustments): ColorMatrix {
  let m = IDENTITY;
  m = multiply(brightness(a.brightness), m);
  m = multiply(contrast(a.contrast), m);
  m = multiply(saturate(a.saturation), m);
  m = multiply(warmth(a.warmth), m);
  return m;
}

export function isIdentity(m: ColorMatrix): boolean {
  return m.every((v, i) => Math.abs(v - (IDENTITY[i] ?? 0)) < 1e-6);
}

/** RGBA 画素列に行列を適用する（Worker 内で使用） */
export function applyMatrix(data: Uint8ClampedArray, m: ColorMatrix): void {
  const [
    r0 = 0,
    r1 = 0,
    r2 = 0,
    ,
    r4 = 0,
    g0 = 0,
    g1 = 0,
    g2 = 0,
    ,
    g4 = 0,
    b0 = 0,
    b1 = 0,
    b2 = 0,
    ,
    b4 = 0,
  ] = m;
  const ro = r4 * 255;
  const go = g4 * 255;
  const bo = b4 * 255;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    data[i] = r0 * r + r1 * g + r2 * b + ro;
    data[i + 1] = g0 * r + g1 * g + g2 * b + go;
    data[i + 2] = b0 * r + b1 * g + b2 * b + bo;
  }
}
