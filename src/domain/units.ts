export const MM_PER_INCH = 25.4;

/** mm → ピクセル（指定dpi） */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** 実寸を指定dpiで整数ピクセルに丸める */
export function mmToPxRound(mm: number, dpi: number): number {
  return Math.round(mmToPx(mm, dpi));
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
