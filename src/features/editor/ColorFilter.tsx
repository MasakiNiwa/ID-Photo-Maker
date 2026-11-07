import { useMemo } from 'react';
import { adjustmentsToMatrix } from '@/render/colorMatrix';
import { useProject } from '@/stores/project';

export const COLOR_FILTER_ID = 'idpm-adjust';

/**
 * プレビュー用の SVG カラーフィルタ。出力時と同じ行列を使うので見た目が一致する。
 * フィルタ処理はブラウザが GPU で行う。
 */
export function ColorFilterDefs() {
  const adj = useProject((s) => s.adjustments);
  const values = useMemo(() => adjustmentsToMatrix(adj).join(' '), [adj]);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <filter id={COLOR_FILTER_ID} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={values} />
      </filter>
    </svg>
  );
}
