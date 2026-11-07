import { describe, expect, it } from 'vitest';
import { readJpegDpi, setJpegDpi } from './jpeg';

const jfif = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01,
  0x00, 0x00, 0xff, 0xd9,
]);

describe('setJpegDpi', () => {
  it('既存の JFIF の解像度を書き換える', () => {
    const out = setJpegDpi(jfif, 350);
    expect(out.length).toBe(jfif.length);
    expect(readJpegDpi(out)).toBe(350);
  });
  it('APP0 が無ければ挿入する', () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
    const out = setJpegDpi(bare, 300);
    expect(out.length).toBe(bare.length + 18);
    expect(readJpegDpi(out)).toBe(300);
    expect(out[out.length - 1]).toBe(0xd9);
  });
  it('JPEG 以外はエラー', () => {
    expect(() => setJpegDpi(new Uint8Array([1, 2, 3]), 300)).toThrow();
  });
});
