import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  type Adjustments,
  type CropState,
  coverCrop,
  DEFAULT_ADJUSTMENTS,
  transferCrop,
} from '@/domain/edit';
import type { PhotoSpec } from '@/domain/specs';
import { db, dexieStorage, requestPersistence } from '@/lib/db';
import { normalizeImage } from '@/render/pool';

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

interface ProjectState {
  image: ImageMeta | null;
  /** 永続化しない（IndexedDB から読み込む） */
  imageBlob: Blob | null;
  activeSpecId: string;
  crops: Record<string, CropState>;
  adjustments: Adjustments;
  background: string;
  layout: LayoutEntry[];
}

interface ProjectActions {
  loadImage: (file: Blob, name: string) => Promise<void>;
  restoreBlob: () => Promise<void>;
  /** 規格の構図が無ければ、直前の規格から引き継いで作る */
  ensureCrop: (spec: PhotoSpec, from?: PhotoSpec) => CropState;
  setActiveSpec: (spec: PhotoSpec, from?: PhotoSpec) => void;
  updateCrop: (specId: string, patch: Partial<CropState>) => void;
  resetCrop: (spec: PhotoSpec) => void;
  setAdjustments: (patch: Partial<Adjustments>) => void;
  setBackground: (color: string) => void;
  setLayoutCount: (specId: string, count: number) => void;
  addToLayout: (specId: string, count?: number) => void;
  removeFromLayout: (specId: string) => void;
  clear: () => Promise<void>;
}

const INITIAL: Omit<ProjectState, 'activeSpecId'> = {
  image: null,
  imageBlob: null,
  crops: {},
  adjustments: DEFAULT_ADJUSTMENTS,
  background: '#ffffff',
  layout: [],
};

export function headRatio(spec: PhotoSpec): number {
  if (!spec.guide) return 0.65;
  const [a, b] = spec.guide.headHeightMm;
  return (a + b) / 2 / spec.heightMm;
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
        await db.transaction('rw', db.images, async () => {
          if (prev) await db.images.delete(prev.id);
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
        });
      },

      async restoreBlob() {
        const img = get().image;
        if (!img || get().imageBlob) return;
        const row = await db.images.get(img.id);
        if (row) set({ imageBlob: row.blob });
        else set({ image: null, crops: {} });
      },

      ensureCrop(spec, from) {
        const { crops, image } = get();
        const existing = crops[spec.id];
        if (existing) return existing;
        const aspect = image ? image.width / image.height : 0.75;
        const base = from ? crops[from.id] : undefined;
        const crop =
          base && from
            ? transferCrop(base, headRatio(from), headRatio(spec))
            : coverCrop(aspect, spec.widthMm / spec.heightMm);
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

      setAdjustments: (patch) => set({ adjustments: { ...get().adjustments, ...patch } }),
      setBackground: (background) => set({ background }),

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
        if (img) await db.images.delete(img.id);
        set({ ...INITIAL });
      },
    }),
    {
      name: 'project',
      version: 1,
      storage: createJSONStorage(() => dexieStorage),
      partialize: ({ imageBlob: _b, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        void state?.restoreBlob();
      },
    },
  ),
);
