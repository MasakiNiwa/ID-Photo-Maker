import * as Dialog from '@radix-ui/react-dialog';
import { Camera, SwitchCamera, Timer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';

/**
 * getUserMedia によるカメラ撮影。顔の位置ガイドを重ね、セルフタイマーにも対応。
 * 撮影中は Screen Wake Lock で画面が消えないようにする。
 */
export function CameraDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [timer, setTimer] = useState(false);
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
          setReady(true);
        }
        lock = await navigator.wakeLock?.request('screen').catch(() => undefined);
      } catch {
        toast('カメラを起動できませんでした。権限の設定を確認してください。', { tone: 'error' });
        onOpenChange(false);
      }
    })();
    return () => {
      cancelled = true;
      for (const t of stream?.getTracks() ?? []) t.stop();
      void lock?.release();
    };
  }, [open, facing, onOpenChange]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    navigator.vibrate?.(20);
    c.toBlob(
      (b) => {
        if (b) {
          onCapture(b);
          onOpenChange(false);
        }
      },
      'image/jpeg',
      0.95,
    );
  };

  const onShutter = () => {
    if (!timer) return shoot();
    let n = 3;
    setCount(n);
    const id = setInterval(() => {
      n--;
      setCount(n);
      if (n <= 0) {
        clearInterval(id);
        shoot();
      }
    }, 1000);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="camera">
          <Dialog.Title className="visually-hidden">カメラで撮影</Dialog.Title>
          <Dialog.Description className="visually-hidden">
            顔をガイドの楕円に合わせて撮影してください
          </Dialog.Description>
          <div className="camera-view">
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
            {ready && <div className="camera-guide" aria-hidden />}
            {count > 0 && <div className="camera-count">{count}</div>}
          </div>
          <p className="camera-hint">
            顔を楕円に合わせ、正面を向いて撮影してください。明るく影の少ない場所がおすすめです。
          </p>
          <div className="camera-bar">
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="閉じる">
                <X />
              </button>
            </Dialog.Close>
            <button
              type="button"
              className={`icon-btn ${timer ? 'is-active' : ''}`}
              onClick={() => setTimer((t) => !t)}
              aria-pressed={timer}
              aria-label="3秒セルフタイマー"
            >
              <Timer />
            </button>
            <button
              type="button"
              className="shutter"
              onClick={onShutter}
              disabled={!ready || count > 0}
              aria-label="撮影"
            >
              <Camera />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
              aria-label="カメラを切り替え"
            >
              <SwitchCamera />
            </button>
            <span style={{ width: 44 }} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
