import * as Comlink from 'comlink';
import type { AnalysisResult, VisionWorkerApi } from './vision.worker';

/** AI（顔検出・人物切り抜き）Worker への窓口。初めて使うときに起動する。 */
let remote: Comlink.Remote<VisionWorkerApi> | null = null;

function worker(gpu: boolean): Comlink.Remote<VisionWorkerApi> {
  if (!remote) {
    const w = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module', name: 'vision' });
    remote = Comlink.wrap<VisionWorkerApi>(w);
  }
  const base = new URL(`mediapipe/${__MEDIAPIPE_VERSION__}`, document.baseURI).href;
  void remote.configure(base, gpu);
  return remote;
}

export function analyzeImage(blob: Blob, gpu: boolean): Promise<AnalysisResult> {
  return worker(gpu).analyze(blob);
}

export type { AnalysisResult, PersonMask } from './vision.worker';
