import * as Comlink from 'comlink';
import type { RenderWorkerApi } from './render.worker';
import type { CalibrationSheetRequest, PhotoRenderRequest, SheetRenderRequest } from './types';

/**
 * 描画用 Web Worker のプール。サイズの異なる写真を複数の Worker で並列に描画し、
 * メインスレッド（UI）を止めないようにする。
 */
const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
const workers: Comlink.Remote<RenderWorkerApi>[] = [];
let cursor = 0;

function next(): Comlink.Remote<RenderWorkerApi> {
  if (workers.length < size) {
    const w = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module', name: 'render' });
    workers.push(Comlink.wrap<RenderWorkerApi>(w));
  }
  const w = workers[cursor % workers.length] as Comlink.Remote<RenderWorkerApi>;
  cursor++;
  return w;
}

export function normalizeImage(blob: Blob) {
  return next().normalizeImage(blob);
}

export function maskPreview(...args: Parameters<RenderWorkerApi['maskPreview']>) {
  return next().maskPreview(...args);
}

export function extendedPreview(...args: Parameters<RenderWorkerApi['extendedPreview']>) {
  return next().extendedPreview(...args);
}

export function renderPhotoJpeg(req: PhotoRenderRequest, quality: number): Promise<Blob> {
  return next().renderPhotoJpeg(req, quality);
}

export type SheetPhotoRequests = Record<string, PhotoRenderRequest>;

/** 写真を並列描画してから、用紙1枚に面付けする */
export async function renderSheet(
  photoReqs: SheetPhotoRequests,
  sheet: Omit<SheetRenderRequest, 'photos'>,
): Promise<Blob> {
  const entries = await Promise.all(
    Object.entries(photoReqs).map(async ([key, req]) => [key, await next().renderPhotoBitmap(req)] as const),
  );
  const photos = Object.fromEntries(entries);
  return next().renderSheet(Comlink.transfer({ ...sheet, photos }, Object.values(photos)));
}

export function renderCalibrationSheet(req: CalibrationSheetRequest): Promise<Blob> {
  return next().renderCalibrationSheet(req);
}

export const workerCount = size;
