import { describe, expect, it } from 'vitest';
import { boxFilter, guidedFilter } from './guidedFilter';

describe('boxFilter', () => {
  it('一様な画像は変わらない', () => {
    const a = new Float32Array(25).fill(0.4);
    for (const v of boxFilter(a, 5, 5, 2)) expect(v).toBeCloseTo(0.4);
  });
  it('平均をとる', () => {
    const a = new Float32Array([0, 0, 1, 0, 0]);
    const o = boxFilter(a, 5, 1, 1);
    expect(o[2]).toBeCloseTo(1 / 3);
    expect(o[0]).toBeCloseTo(0);
  });
});

describe('guidedFilter', () => {
  it('ぼやけたマスクを、ガイド画像のくっきりした境界に寄せる', () => {
    const w = 40;
    const h = 8;
    const n = w * h;
    const r = new Float32Array(n);
    const p = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        r[y * w + x] = x < 20 ? 0.1 : 0.9; // 画像の境界は x=20
        p[y * w + x] = Math.min(1, Math.max(0, (x - 12) / 16)); // マスクは x=12〜28 でゆるやか
      }
    }
    const q = guidedFilter({ r, g: r, b: r }, p, w, h, 6, 1e-4);
    const at = (arr: Float32Array, x: number) => arr[4 * w + x] ?? 0;
    expect(at(q, 17)).toBeLessThan(at(p, 17));
    expect(at(q, 23)).toBeGreaterThan(at(p, 23));
  });
});
