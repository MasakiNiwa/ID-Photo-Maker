import { useEffect, useState } from 'react';
import { useObjectUrl } from '@/lib/useObjectUrl';
import { maskPreview } from '@/render/pool';
import { useProject } from '@/stores/project';

/**
 * 背景の置き換えが有効なとき、プレビュー用のマスク画像（CSS mask-image 用）の URL を返す。
 * 境界の調整中は少し待ってから作り直す。
 */
export function useMaskUrl(): string | null {
  const mask = useProject((s) => s.mask);
  const image = useProject((s) => s.image);
  const { enabled, threshold, softness } = useProject((s) => s.bgRemoval);
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!enabled || !mask || !image) {
      setBlob(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      maskPreview(mask, { threshold, softness }, image.width, image.height)
        .then((b) => {
          if (!cancelled) setBlob(b);
        })
        .catch(() => {});
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [enabled, mask, image, threshold, softness]);

  return useObjectUrl(enabled ? blob : null);
}

export function maskStyle(url: string | null) {
  if (!url) return {};
  const v = `url(${url})`;
  return { maskImage: v, WebkitMaskImage: v, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' };
}
