import { useEffect, useState } from 'react';
import { useObjectUrl } from '@/lib/useObjectUrl';
import { extendedPreview, maskPreview } from '@/render/pool';
import { useProject } from '@/stores/project';
import { useSettings } from '@/stores/settings';

/** プレビューに表示する画像。fx/fy は元画像に対する外周ののばし量（のばしていなければ 0） */
export interface DisplayImage {
  url: string;
  fx: number;
  fy: number;
}

/**
 * プレビュー用の表示画像と人物マスク。
 * 「端をのばして補う」が有効なら外周をのばした画像を、背景の置き換えが有効ならマスクを用意する。
 */
export function usePreviewLayers(): { display: DisplayImage | null; maskUrl: string | null } {
  const image = useProject((s) => s.image);
  const blob = useProject((s) => s.imageBlob);
  const mask = useProject((s) => s.mask);
  const { enabled, threshold, softness } = useProject((s) => s.bgRemoval);
  const extend = useSettings((s) => s.extendEdges);
  const originalUrl = useObjectUrl(blob);

  const [ext, setExt] = useState<{ key: string; blob: Blob; fx: number; fy: number } | null>(null);
  const extKey = image ? `${image.id}:${mask ? 'm' : ''}` : '';
  useEffect(() => {
    if (!extend || !blob || !image || ext?.key === extKey) return;
    let cancelled = false;
    extendedPreview(blob, image.id, mask)
      .then((r) => {
        if (!cancelled) setExt({ key: extKey, ...r });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [extend, blob, image, mask, extKey, ext?.key]);
  const extUrl = useObjectUrl(extend && ext && ext.key === extKey ? ext.blob : null);

  const useExt = extend && !!extUrl && !!ext;
  const [maskBlob, setMaskBlob] = useState<Blob | null>(null);
  useEffect(() => {
    if (!enabled || !mask || !image) {
      setMaskBlob(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      maskPreview(mask, { threshold, softness }, image.width, image.height, useExt)
        .then((r) => {
          if (!cancelled) setMaskBlob(r.blob);
        })
        .catch(() => {});
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [enabled, mask, image, threshold, softness, useExt]);
  const maskUrl = useObjectUrl(enabled ? maskBlob : null);

  const display: DisplayImage | null =
    useExt && extUrl && ext
      ? { url: extUrl, fx: ext.fx, fy: ext.fy }
      : originalUrl
        ? { url: originalUrl, fx: 0, fy: 0 }
        : null;
  return { display, maskUrl };
}

export function maskStyle(url: string | null) {
  if (!url) return {};
  const v = `url(${url})`;
  return { maskImage: v, WebkitMaskImage: v, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' };
}
