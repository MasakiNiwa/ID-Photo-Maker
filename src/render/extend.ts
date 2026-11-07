import { extendFractions } from '@/domain/coverage';
import type { MaskInput } from './mask';

export interface Extended {
  canvas: OffscreenCanvas;
  /** 内側の元画像の幅・高さに対する、のばした量の比率 */
  fx: number;
  fy: number;
}

/**
 * 写真の外周を端のピクセルでのばし、ぼかしてなじませた画像を作る。
 * 証明写真の枠が元画像からはみ出したときに、その部分を自然に補うために使う。
 */
export function buildExtended(img: ImageBitmap, maxContent: number, mask?: MaskInput | null): Extended {
  const k = Math.min(1, maxContent / Math.max(img.width, img.height));
  const cw = Math.round(img.width * k);
  const ch = Math.round(img.height * k);
  const { fx, fy } = extendFractions(cw, ch);
  const px = Math.round(fx * cw);
  const py = Math.round(fy * ch);
  const W = cw + px * 2;
  const H = ch + py * 2;
  const canvas = new OffscreenCanvas(W, H);
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas 2D が使用できません');
  c.imageSmoothingEnabled = true;
  const iw = img.width;
  const ih = img.height;
  // 端の数ピクセル幅の帯を引きのばす
  const bw = Math.max(1, Math.round(iw * 0.004));
  const bh = Math.max(1, Math.round(ih * 0.004));
  const top = mask ? backgroundTopRow(img, bh, cw, mask) : null;
  if (top)
    c.drawImage(top, 0, 0, cw, 1, px, 0, cw, py); // 上（人物を除いた背景色だけでのばす）
  else c.drawImage(img, 0, 0, iw, bh, px, 0, cw, py); // 上
  c.drawImage(img, 0, ih - bh, iw, bh, px, py + ch, cw, py); // 下
  c.drawImage(img, 0, 0, bw, ih, 0, py, px, ch); // 左
  c.drawImage(img, iw - bw, 0, bw, ih, px + cw, py, px, ch); // 右
  if (top) {
    c.drawImage(top, 0, 0, 1, 1, 0, 0, px, py); // 四隅
    c.drawImage(top, cw - 1, 0, 1, 1, px + cw, 0, px, py);
  } else {
    c.drawImage(img, 0, 0, bw, bh, 0, 0, px, py); // 四隅
    c.drawImage(img, iw - bw, 0, bw, bh, px + cw, 0, px, py);
  }
  c.drawImage(img, 0, ih - bh, bw, bh, 0, py + ch, px, py);
  c.drawImage(img, iw - bw, ih - bh, bw, bh, px + cw, py + ch, px, py);
  // 引きのばしによる筋をぼかしてなじませる（非対応ブラウザではそのまま）
  if (typeof c.filter === 'string') {
    const tmp = new OffscreenCanvas(W, H);
    const tc = tmp.getContext('2d');
    if (tc) {
      tc.filter = `blur(${Math.max(2, Math.round(Math.max(cw, ch) * 0.012))}px)`;
      tc.drawImage(canvas, 0, 0);
      c.drawImage(tmp, 0, 0);
    }
  }
  c.drawImage(img, px, py, cw, ch);
  return { canvas, fx: px / cw, fy: py / ch };
}

/**
 * 上端の1行を、人物（髪など）の部分を左右の背景色で補間した色列にする。
 * 頭が上端に接していても、上にのばした部分が背景色になる。
 */
function backgroundTopRow(img: ImageBitmap, bh: number, cw: number, mask: MaskInput): OffscreenCanvas | null {
  const band = new OffscreenCanvas(cw, 1);
  const bc = band.getContext('2d', { willReadFrequently: true });
  if (!bc) return null;
  bc.drawImage(img, 0, 0, img.width, bh, 0, 0, cw, 1);
  const row = bc.getImageData(0, 0, cw, 1);
  const isBg = (x: number) => {
    const mx = Math.min(mask.width - 1, Math.floor((x / cw) * mask.width));
    return (mask.data[mx] ?? 0) < 128 && (mask.data[mask.width + mx] ?? 0) < 128;
  };
  const bg = Array.from({ length: cw }, (_, x) => isBg(x));
  if (!bg.some(Boolean)) return null;
  const d = row.data;
  let x = 0;
  while (x < cw) {
    if (bg[x]) {
      x++;
      continue;
    }
    // 人物の区間 [x, end) を、両側の背景色の線形補間で埋める
    let end = x;
    while (end < cw && !bg[end]) end++;
    const l = x - 1;
    const r = end < cw ? end : -1;
    for (let i = x; i < end; i++) {
      const t = l >= 0 && r >= 0 ? (i - l) / (r - l) : 0;
      for (let ch = 0; ch < 3; ch++) {
        const lv = l >= 0 ? (d[l * 4 + ch] ?? 0) : (d[r * 4 + ch] ?? 0);
        const rv = r >= 0 ? (d[r * 4 + ch] ?? 0) : lv;
        d[i * 4 + ch] = lv + (rv - lv) * t;
      }
    }
    x = end;
  }
  bc.putImageData(row, 0, 0);
  return band;
}
