import type { CSSProperties } from 'react';
import { Segmented } from '@/components/controls';
import { applyTheme, PATTERNS, type PatternKind, SHEET_THEMES, type SheetDesign } from '@/domain/sheetDesign';
import { useSettings } from '@/stores/settings';

/** テーマの見本（CSS で柄を近似表示） */
export function patternStyle(
  d: Pick<SheetDesign, 'baseColor' | 'accentColor' | 'pattern' | 'gradient'>,
): CSSProperties {
  const a = d.gradient ? d.baseColor : d.accentColor;
  const bg = d.gradient ? `linear-gradient(160deg, ${d.baseColor}, ${d.accentColor})` : d.baseColor;
  const layers: Record<PatternKind, string | null> = {
    none: null,
    dots: `radial-gradient(${a} 22%, transparent 24%) 0 0 / 8px 8px`,
    grid: `linear-gradient(${a} 1px, transparent 1px) 0 0 / 8px 8px, linear-gradient(90deg, ${a} 1px, transparent 1px) 0 0 / 8px 8px`,
    stripes: `repeating-linear-gradient(45deg, ${a} 0 2px, transparent 2px 7px)`,
    check: `linear-gradient(90deg, ${a}99 50%, transparent 50%) 0 0 / 12px 12px, linear-gradient(${a}99 50%, transparent 50%) 0 0 / 12px 12px`,
    waves: `radial-gradient(circle at 50% 100%, transparent 40%, ${a} 42%, ${a} 48%, transparent 50%) 0 0 / 12px 6px`,
  };
  const layer = layers[d.pattern];
  return { background: layer ? `${layer}, ${bg}` : bg };
}

export function SheetDesignPanel({ captionFits, overflow }: { captionFits: boolean; overflow: number }) {
  const d = useSettings((s) => s.sheetDesign);
  const set = useSettings((s) => s.setSheetDesign);
  const hasText = d.caption.trim() !== '' || d.showDate || d.showSizes;

  return (
    <div className="stack">
      <div className="theme-grid" role="listbox" aria-label="用紙のテーマ">
        {SHEET_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="option"
            aria-selected={d.themeId === t.id}
            className="theme-option"
            onClick={() => set(applyTheme(d, t))}
          >
            <span className="theme-swatch" style={patternStyle(t.design)} aria-hidden />
            <span className="theme-name">{t.name}</span>
          </button>
        ))}
      </div>

      <details className="design-more">
        <summary>色と柄をカスタマイズ</summary>
        <div className="stack">
          <div className="row">
            <label className="color-field">
              <input
                type="color"
                value={d.baseColor}
                onChange={(e) => set({ baseColor: e.target.value, themeId: 'custom' })}
              />
              地の色
            </label>
            <label className="color-field">
              <input
                type="color"
                value={d.accentColor}
                onChange={(e) => set({ accentColor: e.target.value, themeId: 'custom' })}
              />
              柄の色
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={d.gradient}
                onChange={(e) => set({ gradient: e.target.checked, themeId: 'custom' })}
              />
              グラデーション
            </label>
          </div>
          <div className="pattern-grid">
            {PATTERNS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="pattern-option"
                aria-pressed={d.pattern === p.value}
                onClick={() => set({ pattern: p.value, themeId: 'custom' })}
              >
                <span className="theme-swatch" style={patternStyle({ ...d, pattern: p.value })} aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={d.photoMat}
              onChange={(e) => set({ photoMat: e.target.checked })}
            />
            写真のまわりを白く抜く（柄があるときにカットしやすくなります）
          </label>
        </div>
      </details>

      <div className="field">
        <span className="field-label">写真の配置</span>
        <Segmented
          label="写真の配置"
          value={d.valign}
          options={[
            { value: 'center', label: '中央' },
            { value: 'top', label: '上に寄せる' },
          ]}
          onChange={(v) => set({ valign: v })}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="sheet-caption">
          空きスペースに入れる文字
        </label>
        <input
          id="sheet-caption"
          className="input"
          maxLength={40}
          value={d.caption}
          placeholder="例：山田 太郎（任意）"
          onChange={(e) => set({ caption: e.target.value })}
        />
        <div className="row">
          <label className="check-field">
            <input
              type="checkbox"
              checked={d.showDate}
              onChange={(e) => set({ showDate: e.target.checked })}
            />
            作成日
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={d.showSizes}
              onChange={(e) => set({ showSizes: e.target.checked })}
            />
            サイズ一覧
          </label>
        </div>
        {hasText && (
          <p className="hint">文字を入れると、用紙の下側にその分のスペースを確保して写真を並べます。</p>
        )}
        {hasText && overflow > 0 && (
          <p className="notice notice-warn">
            文字のスペースを確保したため、{overflow}
            枚が用紙に入りきりません。「レイアウト」で枚数を調整してください。
          </p>
        )}
        {hasText && !captionFits && (
          <p className="notice notice-warn">
            文字を入れる空きがありません。「上に寄せる」にするか、枚数を減らしてください。
          </p>
        )}
      </div>
    </div>
  );
}
