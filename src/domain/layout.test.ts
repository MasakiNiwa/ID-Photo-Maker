import { describe, expect, it } from 'vitest';
import { computeLayout, maxAdditional } from './layout';

const L = { sheetWidthMm: 89, sheetHeightMm: 127, marginMm: 2, gapMm: 1, center: true };

describe('computeLayout', () => {
  it('L判に30×40を6枚（2列×3段）配置できる', () => {
    const r = computeLayout([{ key: 'a', widthMm: 30, heightMm: 40, count: 6 }], L);
    expect(r.overflowTotal).toBe(0);
    expect(r.placements).toHaveLength(6);
  });

  it('入りきらない分は overflow に計上する', () => {
    const r = computeLayout([{ key: 'a', widthMm: 30, heightMm: 40, count: 20 }], L);
    expect(r.placements.length + r.overflowTotal).toBe(20);
    expect(r.overflow.a).toBe(r.overflowTotal);
  });

  it('写真同士が重ならず、余白の内側に収まる', () => {
    const r = computeLayout(
      [
        { key: 'p', widthMm: 35, heightMm: 45, count: 2 },
        { key: 'r', widthMm: 30, heightMm: 40, count: 2 },
        { key: 'l', widthMm: 24, heightMm: 30, count: 3 },
      ],
      { ...L, center: false },
    );
    for (const a of r.placements) {
      expect(a.xMm).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(a.yMm).toBeGreaterThanOrEqual(2 - 1e-9);
      expect(a.xMm + a.widthMm).toBeLessThanOrEqual(87 + 1e-9);
      expect(a.yMm + a.heightMm).toBeLessThanOrEqual(125 + 1e-9);
      for (const b of r.placements) {
        if (a === b) continue;
        const overlap =
          a.xMm < b.xMm + b.widthMm - 1e-9 &&
          b.xMm < a.xMm + a.widthMm - 1e-9 &&
          a.yMm < b.yMm + b.heightMm - 1e-9 &&
          b.yMm < a.yMm + a.heightMm - 1e-9;
        expect(overlap).toBe(false);
      }
    }
  });

  it('中央寄せで左右の余白が等しくなる', () => {
    const r = computeLayout([{ key: 'a', widthMm: 30, heightMm: 40, count: 1 }], L);
    const p = r.placements[0];
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.xMm).toBeCloseTo((89 - 30) / 2);
    expect(p.yMm).toBeCloseTo((127 - 40) / 2);
  });

  it('サイズ混在では列方向の配置も試して多く入る方を選ぶ', () => {
    const r = computeLayout(
      [
        { key: 'p', widthMm: 35, heightMm: 45, count: 1 },
        { key: 'r', widthMm: 30, heightMm: 40, count: 4 },
      ],
      L,
    );
    expect(r.overflowTotal).toBe(0);
    expect(r.placements).toHaveLength(5);
  });

  it('用紙より大きい写真は配置しない', () => {
    const r = computeLayout([{ key: 'big', widthMm: 100, heightMm: 40, count: 1 }], L);
    expect(r.overflowTotal).toBe(1);
  });
});

describe('maxAdditional', () => {
  it('空きを埋められる最大枚数を返す', () => {
    const items = [{ key: 'a', widthMm: 30, heightMm: 40, count: 2 }];
    expect(maxAdditional(items, 'a', L)).toBe(4);
  });
});
