import { Camera, ImagePlus, ShieldCheck } from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { CameraDialog } from './CameraDialog';

/** 写真の読み込み（ファイル選択・ドラッグ&ドロップ・貼り付け・カメラ） */
export function useImagePaste(onFile: (f: File) => void) {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);
}

export function useFilePicker(onFile: (f: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onFile(f);
        e.target.value = '';
      }}
    />
  );
  return { input, open: () => inputRef.current?.click() };
}

export function ImageDropzone({ onFile, busy }: { onFile: (f: Blob, name?: string) => void; busy: boolean }) {
  const [over, setOver] = useState(false);
  const [camera, setCamera] = useState(false);
  const picker = useFilePicker(onFile);
  const hasCamera = typeof navigator.mediaDevices?.getUserMedia === 'function';

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    if (f) onFile(f);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: ドラッグ&ドロップの受け口（ボタンでも操作可能）
    <section
      className={`dropzone ${over ? 'is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      aria-busy={busy}
    >
      <div className="dropzone-art" aria-hidden>
        <ImagePlus size={36} />
      </div>
      <h1 className="dropzone-title">証明写真を作りましょう</h1>
      <p className="dropzone-desc">
        顔写真を選ぶと、規格サイズへの切り抜き・色の調整・印刷用レイアウトまでこのアプリだけで完結します。
      </p>
      <div className="dropzone-actions">
        <button type="button" className="btn btn-primary" onClick={picker.open} disabled={busy}>
          <ImagePlus size={18} /> 写真を選ぶ
        </button>
        {hasCamera && (
          <button type="button" className="btn" onClick={() => setCamera(true)} disabled={busy}>
            <Camera size={18} /> カメラで撮影
          </button>
        )}
      </div>
      <p className="hint">ここにドラッグ&ドロップ、または貼り付け（Ctrl+V / ⌘V）でも読み込めます</p>
      <p className="dropzone-privacy">
        <ShieldCheck size={16} /> 写真は端末内だけで処理され、外部に送信されません
      </p>
      {picker.input}
      <CameraDialog open={camera} onOpenChange={setCamera} onCapture={(b) => onFile(b, 'camera.jpg')} />
    </section>
  );
}
