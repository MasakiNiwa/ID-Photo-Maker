import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PhotoSpec } from '@/domain/specs';
import { dexieStorage } from '@/lib/db';
import type { Calibration, CutLineStyle } from '@/render/types';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface SettingsState {
  theme: ThemeMode;
  dpi: number;
  jpegQuality: number;
  paperId: string;
  landscape: boolean;
  marginMm: number;
  gapMm: number;
  cutLine: CutLineStyle;
  calibration: Calibration;
  customSpecs: PhotoSpec[];
  showGuides: boolean;
}

export const DEFAULT_CALIBRATION: Calibration = {
  offsetXMm: 0,
  offsetYMm: 0,
  scaleXPct: 100,
  scaleYPct: 100,
};

export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'system',
  dpi: 350,
  jpegQuality: 0.95,
  paperId: 'L',
  landscape: false,
  marginMm: 2,
  gapMm: 1,
  cutLine: 'outline',
  calibration: DEFAULT_CALIBRATION,
  customSpecs: [],
  showGuides: true,
};

interface SettingsActions {
  set: (patch: Partial<SettingsState>) => void;
  setCalibration: (patch: Partial<Calibration>) => void;
  addCustomSpec: (spec: PhotoSpec) => void;
  removeCustomSpec: (id: string) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setCalibration: (patch) => set((s) => ({ calibration: { ...s.calibration, ...patch } })),
      addCustomSpec: (spec) => set((s) => ({ customSpecs: [...s.customSpecs, spec] })),
      removeCustomSpec: (id) => set((s) => ({ customSpecs: s.customSpecs.filter((c) => c.id !== id) })),
      reset: () => set((s) => ({ ...DEFAULT_SETTINGS, customSpecs: s.customSpecs })),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => dexieStorage),
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<SettingsState>) }),
    },
  ),
);
