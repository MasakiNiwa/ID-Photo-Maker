/** 人物マスクの低解像度データから、なめらかな境界のアルファマスクを作る */
export interface MaskInput {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface MaskParams {
  /** 境界の位置 0〜1（大きいほど人物を小さく切り抜く） */
  threshold: number;
  /** 境界のぼかし幅 0〜0.5 */
  softness: number;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 0〜255 の値 → 0〜255 のアルファ（ルックアップテーブル） */
export function alphaLut({ threshold, softness }: MaskParams): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const s = Math.max(0.01, softness);
  for (let v = 0; v < 256; v++) lut[v] = Math.round(smoothstep(threshold - s, threshold + s, v / 255) * 255);
  return lut;
}

/**
 * 低解像度マスクを軽くぼかす（分離型ボックスブラー）。
 * 拡大後の境界が階段状になるのを防ぐ。
 */
export function blurMask(m: MaskInput, radius = 1, passes = 2): Uint8Array {
  const { width: w, height: h } = m;
  const src = Float32Array.from(m.data);
  const tmp = new Float32Array(src.length);
  const n = radius * 2 + 1;
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))] ?? 0;
        tmp[y * w + x] = s / n;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x] ?? 0;
        src[y * w + x] = s / n;
      }
    }
  }
  return Uint8Array.from(src, (v) => Math.round(v));
}

/** 指定サイズのアルファマスクを OffscreenCanvas に描く（RGB は白） */
export function buildMaskCanvas(m: MaskInput, p: MaskParams, outW: number, outH: number): OffscreenCanvas {
  const src = new OffscreenCanvas(m.width, m.height);
  const sc = src.getContext('2d');
  const out = new OffscreenCanvas(outW, outH);
  const oc = out.getContext('2d', { willReadFrequently: true });
  if (!sc || !oc) throw new Error('Canvas 2D が使用できません');
  const img = sc.createImageData(m.width, m.height);
  const data = blurMask(m);
  for (let i = 0; i < data.length; i++) {
    const j = i * 4;
    img.data[j] = 255;
    img.data[j + 1] = 255;
    img.data[j + 2] = 255;
    img.data[j + 3] = data[i] ?? 0;
  }
  sc.putImageData(img, 0, 0);
  // なめらかに拡大してから境界を整える（拡大前にしきい値処理するとギザギザになる）
  oc.imageSmoothingEnabled = true;
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(src, 0, 0, outW, outH);
  const d = oc.getImageData(0, 0, outW, outH);
  const lut = alphaLut(p);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = lut[d.data[i] ?? 0] ?? 0;
  oc.putImageData(d, 0, 0);
  return out;
}

/**
 * マスクの外周を端の値で延長する（写真の端をのばして補うときに使う）。
 * 戻り値の fx / fy は、元のマスク幅・高さに対する実際ののばし量の比率。
 */
export function padMask(
  m: MaskInput,
  fx: number,
  fy: number,
  /** 上側は背景（0）として延長する（頭の上に髪がのびないように） */
  topAsBackground = true,
): { mask: MaskInput; fx: number; fy: number } {
  const px = Math.round(fx * m.width);
  const py = Math.round(fy * m.height);
  const w = m.width + px * 2;
  const h = m.height + py * 2;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(m.height - 1, Math.max(0, y - py));
    if (topAsBackground && y < py) continue;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(m.width - 1, Math.max(0, x - px));
      data[y * w + x] = m.data[sy * m.width + sx] ?? 0;
    }
  }
  return { mask: { width: w, height: h, data }, fx: px / m.width, fy: py / m.height };
}
