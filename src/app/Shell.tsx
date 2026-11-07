import { CircleHelp, Moon, Printer, Settings, Sparkles, Sun } from 'lucide-react';
import type { MouseEvent } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Toaster } from '@/components/toast';
import { switchThemeWithTransition, useApplyTheme, useResolvedTheme } from '@/lib/theme';
import { UpdatePrompt } from './UpdatePrompt';
import './shell.css';

const NAV = [
  { to: '/', label: '作成', icon: Sparkles, end: true },
  { to: '/print', label: '印刷', icon: Printer, end: false },
  { to: '/settings', label: '設定', icon: Settings, end: false },
] as const;

function AppIcon() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect x="4" y="2" width="24" height="28" rx="4" fill="var(--accent)" />
      <circle cx="16" cy="13" r="5" fill="var(--on-accent)" />
      <path d="M7.5 27c1-5 4.5-7.5 8.5-7.5s7.5 2.5 8.5 7.5z" fill="var(--on-accent)" />
    </svg>
  );
}

export function Shell() {
  useApplyTheme();
  const theme = useResolvedTheme();

  const toggleTheme = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    switchThemeWithTransition(theme === 'dark' ? 'light' : 'dark', {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    });
  };

  return (
    <div className="shell">
      <header className="app-header">
        <NavLink to="/" viewTransition className="brand" aria-label="証明写真 ID Photo Maker ホーム">
          <AppIcon />
          <span className="brand-text">
            <span className="brand-name">証明写真</span>
            <span className="brand-sub">ID Photo Maker</span>
          </span>
        </NavLink>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            title={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
          >
            {theme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}
          </button>
          <NavLink
            to="/help"
            viewTransition
            className={({ isActive }) => `icon-btn ${isActive ? 'is-active' : ''}`}
            aria-label="ヘルプ"
            title="ヘルプ"
          >
            <CircleHelp size={22} />
          </NavLink>
        </div>
      </header>

      <nav className="app-nav" aria-label="メインメニュー">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} viewTransition className="nav-item">
            <span className="nav-icon">
              <Icon size={22} />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
      <Toaster />
      <UpdatePrompt />
    </div>
  );
}
