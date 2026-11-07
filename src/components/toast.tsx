import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import './toast.css';

interface Toast {
  id: number;
  message: string;
  tone?: 'default' | 'error';
  action?: { label: string; run: () => void };
  duration?: number;
}

const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let seq = 0;

export function toast(message: string, opts: Omit<Toast, 'id' | 'message'> = {}): void {
  const t = { id: ++seq, message, ...opts };
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), t] }));
}

function dismiss(id: number) {
  useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));
}

function ToastItem({ t }: { t: Toast }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Web Animations API: 表示 → 待機 → 退場 を1本のタイムラインで制御。
    // ホバー中は一時停止し、離すと再開する。
    const anim = el.animate(
      [
        { opacity: 0, transform: 'translateY(12px) scale(0.98)', offset: 0 },
        { opacity: 1, transform: 'none', offset: 0.06 },
        { opacity: 1, transform: 'none', offset: 0.92 },
        { opacity: 0, transform: 'translateY(6px)', offset: 1 },
      ],
      { duration: t.duration ?? (t.action ? 8000 : 3200), easing: 'ease-out', fill: 'forwards' },
    );
    anim.onfinish = () => dismiss(t.id);
    const pause = () => anim.pause();
    const play = () => anim.play();
    el.addEventListener('pointerenter', pause);
    el.addEventListener('pointerleave', play);
    return () => anim.cancel();
  }, [t]);
  return (
    <div ref={ref} className={`toast ${t.tone === 'error' ? 'toast-error' : ''}`} role="status">
      <span>{t.message}</span>
      {t.action && (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            t.action?.run();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toaster" aria-live="polite">
      {items.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
