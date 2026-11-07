import { describe, expect, it } from 'vitest';
import { DEFAULT_ADJUSTMENTS } from '@/domain/edit';
import { adjustmentsToMatrix, applyMatrix, isIdentity } from './colorMatrix';

describe('adjustmentsToMatrix', () => {
  it('既定値は単位行列', () => {
    expect(isIdentity(adjustmentsToMatrix(DEFAULT_ADJUSTMENTS))).toBe(true);
  });
  it('明るさ 1.2 で画素が明るくなる', () => {
    const m = adjustmentsToMatrix({ ...DEFAULT_ADJUSTMENTS, brightness: 1.2 });
    const px = new Uint8ClampedArray([100, 100, 100, 255]);
    applyMatrix(px, m);
    expect(px[0]).toBe(120);
    expect(px[3]).toBe(255);
  });
  it('彩度 0 でグレーになる', () => {
    const m = adjustmentsToMatrix({ ...DEFAULT_ADJUSTMENTS, saturation: 0 });
    const px = new Uint8ClampedArray([200, 50, 10, 255]);
    applyMatrix(px, m);
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
  });
});
