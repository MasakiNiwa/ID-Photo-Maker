/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { setJpegDpi } from '@/domain/jpeg';
import { mmToPx, mmToPxRound } from '@/domain/units';
import { adjustmentsToMatrix, applyMatrix, isIdentity } from './colorMatrix';
import { buildMaskCanvas, type MaskInput, type MaskParams } from './mask';
import { drawBase, drawPattern, drawTexts } from './sheetBackground';
import type { CalibrationSheetRequest, PhotoRenderRequest, SheetRenderRequest } from './types';

// 元画像のデコード結果を Worker ごとにキャッシュ（同じ写真を何度も描画するため）
const decoded = new Map<string, Promise<ImageBitmap>>();

function decode(key: string, blob: Blob): Promise<ImageBitmap> {
  let p = decoded.get(key);
  if (!p) {
    if (decoded.size > 2) {
      for (const [k, v] of decoded) {
        v.then((b) => b.close());
        decoded.delete(k);
        if (decoded.size <= 1) break;
      }
    }
    p = createImageBitmap(blob, { imageOrientation: 'from-image' });
    decoded.set(key, p);
  }
  return p;
}

// 元画像サイズ（最大1600px）の境界調整済みマスクをキャッシュ
const masks = new Map<string, OffscreenCanvas>();
const MASK_MAX = 1600;

function maskFor(key: string, m: MaskInput, p: MaskParams, imgW: number, imgH: number): OffscreenCanvas {
  const id = `${key}:${p.threshold}:${p.softness}`;
  let c = masks.get(id);
  if (!c) {
    const k = Math.min(1, MASK_MAX / Math.max(imgW, imgH));
    c = buildMaskCanvas(m, p, Math.round(imgW * k), Math.round(imgH * k));
    if (masks.size > 3) masks.clear();
    masks.set(id, c);
  }
  return c;
}

function ctx2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const c = canvas.getContext('2d', { willReadFrequently: false });
  if (!c) throw new Error('Canvas 2D が使用できません');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  return c;
}

async function encodeJpeg(canvas: OffscreenCanvas, dpi: number, quality: number): Promise<Blob> {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  const bytes = setJpegDpi(new Uint8Array(await blob.arrayBuffer()), dpi);
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
}

