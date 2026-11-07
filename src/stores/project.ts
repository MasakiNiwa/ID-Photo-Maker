import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AnalysisResult, PersonMask } from '@/ai/client';
import {
  type Adjustments,
  type CropState,
  coverCrop,
  DEFAULT_ADJUSTMENTS,
  transferCrop,
} from '@/domain/edit';
import { autoCrop, type FaceGeometry } from '@/domain/face';
import { type PhotoSpec, PRESET_SPECS } from '@/domain/specs';
import { db, dexieStorage, requestPersistence } from '@/lib/db';
import { normalizeImage } from '@/render/pool';
import { useSettings } from './settings';

export interface ImageMeta {
  id: string;
  name: string;
  width: number;
  height: number;
}

export interface LayoutEntry {
  specId: string;
  count: number;
}

export type AnalysisStatus = 'idle' | 'running' | 'done' | 'noface' | 'error';

export interface BgRemoval {
  enabled: boolean;
  /** 境界の位置 0〜1 */
  threshold: number;
  /** 境界のぼかし */
  softness: number;
  /** 元画像の色を手がかりに境界を精密にする（髪の毛など） */
  refine: boolean;
}

export const DEFAULT_BG_REMOVAL: BgRemoval = { enabled: false, threshold: 0.5, softness: 0.1, refine: true };

interface ProjectState {
  image: ImageMeta | null;
  /** 永続化しない（IndexedDB から読み込む） */
  imageBlob: Blob | null;
  activeSpecId: string;
  crops: Record<string, CropState>;
  adjustments: Adjustments;
  background: string;
  layout: LayoutEntry[];
  /** AI 解析（顔検出・人物切り抜き） */
  analysis: { imageId: string | null; status: AnalysisStatus; face: FaceGeometry | null; delegate?: string };
  /** 永続化しない（IndexedDB から読み込む） */
  mask: PersonMask | null;
  bgRemoval: BgRemoval;
}

interface ProjectActions {
  loadImage: (file: Blob, name: string) => Promise<void>;
  restoreBlob: () => Promise<void>;
  /** 顔検出と人物切り抜きを行う（結果は保存され、再読み込み後も使える） */
  analyze: () => Promise<void>;
  /** 規格の構図が無ければ作る（顔が分かっていれば顔に合わせ、無ければ直前の規格から引き継ぐ） */
  ensureCrop: (spec: PhotoSpec, from?: PhotoSpec) => CropState;
  setActiveSpec: (spec: PhotoSpec, from?: PhotoSpec) => void;
  updateCrop: (specId: string, patch: Partial<CropState>) => void;
  resetCrop: (spec: PhotoSpec) => void;
  /** 顔に合わせて構図を自動調整する。spec 省略時は作成済みの全規格 */
  fitToFace: (spec?: PhotoSpec) => boolean;
  setAdjustments: (patch: Partial<Adjustments>) => void;
  setBackground: (color: string) => void;
  setBgRemoval: (patch: Partial<BgRemoval>) => void;
  setLayoutCount: (specId: string, count: number) => void;
  addToLayout: (specId: string, count?: number) => void;
  removeFromLayout: (specId: string) => void;
  clear: () => Promise<void>;
}

const INITIAL_ANALYSIS: ProjectState['analysis'] = { imageId: null, status: 'idle', face: null };

const INITIAL: Omit<ProjectState, 'activeSpecId'> = {
  image: null,
  imageBlob: null,
  crops: {},
  adjustments: DEFAULT_ADJUSTMENTS,
  background: '#ffffff',
  layout: [],
  analysis: INITIAL_ANALYSIS,
  mask: null,
  bgRemoval: DEFAULT_BG_REMOVAL,
};

export function headRatio(spec: PhotoSpec): number {
  if (!spec.guide) return 0.65;
  const [a, b] = spec.guide.headHeightMm;
  return (a + b) / 2 / spec.heightMm;
}

function specById(id: string): PhotoSpec | undefined {
  return PRESET_SPECS.find((s) => s.id === id) ?? useSettings.getState().customSpecs.find((s) => s.id === id);
}

