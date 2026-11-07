/** ファイルを保存する（ダウンロード） */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function canShareFiles(): boolean {
  try {
    const f = new File([new Uint8Array([0xff, 0xd8])], 'x.jpg', { type: 'image/jpeg' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

/**
 * Web Share API で他アプリ（コンビニのプリントアプリ、写真アプリ等）へ渡す。
 * キャンセル時は false を返す。
 */
export async function shareBlob(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}

/**
 * ファイル名は ASCII のみにする（一部のブラウザやプリントサービスで日本語名が扱えないため）
 */
export function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_');
}
