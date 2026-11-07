import { guidedFilter } from './guidedFilter';
import { blurMask, type MaskInput } from './mask';

/**
 * AI の粗い人物マスク（256px 程度）を、元画像の色の境界に沿って精密にする。
 * 作業解像度（長辺 maxSide px）でガイデッドフィルタをかけ、0〜255 のマスクとして返す。
 */
export function refineMask(img: ImageBitmap, m: MaskInput, maxSide = 1024): MaskInput {
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));

  // 粗いマスクをなめらかに拡大
  const small = new OffscreenCanvas(m.width, m.height);
  const sc = small.getContext('2d');
  const big = new OffscreenCanvas(w, h);
  const bc = big.getContext('2d', { willReadFrequently: true });
  if (!sc || !bc) throw new Error('Canvas 2D が使用できません');
  const md = sc.createImageData(m.width, m.height);
  const blurred = blurMask(m);
  for (let i = 0; i < blurred.length; i++) {
    md.data[i * 4 + 3] = blurred[i] ?? 0;
  }
  sc.putImageData(md, 0, 0);
  bc.imageSmoothingEnabled = true;
  bc.imageSmoothingQuality = 'high';
  bc.drawImage(small, 0, 0, w, h);
  const pa = bc.getImageData(0, 0, w, h).data;

  // ガイド画像（元画像を同じ解像度に）
  bc.clearRect(0, 0, w, h);
  bc.drawImage(img, 0, 0, w, h);
  const ia = bc.getImageData(0, 0, w, h).data;

  const n = w * h;
  const p = new Float32Array(n);
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    p[i] = (pa[i * 4 + 3] ?? 0) / 255;
    r[i] = (ia[i * 4] ?? 0) / 255;
    g[i] = (ia[i * 4 + 1] ?? 0) / 255;
    b[i] = (ia[i * 4 + 2] ?? 0) / 255;
  }
  // 半径は粗いマスクの誤差（1画素 ≒ 作業解像度で数px）を十分に覆う大きさにする
  const radius = Math.max(3, Math.round(Math.max(w, h) / 110));
  const q = guidedFilter({ r, g, b }, p, w, h, radius, 1.5e-3);
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.round((q[i] ?? 0) * 255);
  return { width: w, height: h, data };
}
