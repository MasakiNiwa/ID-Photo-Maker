import { describe, expect, it } from 'vitest';
import { placeCaption, textColorFor } from './sheetDesign';

const sheet = { widthMm: 89, heightMm: 127 };

describe('placeCaption', () => {
  it('下の空きに文字を置く', () => {
    const r = placeCaption([{ text: 'a', sizeMm: 4 }], [{ yMm: 2, heightMm: 80 }], sheet, 2, 1);
    expect(r).not.toBeNull();
    const y = r?.[0]?.yMm ?? 0;
    expect(y).toBeGreaterThan(83);
    expect(y).toBeLessThan(125);
  });
  it('下が足りなければ上に置く', () => {
    const r = placeCaption([{ text: 'a', sizeMm: 4 }], [{ yMm: 40, heightMm: 85 }], sheet, 2, 1);
    expect(r?.[0]?.yMm ?? 0).toBeLessThan(40);
  });
  it('どこにも入らなければ null', () => {
    expect(placeCaption([{ text: 'a', sizeMm: 4 }], [{ yMm: 3, heightMm: 121 }], sheet, 2, 1)).toBeNull();
  });
});

describe('textColorFor', () => {
  it('明るい地には濃い文字、暗い地には明るい文字', () => {
    expect(textColorFor('#ffffff')).toBe('#3d434a');
    expect(textColorFor('#2a2f36')).toBe('#eceef0');
  });
});
