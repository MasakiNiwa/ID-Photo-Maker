import { describe, expect, it } from 'vitest';
import { extendFractions, frameCoverage } from './coverage';

const spec = { widthMm: 30, heightMm: 40 };
const img = { width: 1000, height: 1000 };

describe('frameCoverage', () => {
  it('拡大して中央なら覆われている', () => {
    expect(frameCoverage({ x: 0, y: 0, scale: 1.2, rotation: 0, flipH: false }, img, spec).covered).toBe(
      true,
    );
  });
  it('画像が下にずれていれば上が足りない', () => {
    const c = frameCoverage({ x: 0, y: 0.3, scale: 1.2, rotation: 0, flipH: false }, img, spec);
    expect(c.covered).toBe(false);
    expect(c.top).toBe(true);
    expect(c.bottom).toBe(false);
  });
  it('回転すると角が足りなくなる', () => {
    expect(frameCoverage({ x: 0, y: 0, scale: 1.02, rotation: 10, flipH: false }, img, spec).covered).toBe(
      false,
    );
  });
});

describe('extendFractions', () => {
  it('長辺の半分を各辺にのばす', () => {
    expect(extendFractions(600, 800)).toEqual({ fx: 400 / 600, fy: 0.5 });
  });
});
