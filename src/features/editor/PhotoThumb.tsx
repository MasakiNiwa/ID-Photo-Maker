import type { CropState } from '@/domain/edit';
import type { PhotoSpec } from '@/domain/specs';
import { COLOR_FILTER_ID } from './ColorFilter';

/** 構図の縮小プレビュー（Cropper と同じ座標系を CSS で再現） */
export function PhotoThumb({
  imageUrl,
  imageAspect,
  spec,
  crop,
  background,
  height = 64,
}: {
  imageUrl: string | null;
  imageAspect: number;
  spec: PhotoSpec;
  crop: CropState | undefined;
  background: string;
  height?: number;
}) {
  const w = (height * spec.widthMm) / spec.heightMm;
  return (
    <div className="thumb" style={{ width: w, height, background }}>
      {imageUrl && crop && (
        <img
          src={imageUrl}
          alt=""
          style={{
            width: crop.scale * height * imageAspect,
            height: crop.scale * height,
            filter: `url(#${COLOR_FILTER_ID})`,
            transform: `translate(-50%, -50%) translate(${crop.x * height}px, ${crop.y * height}px) rotate(${crop.rotation}deg) scaleX(${crop.flipH ? -1 : 1})`,
          }}
        />
      )}
    </div>
  );
}