/** 1枚の証明写真を実寸ピクセルで描画する */
async function drawPhoto(req: PhotoRenderRequest): Promise<OffscreenCanvas> {
  const img = await decode(req.sourceKey, req.source);
  const W = mmToPxRound(req.widthMm, req.dpi);
  const H = mmToPxRound(req.heightMm, req.dpi);
  const canvas = new OffscreenCanvas(W, H);
  const c = ctx2d(canvas);
  const { crop } = req;
  const drawH = crop.scale * H;
  const drawW = drawH * (img.width / img.height);
  c.save();
  c.translate(W / 2 + crop.x * H, H / 2 + crop.y * H);
  c.rotate((crop.rotation * Math.PI) / 180);
  c.scale(crop.flipH ? -1 : 1, 1);
  c.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  if (req.mask) {
    // 人物だけを残す（同じ変換でマスクを重ねる）
    const mc = maskFor(req.mask.key, req.mask.data, req.mask.params, img.width, img.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(mc, -drawW / 2, -drawH / 2, drawW, drawH);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();

  // 色調整は写真部分のみに適用し、背景色は変えない
  const m = adjustmentsToMatrix(req.adjustments);
  if (!isIdentity(m)) {
    const data = c.getImageData(0, 0, W, H);
    applyMatrix(data.data, m);
    c.putImageData(data, 0, 0);
  }
  c.globalCompositeOperation = 'destination-over';
  c.fillStyle = req.background;
  c.fillRect(0, 0, W, H);
  return canvas;
}

const MAX_SOURCE_PX = 4096;

const api = {
  /** プレビュー用のマスク画像（PNG、CSS の mask-image に使う） */
  async maskPreview(m: MaskInput, p: MaskParams, imgW: number, imgH: number): Promise<Blob> {
    const k = Math.min(1, 900 / Math.max(imgW, imgH));
    const c = buildMaskCanvas(m, p, Math.round(imgW * k), Math.round(imgH * k));
    return c.convertToBlob({ type: 'image/png' });
  },

  /** 読み込んだ画像の向きを正規化し、大きすぎる場合は縮小する（デコードも裏側で行う） */
  async normalizeImage(blob: Blob): Promise<{ blob: Blob; width: number; height: number }> {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k = Math.min(1, MAX_SOURCE_PX / Math.max(bmp.width, bmp.height));
    const needsReencode = k < 1 || !/^image\/(jpeg|png|webp)$/.test(blob.type);
    if (!needsReencode) {
      const r = { blob, width: bmp.width, height: bmp.height };
      bmp.close();
      return r;
    }
    const w = Math.round(bmp.width * k);
    const h = Math.round(bmp.height * k);
    const canvas = new OffscreenCanvas(w, h);
    ctx2d(canvas).drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return { blob: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 }), width: w, height: h };
  },

  async renderPhotoBitmap(req: PhotoRenderRequest): Promise<ImageBitmap> {
    const canvas = await drawPhoto(req);
    const bmp = canvas.transferToImageBitmap();
    return Comlink.transfer(bmp, [bmp]);
  },

  async renderPhotoJpeg(req: PhotoRenderRequest, quality: number): Promise<Blob> {
    return encodeJpeg(await drawPhoto(req), req.dpi, quality);
  },

  /** 面付けした用紙1枚を描画する */
  async renderSheet(req: SheetRenderRequest): Promise<Blob> {
    const W = mmToPxRound(req.widthMm, req.dpi);
    const H = mmToPxRound(req.heightMm, req.dpi);
    const canvas = new OffscreenCanvas(W, H);
    const c = ctx2d(canvas);
    const deco = req.decoration;
    drawBase(c, deco, W, H);

    const { calibration: cal } = req;
    const sx = cal.scaleXPct / 100;
    const sy = cal.scaleYPct / 100;
    const cx = req.widthMm / 2;
    const cy = req.heightMm / 2;
    const k = req.dpi / 25.4;

    // 柄と文字は mm 座標で描き、印刷ズレ補正も同じ変換で反映する
    c.save();
    c.setTransform(
      sx * k,
      0,
      0,
      sy * k,
      (cx - cx * sx + cal.offsetXMm) * k,
      (cy - cy * sy + cal.offsetYMm) * k,
    );
    drawPattern(c, deco, req.widthMm, req.heightMm);
    if (deco.photoMat && deco.pattern !== 'none') {
      // 写真の周囲を白く抜いて、柄の上でも切りやすく・見やすくする
      const m = Math.max(0.8, req.gapMm / 2);
      c.fillStyle = '#ffffff';
      for (const p of req.placements) c.fillRect(p.xMm - m, p.yMm - m, p.widthMm + m * 2, p.heightMm + m * 2);
    }
    drawTexts(c, deco);
    c.restore();
    // 用紙中心を基準に拡大縮小し、オフセットを加える（プリンターのズレ補正）
    const mapX = (mm: number) => mmToPx(cx + (mm - cx) * sx + cal.offsetXMm, req.dpi);
    const mapY = (mm: number) => mmToPx(cy + (mm - cy) * sy + cal.offsetYMm, req.dpi);

    const line = Math.max(1, mmToPx(0.12, req.dpi));
    for (const p of req.placements) {
      const bmp = req.photos[p.key];
      const x = Math.round(mapX(p.xMm));
      const y = Math.round(mapY(p.yMm));
      const w = Math.round(mapX(p.xMm + p.widthMm)) - x;
      const h = Math.round(mapY(p.yMm + p.heightMm)) - y;
      if (bmp) c.drawImage(bmp, x, y, w, h);
      if (req.cutLine === 'outline') {
        c.strokeStyle = '#b8bcc2';
        c.lineWidth = line;
        c.strokeRect(x - line / 2, y - line / 2, w + line, h + line);
      } else if (req.cutLine === 'marks') {
        const len = mmToPx(1.5, req.dpi);
        c.strokeStyle = '#8a8f96';
        c.lineWidth = line;
        c.beginPath();
        for (const [px, py, dx, dy] of [
          [x, y, -1, -1],
          [x + w, y, 1, -1],
          [x, y + h, -1, 1],
          [x + w, y + h, 1, 1],
        ] as const) {
          c.moveTo(px + dx * line, py);
          c.lineTo(px + dx * len, py);
          c.moveTo(px, py + dy * line);
          c.lineTo(px, py + dy * len);
        }
        c.stroke();
      }
    }
    for (const b of Object.values(req.photos)) b.close();
    return encodeJpeg(canvas, req.dpi, req.quality);
  },

  /** 印刷ズレ・倍率を測るための校正シート */
  async renderCalibrationSheet(req: CalibrationSheetRequest): Promise<Blob> {
    const W = mmToPxRound(req.widthMm, req.dpi);
    const H = mmToPxRound(req.heightMm, req.dpi);
    const canvas = new OffscreenCanvas(W, H);
    const c = ctx2d(canvas);
    const px = (mm: number) => mmToPx(mm, req.dpi);
    const { calibration: cal } = req;
    const cx = req.widthMm / 2;
    const cy = req.heightMm / 2;
    const mx = (mm: number) => px(cx + (mm - cx) * (cal.scaleXPct / 100) + cal.offsetXMm);
    const my = (mm: number) => px(cy + (mm - cy) * (cal.scaleYPct / 100) + cal.offsetYMm);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#000';
    c.fillStyle = '#000';
    c.lineWidth = Math.max(1, px(0.15));

    // 中心の十字線
    c.beginPath();
    c.moveTo(mx(cx), my(0));
    c.lineTo(mx(cx), my(req.heightMm));
    c.moveTo(mx(0), my(cy));
    c.lineTo(mx(req.widthMm), my(cy));
    c.stroke();

    // 目盛り付きの定規（中心から上下左右へ）
    const reachX = Math.floor(req.widthMm / 2 - 5);
    const reachY = Math.floor(req.heightMm / 2 - 5);
    c.beginPath();
    for (let d = -reachX; d <= reachX; d++) {
      const len = d % 10 === 0 ? 4 : d % 5 === 0 ? 2.5 : 1.5;
      c.moveTo(mx(cx + d), my(cy - len));
      c.lineTo(mx(cx + d), my(cy + len));
    }
    for (let d = -reachY; d <= reachY; d++) {
      const len = d % 10 === 0 ? 4 : d % 5 === 0 ? 2.5 : 1.5;
      c.moveTo(mx(cx - len), my(cy + d));
      c.lineTo(mx(cx + len), my(cy + d));
    }
    c.stroke();

    // 用紙端から 5mm の枠（ズレの確認用）
    c.strokeRect(mx(5), my(5), mx(req.widthMm - 5) - mx(5), my(req.heightMm - 5) - my(5));

    c.font = `${px(2.6)}px sans-serif`;
    c.textAlign = 'center';
    const tens = Math.floor(reachX / 10) * 10;
    c.fillText(`← ${tens * 2}mm →`, mx(cx), my(cy - 8));
    c.fillText('枠線は用紙の端から5mm', mx(cx), my(12));
    c.fillText(
      `補正: X ${cal.offsetXMm}mm / Y ${cal.offsetYMm}mm / 倍率 ${cal.scaleXPct}% × ${cal.scaleYPct}%`,
      mx(cx),
      my(req.heightMm - 10),
    );
    return encodeJpeg(canvas, req.dpi, req.quality);
  },
};

export type RenderWorkerApi = typeof api;
Comlink.expose(api);
