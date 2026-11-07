import { useEffect, useSyncExternalStore } from 'react';
import { type ThemeMode, useSettings } from '@/stores/settings';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function subscribe(cb: () => void) {
  media.addEventListener('change', cb);
  return () => media.removeEventListener('change', cb);
}

export function resolveTheme(mode: ThemeMode, systemDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

export function useResolvedTheme(): 'light' | 'dark' {
  const mode = useSettings((s) => s.theme);
  const systemDark = useSyncExternalStore(subscribe, () => media.matches);
  return resolveTheme(mode, systemDark);
}

/** <html data-theme> と theme-color を同期する */
export function useApplyTheme(): void {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme-hint', theme);
    } catch {
      // プライベートモード等では無視
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  }, [theme]);
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * View Transitions API + Web Animations API で、押したボタンの位置から
 * 円形に新しいテーマが広がるように切り替える。
 */
export function switchThemeWithTransition(next: ThemeMode, origin?: { x: number; y: number }): void {
  const apply = () => useSettings.getState().set({ theme: next });
  if (!document.startViewTransition || reduceMotion()) {
    apply();
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-transition');
  const t = document.startViewTransition(() => {
    apply();
    root.dataset.theme = resolveTheme(next, media.matches);
  });
  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 28;
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  t.ready
    .then(() =>
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        {
          duration: 420,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      ),
    )
    .catch(() => {});
  t.finished.finally(() => root.classList.remove('theme-transition'));
}
