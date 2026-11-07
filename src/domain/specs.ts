/**
 * 証明写真の規格定義。すべて mm 単位の純粋なデータで、描画とは独立している。
 * guide は「頭頂〜あご」の目安（mm）で、編集画面のガイド線に使う。
 */
export interface PhotoGuide {
  /** 写真上端から頭頂までの余白 [最小, 最大] mm */
  topMarginMm: [number, number];
  /** 頭頂からあごまでの長さ [最小, 最大] mm */
  headHeightMm: [number, number];
}

export interface PhotoSpec {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  /** 用途の補足 */
  note?: string;
  guide?: PhotoGuide;
  custom?: boolean;
}

/** 頭の比率から汎用ガイドを作る（履歴書などの一般的な目安） */
export function ratioGuide(heightMm: number, top = [0.08, 0.14], head = [0.6, 0.7]): PhotoGuide {
  const r = (v: number) => Math.round(v * heightMm * 10) / 10;
  return {
    topMarginMm: [r(top[0] ?? 0), r(top[1] ?? 0)],
    headHeightMm: [r(head[0] ?? 0), r(head[1] ?? 0)],
  };
}

export const PRESET_SPECS: readonly PhotoSpec[] = [
  {
    id: 'resume',
    name: '履歴書・受験票',
    widthMm: 30,
    heightMm: 40,
    note: '履歴書、エントリーシート、各種試験の受験票など',
    guide: ratioGuide(40),
  },
  {
    id: 'passport',
    name: 'パスポート',
    widthMm: 35,
    heightMm: 45,
    note: '日本の旅券。頭頂〜あご 34±2mm、上余白 4±2mm',
    guide: { topMarginMm: [2, 6], headHeightMm: [32, 36] },
  },
  {
    id: 'mynumber',
    name: 'マイナンバーカード',
    widthMm: 35,
    heightMm: 45,
    note: 'マイナンバーカード申請用',
    guide: { topMarginMm: [2, 6], headHeightMm: [30, 36] },
  },
  {
    id: 'license',
    name: '運転免許証',
    widthMm: 24,
    heightMm: 30,
    note: '運転免許の申請・更新用',
    guide: ratioGuide(30),
  },
  {
    id: 'residence',
    name: '在留カード',
    widthMm: 30,
    heightMm: 40,
    note: '在留カード・特別永住者証明書など',
    guide: ratioGuide(40),
  },
  {
    id: 'small',
    name: '社員証・学生証',
    widthMm: 24,
    heightMm: 30,
    note: '社員証、学生証、各種資格証など',
    guide: ratioGuide(30),
  },
  {
    id: 'license-large',
    name: '大判（40×50）',
    widthMm: 40,
    heightMm: 50,
    note: '一部の資格試験・ビザなど',
    guide: ratioGuide(50),
  },
  {
    id: 'visa-45x55',
    name: 'ビザ（45×55）',
    widthMm: 45,
    heightMm: 55,
    note: '一部の国のビザ申請',
    guide: ratioGuide(55),
  },
  {
    id: 'china-visa',
    name: '中国ビザ',
    widthMm: 33,
    heightMm: 48,
    note: '頭頂〜あご 28〜33mm、上余白 3〜5mm',
    guide: { topMarginMm: [3, 5], headHeightMm: [28, 33] },
  },
  {
    id: 'us-visa',
    name: '米国ビザ（2×2インチ）',
    widthMm: 51,
    heightMm: 51,
    note: '頭頂〜あご 25〜35mm',
    guide: { topMarginMm: [5, 13], headHeightMm: [25, 35] },
  },
];

export const CUSTOM_LIMITS = { minMm: 10, maxMm: 150 } as const;

export function createCustomSpec(name: string, widthMm: number, heightMm: number): PhotoSpec {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: name.trim() || `カスタム ${widthMm}×${heightMm}`,
    widthMm,
    heightMm,
    guide: ratioGuide(heightMm),
    custom: true,
  };
}

export function isValidCustomSize(mm: number): boolean {
  return Number.isFinite(mm) && mm >= CUSTOM_LIMITS.minMm && mm <= CUSTOM_LIMITS.maxMm;
}

export function formatSize(spec: { widthMm: number; heightMm: number }): string {
  return `${spec.widthMm}×${spec.heightMm}mm`;
}