export const useProject = create<ProjectState & ProjectActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      activeSpecId: 'resume',

      async loadImage(file, name) {
        const norm = await normalizeImage(file);
        const id = crypto.randomUUID();
        const prev = get().image;
        await db.transaction('rw', db.images, db.masks, async () => {
          if (prev) {
            await db.images.delete(prev.id);
            await db.masks.delete(prev.id);
          }
          await db.images.put({
            id,
            blob: norm.blob,
            name,
            width: norm.width,
            height: norm.height,
            createdAt: Date.now(),
          });
        });
        void requestPersistence();
        set({
          image: { id, name, width: norm.width, height: norm.height },
          imageBlob: norm.blob,
          crops: {},
          adjustments: DEFAULT_ADJUSTMENTS,
          analysis: { imageId: id, status: 'idle', face: null },
          mask: null,
          bgRemoval: { ...get().bgRemoval, enabled: false },
        });
        void get().analyze();
      },

      async restoreBlob() {
        const img = get().image;
        if (!img || get().imageBlob) return;
        const [row, mask] = await Promise.all([db.images.get(img.id), db.masks.get(img.id)]);
        if (!row) {
          set({ image: null, crops: {}, analysis: INITIAL_ANALYSIS });
          return;
        }
        set({
          imageBlob: row.blob,
          mask: mask ? { width: mask.width, height: mask.height, data: mask.data } : null,
        });
        // 解析が途中で終わっていた場合はやり直す
        if (get().analysis.imageId !== img.id || get().analysis.status === 'running') void get().analyze();
      },

      async analyze() {
        const { image, imageBlob } = get();
        if (!image || !imageBlob) return;
        set({ analysis: { imageId: image.id, status: 'running', face: null } });
        let result: AnalysisResult;
        try {
          const { analyzeImage } = await import('@/ai/client');
          result = await analyzeImage(imageBlob, useSettings.getState().useGpu);
        } catch (e) {
          console.error(e);
          if (get().image?.id === image.id)
            set({ analysis: { imageId: image.id, status: 'error', face: null } });
          return;
        }
        // 解析中に別の写真に変わっていたら捨てる
        if (get().image?.id !== image.id) return;
        if (result.mask) await db.masks.put({ imageId: image.id, ...result.mask });
        const untouched = Object.keys(get().crops).length <= 1;
        set({
          mask: result.mask,
          analysis: {
            imageId: image.id,
            status: result.face ? 'done' : 'noface',
            face: result.face,
            delegate: result.delegate,
          },
        });
        if (result.face && untouched && useSettings.getState().autoFit) get().fitToFace();
      },

      ensureCrop(spec, from) {
        const { crops, image, analysis } = get();
        const existing = crops[spec.id];
        if (existing) return existing;
        const base = from ? crops[from.id] : undefined;
        let crop: CropState;
        if (image && analysis.face && useSettings.getState().autoFit) {
          crop = autoCrop(analysis.face, image, spec, { flipH: base?.flipH });
        } else if (base && from) {
          crop = transferCrop(base, headRatio(from), headRatio(spec));
        } else {
          crop = coverCrop(image ? image.width / image.height : 0.75, spec.widthMm / spec.heightMm);
        }
        set({ crops: { ...crops, [spec.id]: crop } });
        return crop;
      },

      setActiveSpec(spec, from) {
        get().ensureCrop(spec, from);
        set({ activeSpecId: spec.id });
      },

      updateCrop(specId, patch) {
        const cur = get().crops[specId];
        if (!cur) return;
        set({ crops: { ...get().crops, [specId]: { ...cur, ...patch } } });
      },

      resetCrop(spec) {
        const { image } = get();
        const aspect = image ? image.width / image.height : 0.75;
        set({ crops: { ...get().crops, [spec.id]: coverCrop(aspect, spec.widthMm / spec.heightMm) } });
      },

      fitToFace(spec) {
        const { image, analysis, crops, activeSpecId } = get();
        if (!image || !analysis.face) return false;
        const face = analysis.face;
        const ids = spec ? [spec.id] : [...new Set([...Object.keys(crops), activeSpecId])];
        const next = { ...crops };
        for (const id of ids) {
          const s = spec ?? specById(id);
          if (s) next[id] = autoCrop(face, image, s, { flipH: crops[id]?.flipH });
        }
        set({ crops: next });
        return true;
      },

      setAdjustments: (patch) => set({ adjustments: { ...get().adjustments, ...patch } }),
      setBackground: (background) => set({ background }),
      setBgRemoval: (patch) => set({ bgRemoval: { ...get().bgRemoval, ...patch } }),

      setLayoutCount(specId, count) {
        set({
          layout: get()
            .layout.map((e) => (e.specId === specId ? { ...e, count: Math.max(0, Math.min(200, count)) } : e))
            .filter((e) => e.count > 0),
        });
      },
      addToLayout(specId, count = 1) {
        const { layout } = get();
        const hit = layout.find((e) => e.specId === specId);
        set({
          layout: hit
            ? layout.map((e) => (e.specId === specId ? { ...e, count: e.count + count } : e))
            : [...layout, { specId, count }],
        });
      },
      removeFromLayout: (specId) => set({ layout: get().layout.filter((e) => e.specId !== specId) }),

      async clear() {
        const img = get().image;
        if (img) {
          await db.images.delete(img.id);
          await db.masks.delete(img.id);
        }
        set({ ...INITIAL });
      },
    }),
    {
      name: 'project',
      version: 1,
      storage: createJSONStorage(() => dexieStorage),
      partialize: ({ imageBlob: _b, mask: _m, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProjectState>;
        return {
          ...current,
          ...p,
          analysis: p.analysis ?? INITIAL_ANALYSIS,
          bgRemoval: { ...DEFAULT_BG_REMOVAL, ...p.bgRemoval },
        };
      },
      onRehydrateStorage: () => (state) => {
        void state?.restoreBlob();
      },
    },
  ),
);

/** 描画リクエスト用のマスク指定（背景の置き換えが有効なときだけ） */
export function maskRequest(s: Pick<ProjectState, 'mask' | 'bgRemoval' | 'image'>) {
  if (!s.mask || !s.bgRemoval.enabled || !s.image) return undefined;
  return {
    data: s.mask,
    params: { threshold: s.bgRemoval.threshold, softness: s.bgRemoval.softness },
    key: s.image.id,
    refine: s.bgRemoval.refine,
  };
}
