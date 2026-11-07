import { describe, expect, it } from 'vitest';
import { alphaLut, blurMask, padMask, smoothstep } from './mask';

describe('mask', () => {
  it('smoothstep の端と中央', () => {
    expect(smoothstep(0.4, 0.6, 0.3)).toBe(0);
    expect(smoothstep(0.4, 0.6, 0.7)).toBe(1);
    expect(smoothstep(0.4, 0.6, 0.5)).toBeCloseTo(0.5);
  });
  it('ぼかしで段差がなだらかになり、一様な領域は変わらない', () => {
    const data = new Uint8Array(8 * 8);
    for (let y = 0; y < 8; y++) for (let x = 4; x < 8; x++) data[y * 8 + x] = 255;
    const b = blurMask({ width: 8, height: 8, data });
    expect(b[3 * 8 + 0]).toBe(0);
    expect(b[3 * 8 + 7]).toBe(255);
    expect(b[3 * 8 + 3] ?? 0).toBeGreaterThan(0);
    expect(b[3 * 8 + 4] ?? 0).toBeLessThan(255);
  });
  it('padMask は端の値で延長する', () => {
    const data = new Uint8Array([10, 20, 30, 40]);
    const r = padMask({ width: 2, height: 2, data }, 0.5, 1);
    expect(r.mask.width).toBe(4);
    expect(r.mask.height).toBe(6);
    expect(r.fx).toBe(0.5);
    expect(r.mask.data[0]).toBe(0);
    expect(r.mask.data[2 * 4]).toBe(10);
    expect(r.mask.data[r.mask.data.length - 1]).toBe(40);
  });
  it('topAsBackground=false なら上も端の値で延長する', () => {
    const r = padMask({ width: 2, height: 2, data: new Uint8Array([10, 20, 30, 40]) }, 0.5, 1, false);
    expect(r.mask.data[0]).toBe(10);
  });
  it('しきい値を上げると同じ値でも透明寄りになる', () => {
    const lo = alphaLut({ threshold: 0.4, softness: 0.1 });
    const hi = alphaLut({ threshold: 0.6, softness: 0.1 });
    expect(lo[128] ?? 0).toBeGreaterThan(hi[128] ?? 0);
    expect(lo[0]).toBe(0);
    expect(hi[255]).toBe(255);
  });
});
