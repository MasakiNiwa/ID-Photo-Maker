/**
 * JPEG の JFIF APP0 セグメントに解像度（dpi）を書き込む。
 * 印刷ソフトやコンビニのプリント機が実寸を正しく解釈できるようにするため。
 */
export function setJpegDpi(bytes: Uint8Array, dpi: number): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('JPEGではありません');
  const d = Math.round(dpi) & 0xffff;
  const isJfif =
    bytes[2] === 0xff &&
    bytes[3] === 0xe0 &&
    bytes[6] === 0x4a &&
    bytes[7] === 0x46 &&
    bytes[8] === 0x49 &&
    bytes[9] === 0x46 &&
    bytes[10] === 0x00;
  if (isJfif) {
    const out = bytes.slice();
    out[13] = 1; // 単位: dots per inch
    out[14] = d >> 8;
    out[15] = d & 0xff;
    out[16] = d >> 8;
    out[17] = d & 0xff;
    return out;
  }
  // APP0 が無い場合は SOI の直後に挿入する
  const app0 = new Uint8Array([
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    d >> 8,
    d & 0xff,
    d >> 8,
    d & 0xff,
    0x00,
    0x00,
  ]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

export function readJpegDpi(bytes: Uint8Array): number | null {
  if (bytes[2] !== 0xff || bytes[3] !== 0xe0 || bytes[13] !== 1) return null;
  return ((bytes[14] ?? 0) << 8) | (bytes[15] ?? 0);
}
