/**
 * 用紙の空きスペースのデザイン（背景・柄・文字）。
 * テーマはデータとして登録するだけで追加できる。
 */
export type PatternKind = 'none' | 'dots' | 'grid' | 'stripes' | 'check' | 'waves';

export interface SheetDesign {
  themeId: string;
  /** 用紙の地の色 */
  baseColor: string;
  /** 柄・グラデーションの色 */
  accentColor: string;
  pattern: PatternKind;
  gradient: boolean;
  /** 写真のまわりを白く抜く（柄の上でもカットしやすくする） */
  photoMat: boolean;
  /** 写真を上に寄せて、下側に文字やデザインのスペースを作る */
  valign: 'center' | 'top';
  caption: string;
  showDate: boolean;
  showSizes: boolean;
}

export interface SheetTheme {
  id: string;
  name: string;
  design: Pick<SheetDesign, 'baseColor' | 'accentColor' | 'pattern' | 'gradient'>;
}

export const SHEET_THEMES: readonly SheetTheme[] = [
  {
    id: 'white',
    name: '白',
    design: { baseColor: '#ffffff', accentColor: '#e6e9ed', pattern: 'none', gradient: false },
  },
  {
    id: 'cream',
    name: 'クリーム',
    design: { baseColor: '#fbf7ef', accentColor: '#efe4cf', pattern: 'none', gradient: false },
  },
  {
    id: 'mist',
    name: 'ミスト',
    design: { baseColor: '#f1f5f8', accentColor: '#d9e4ee', pattern: 'none', gradient: true },
  },
  {
    id: 'sakura',
    name: 'さくら',
    design: { baseColor: '#fcf3f3', accentColor: '#ecd3d6', pattern: 'dots', gradient: false },
  },
  {
    id: 'mint',
    name: 'ミント',
    design: { baseColor: '#f2f7f3', accentColor: '#d4e6d9', pattern: 'grid', gradient: false },
  },
  {
    id: 'slate',
    name: 'スレート',
    design: { baseColor: '#f3f4f7', accentColor: '#dde2ea', pattern: 'stripes', gradient: false },
  },
  {
    id: 'gingham',
    name: 'ギンガム',
    design: { baseColor: '#ffffff', accentColor: '#e3eaf2', pattern: 'check', gradient: false },
  },
  {
    id: 'sand',
    name: 'サンド',
    design: { baseColor: '#f8f5f0', accentColor: '#e6dccd', pattern: 'waves', gradient: false },
  },
  {
    id: 'night',
    name: 'ナイト',
    design: { baseColor: '#2a2f36', accentColor: '#3a414a', pattern: 'dots', gradient: true },
  },
];

export const PATTERNS: readonly { value: PatternKind; label: string }[] = [
  { value: 'none', label: '無地' },
  { value: 'dots', label: 'ドット' },
  { value: 'grid', label: '方眼' },
  { value: 'stripes', label: 'ストライプ' },
  { value: 'check', label: 'チェック' },
  { value: 'waves', label: '波' },
];

export const DEFAULT_SHEET_DESIGN: SheetDesign = {
  themeId: 'white',
  ...(SHEET_THEMES[0] as SheetTheme).design,
  photoMat: true,
  valign: 'center',
  caption: '',
  showDate: false,
  showSizes: false,
};

export function applyTheme(design: SheetDesign, theme: SheetTheme): SheetDesign {
  return { ...design, ...theme.design, themeId: theme.id };
}

/** 相対輝度（0〜1） */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return 1;
  const n = Number.parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
}

/** 地の色に対して読みやすい文字色 */
export function textColorFor(base: string): string {
  return luminance(base) > 0.35 ? '#3d434a' : '#eceef0';
}

export function isDarkBase(base: string): boolean {
  return luminance(base) <= 0.35;
}

export interface TextLine {
  text: string;
  sizeMm: number;
  bold?: boolean;
}

export interface PlacedText extends TextLine {
  /** ベースライン位置（mm）と中心X（mm） */
  xMm: number;
  yMm: number;
}

/** 用紙に入れる文字の行を組み立てる（行の高さは内容によらず一定） */
export function buildCaptionLines(
  design: Pick<SheetDesign, 'caption' | 'showDate' | 'showSizes'>,
  sizes: readonly { name: string; widthMm: number; heightMm: number; count: number }[],
  date: Date,
): TextLine[] {
  const lines: TextLine[] = [];
  const caption = design.caption.trim();
  if (caption) lines.push({ text: caption, sizeMm: 3.6, bold: true });
  const meta: string[] = [];
  if (design.showDate) meta.push(date.toLocaleDateString('ja-JP'));
  if (design.showSizes) {
    meta.push(
      sizes
        .filter((s) => s.count > 0)
        .map((s) => `${s.name} ${s.widthMm}×${s.heightMm}mm ×${s.count}`)
        .join(' / '),
    );
  }
  if (meta.length) lines.push({ text: meta.join('　'), sizeMm: 2.3 });
  return lines;
}

const LINE_GAP = 1.2;
const CAPTION_PAD = 1.5;

/** 文字の行が必要とする高さ（mm、上下の余白込み） */
export function captionHeight(lines: readonly TextLine[]): number {
  if (lines.length === 0) return 0;
  return lines.reduce((a, l) => a + l.sizeMm, 0) + LINE_GAP * (lines.length - 1) + CAPTION_PAD * 2;
}

/**
 * 写真の配置から上下の空き帯を求め、文字を収まる方（下を優先）に置く。
 * 収まらなければ null。
 */
export function placeCaption(
  lines: readonly TextLine[],
  placements: readonly { yMm: number; heightMm: number }[],
  sheet: { widthMm: number; heightMm: number },
  marginMm: number,
  gapMm: number,
): PlacedText[] | null {
  if (lines.length === 0) return [];
  const lineGap = LINE_GAP;
  const need = captionHeight(lines) - CAPTION_PAD * 2;
  const top = placements.length ? Math.min(...placements.map((p) => p.yMm)) : sheet.heightMm / 2;
  const bottom = placements.length
    ? Math.max(...placements.map((p) => p.yMm + p.heightMm))
    : sheet.heightMm / 2;
  const pad = Math.max(CAPTION_PAD, gapMm);
  const bands: [number, number][] = [
    [bottom + pad, sheet.heightMm - marginMm],
    [marginMm, top - pad],
  ];
  const band = bands.find(([a, b]) => b - a >= need);
  if (!band) return null;
  let y = (band[0] + band[1]) / 2 - need / 2;
  const cx = sheet.widthMm / 2;
  return lines.map((l) => {
    y += l.sizeMm;
    const placed = { ...l, xMm: cx, yMm: y - l.sizeMm * 0.18 };
    y += lineGap;
    return placed;
  });
}
