/**
 * 非破壊編集のパラメータ。元画像は保持したまま、この値だけを保存・変更する。
 * 位置は「写真枠の高さ」を1とした正規化座標なので、規格（サイズ）を
 * 切り替えても同じ構図を保ちやすく、出力解像度にも依存しない。
 */
export interface CropState {
  /** 画像中心の枠中心からのずれ（枠の高さ基準） */
  x: number;
  y: number;
  /** 画像の表示高さ / 枠の高さ */
  scale: number;
  /** 回転（度） */
  rotation: number;
  flipH: boolean;
}

export interface Adjustments {
  /** 1 = 変化なし */
  brightness: number;
  contrast: number;
  saturation: number;
  /** -1〜1。正で暖色、負で寒色 */
  warmth: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = { brightness: 1, contrast: 1, saturation: 1, warmth: 0 };

/** 画像が枠を覆う（cover）初期配置 */
export function coverCrop(imageAspect: number, frameAspect: number): CropState {
  // 枠の高さ=1 のとき、枠の幅 = frameAspect。画像幅 = scale * imageAspect
  const scale = Math.max(1, frameAspect / imageAspect);
  return { x: 0, y: 0, scale, rotation: 0, flipH: false };
}

/** 別規格へ構図を引き継ぐ（顔の大きさの比率を保つ） */
export function transferCrop(crop: CropState, fromHeadRatio: number, toHeadRatio: number): CropState {
  const k = fromHeadRatio > 0 && toHeadRatio > 0 ? toHeadRatio / fromHeadRatio : 1;
  return { ...crop, x: crop.x * k, y: crop.y * k, scale: crop.scale * k };
}

/** 背景色のプリセット */
export const BACKGROUND_COLORS = [
  { id: 'white', name: '白', value: '#ffffff' },
  { id: 'lightgray', name: '薄いグレー', value: '#e9ebee' },
  { id: 'blue', name: '薄い青', value: '#cfe3f3' },
  { id: 'gray', name: 'グレー', value: '#9aa3ad' },
] as const;
