/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import * as Comlink from 'comlink';
import { type FaceGeometry, findHeadTop, type Pt } from '@/domain/face';

/**
 * 顔検出（Face Landmarker）と人物セグメンテーション（Selfie Segmenter）を行う Worker。
 * 可能なら GPU（WebGL）で推論し、使えない環境では自動で CPU に切り替える。
 */
const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  segmenter:
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
};

export interface PersonMask {
  width: number;
  height: number;
  /** 人物らしさ 0〜255 */
  data: Uint8Array;
}

export interface AnalysisResult {
  face: FaceGeometry | null;
  mask: PersonMask | null;
  delegate: 'GPU' | 'CPU';
}

let wasmBase = '';
let preferGpu = true;
let usedDelegate: 'GPU' | 'CPU' = 'CPU';
let tasks: Promise<{ face: FaceLandmarker; seg: ImageSegmenter }> | null = null;

async function create(delegate: 'GPU' | 'CPU') {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase, true);
  const canvas = delegate === 'GPU' ? new OffscreenCanvas(1, 1) : undefined;
  const [face, seg] = await Promise.all([
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODELS.face, delegate },
      canvas,
      runningMode: 'IMAGE',
      numFaces: 1,
    }),
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODELS.segmenter, delegate },
      canvas,
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
  ]);
  usedDelegate = delegate;
  return { face, seg };
}

function getTasks() {
  if (!tasks) {
    tasks = (preferGpu ? create('GPU').catch(() => create('CPU')) : create('CPU')).catch((e) => {
      tasks = null;
      throw e;
    });
  }
  return tasks;
}

// 顔のランドマーク番号（MediaPipe Face Mesh）
const LM = { eyeA: [33, 133], eyeB: [362, 263], chin: 152, forehead: 10, cheekL: 234, cheekR: 454 } as const;

const api = {
  configure(base: string, gpu: boolean) {
    if (base !== wasmBase || gpu !== preferGpu) tasks = null;
    wasmBase = base;
    preferGpu = gpu;
  },

  /** モデルの読み込みだけ先に行う */
  async warmup(): Promise<'GPU' | 'CPU'> {
    await getTasks();
    return usedDelegate;
  },

  async analyze(blob: Blob): Promise<AnalysisResult> {
    const { face, seg } = await getTasks();
    const full = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const W = full.width;
    const H = full.height;
    // 推論用に縮小（座標は正規化値なので元画像に戻せる）
    const k = Math.min(1, 1280 / Math.max(W, H));
    const bmp =
      k < 1
        ? await createImageBitmap(full, { resizeWidth: Math.round(W * k), resizeHeight: Math.round(H * k) })
        : full;

    let mask: PersonMask | null = null;
    const segResult = seg.segment(bmp);
    const conf = segResult.confidenceMasks?.[0];
    if (conf) {
      const f = conf.getAsFloat32Array();
      const data = new Uint8Array(f.length);
      for (let i = 0; i < f.length; i++) data[i] = Math.round(Math.min(1, Math.max(0, f[i] ?? 0)) * 255);
      mask = { width: conf.width, height: conf.height, data };
    }
    segResult.close();

    let geometry: FaceGeometry | null = null;
    const lm = face.detect(bmp).faceLandmarks[0];
    if (lm) {
      const p = (i: number): Pt => ({ x: (lm[i]?.x ?? 0) * W, y: (lm[i]?.y ?? 0) * H });
      const avg = (ids: readonly number[]): Pt => {
        const ps = ids.map(p);
        return {
          x: ps.reduce((a, q) => a + q.x, 0) / ps.length,
          y: ps.reduce((a, q) => a + q.y, 0) / ps.length,
        };
      };
      const a = avg(LM.eyeA);
      const b = avg(LM.eyeB);
      const [leftEye, rightEye] = a.x <= b.x ? [a, b] : [b, a];
      const chin = p(LM.chin);
      const forehead = p(LM.forehead);
      const faceWidth = Math.hypot(p(LM.cheekR).x - p(LM.cheekL).x, p(LM.cheekR).y - p(LM.cheekL).y);
      const headTop = mask
        ? findHeadTop(mask, { width: W, height: H }, forehead, chin, faceWidth)
        : {
            x: forehead.x + (forehead.x - chin.x) * 0.3,
            y: forehead.y + (forehead.y - chin.y) * 0.3,
          };
      geometry = { leftEye, rightEye, chin, headTop };
    }
    if (bmp !== full) bmp.close();
    full.close();
    return Comlink.transfer({ face: geometry, mask, delegate: usedDelegate }, mask ? [mask.data.buffer] : []);
  },
};

export type VisionWorkerApi = typeof api;
Comlink.expose(api);
