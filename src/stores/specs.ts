import { useMemo } from 'react';
import { type PhotoSpec, PRESET_SPECS } from '@/domain/specs';
import { useSettings } from './settings';

export function useAllSpecs(): PhotoSpec[] {
  const custom = useSettings((s) => s.customSpecs);
  return useMemo(() => [...PRESET_SPECS, ...custom], [custom]);
}

export function findSpec(specs: readonly PhotoSpec[], id: string): PhotoSpec | undefined {
  return specs.find((s) => s.id === id);
}
