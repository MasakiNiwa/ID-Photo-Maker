import { describe, expect, it } from 'vitest';
import { coverCrop, transferCrop } from './edit';

describe('coverCrop', () => {
  it('横長画像は横幅を合わせず高さで覆う', () => {
    expect(coverCrop(1.5, 0.75).scale).toBe(1);
  });
  it('縦長すぎる画像は幅で覆う', () => {
    expect(coverCrop(0.5, 0.75).scale).toBeCloseTo(1.5);
  });
});

describe('transferCrop', () => {
  it('頭の比率に応じて拡大率と位置を補正する', () => {
    const c = transferCrop({ x: 0.1, y: 0.2, scale: 2, rotation: 3, flipH: true }, 0.65, 0.78);
    expect(c.scale).toBeCloseTo(2.4);
    expect(c.y).toBeCloseTo(0.24);
    expect(c.rotation).toBe(3);
  });
});
