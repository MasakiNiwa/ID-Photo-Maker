import type { Adjustments, CropState } from '@/domain/edit';
import type { Placement } from '@/domain/layout';
import type { MaskInput, MaskParams } from './mask';
import type { SheetDecoration } from './sheetBackground';

export interface PhotoRenderRequest {
  /** 元画像。Blob は構造化複製されても中身はコピーされない */
  source: Blob;
  /** Worker 内のデコード結果キャッシュ用キー */
  sourceKey: string;
  widthMm: number;
  heightMm: number;
  crop: CropState;
  adjustments: Adjustments;
  background: string;
  dpi: number;
  /** 背景の置き換え（人物マスク）。無ければ元画像の背景のまま */
  mask?: { data: MaskInput; params: MaskParams; key: string };
  /** 枠からはみ出した部分を、写真の端をのばして補う */
  extend?: boolean;
  /** 端をのばすときに人物と背景を見分けるためのマスク（背景の置き換えとは独立） */
  personMask?: MaskInput | null;
}

export interface Calibration {
  offsetXMm: number;
  offsetYMm: number;
  /** % 指定（100 = 補正なし） */
  scaleXPct: number;
  scaleYPct: number;
}

export type CutLineStyle = 'none' | 'outline' | 'marks';

export interface SheetRenderRequest {
  widthMm: number;
  heightMm: number;
  dpi: number;
  placements: Placement[];
  /** key → 写真（その key のサイズで描画済み） */
  photos: Record<string, ImageBitmap>;
  calibration: Calibration;
  cutLine: CutLineStyle;
  quality: number;
  /** 写真の間隔（白い台紙の幅を決める） */
  gapMm: number;
  decoration: SheetDecoration;
}

export interface CalibrationSheetRequest {
  widthMm: number;
  heightMm: number;
  dpi: number;
  calibration: Calibration;
  quality: number;
}
