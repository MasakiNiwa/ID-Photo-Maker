/**
 * 用紙への面付け（複数サイズ混在）エンジン。
 * First-Fit Decreasing Height による棚詰め（shelf packing）で配置する。
 * 純粋関数なので単体テスト可能で、描画（Worker）とは独立。
 */
export interface LayoutItem {
  key: string;
  widthMm: number;
  heightMm: number;
  count: number;
}

export interface LayoutOptions {
  sheetWidthMm: number;
  sheetHeightMm: number;
  /** 用紙端からの余白（フチなし印刷で切れる分を見込む） */
  marginMm: number;
  /** 写真同士の間隔（カットしろ） */
  gapMm: number;
  /** 配置ブロックを用紙中央に寄せる */
  center: boolean;
  /** 縦方向の寄せ（既定: center に従う）。top で下側に空きを作る */
  valign?: 'center' | 'top';
}

export interface Placement {
  key: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface LayoutResult {
  placements: Placement[];
  /** 入りきらなかった枚数（key ごと） */
  overflow: Record<string, number>;
  overflowTotal: number;
}

interface Shelf {
  y: number;
  height: number;
  cursorX: number;
  items: Placement[];
}

const EPS = 1e-6;

/**
 * 行方向（横に並べて段を重ねる）と列方向（縦に並べて列を重ねる）の両方を試し、
 * 多く入る方（同数なら配置がコンパクトな方）を採用する。
 */
export function computeLayout(items: readonly LayoutItem[], opt: LayoutOptions): LayoutResult {
  const rows = shelfLayout(items, opt);
  if (rows.overflowTotal === 0 && items.length <= 1) return align(rows, opt);
  const transposed = shelfLayout(
    items.map((i) => ({ ...i, widthMm: i.heightMm, heightMm: i.widthMm })),
    { ...opt, sheetWidthMm: opt.sheetHeightMm, sheetHeightMm: opt.sheetWidthMm },
  );
  const cols: LayoutResult = {
    ...transposed,
    placements: transposed.placements.map((p) => ({
      key: p.key,
      xMm: p.yMm,
      yMm: p.xMm,
      widthMm: p.heightMm,
      heightMm: p.widthMm,
    })),
  };
  return align(cols.overflowTotal < rows.overflowTotal ? cols : rows, opt);
}

/** 配置ブロック全体を中央（または上寄せ）に移動する */
function align(r: LayoutResult, opt: LayoutOptions): LayoutResult {
  if (!opt.center || r.placements.length === 0) return r;
  const minX = Math.min(...r.placements.map((p) => p.xMm));
  const maxX = Math.max(...r.placements.map((p) => p.xMm + p.widthMm));
  const minY = Math.min(...r.placements.map((p) => p.yMm));
  const maxY = Math.max(...r.placements.map((p) => p.yMm + p.heightMm));
  const dx = (opt.sheetWidthMm - (maxX - minX)) / 2 - minX;
  const dy = opt.valign === 'top' ? opt.marginMm - minY : (opt.sheetHeightMm - (maxY - minY)) / 2 - minY;
  return { ...r, placements: r.placements.map((p) => ({ ...p, xMm: p.xMm + dx, yMm: p.yMm + dy })) };
}

function shelfLayout(items: readonly LayoutItem[], opt: LayoutOptions): LayoutResult {
  const areaW = opt.sheetWidthMm - opt.marginMm * 2;
  const areaH = opt.sheetHeightMm - opt.marginMm * 2;
  const overflow: Record<string, number> = {};
  let overflowTotal = 0;

  // 個々の写真に展開し、高さ降順（同じなら幅降順）に並べる。安定ソート。
  const pieces = items
    .flatMap((it) => Array.from({ length: Math.max(0, Math.floor(it.count)) }, () => it))
    .sort((a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm);

  const shelves: Shelf[] = [];
  let nextY = 0;

  for (const p of pieces) {
    let placed = false;
    if (p.widthMm <= areaW + EPS && p.heightMm <= areaH + EPS) {
      for (const s of shelves) {
        const x = s.items.length ? s.cursorX + opt.gapMm : 0;
        if (p.heightMm <= s.height + EPS && x + p.widthMm <= areaW + EPS) {
          s.items.push({ key: p.key, xMm: x, yMm: s.y, widthMm: p.widthMm, heightMm: p.heightMm });
          s.cursorX = x + p.widthMm;
          placed = true;
          break;
        }
      }
      if (!placed) {
        const y = shelves.length ? nextY + opt.gapMm : 0;
        if (y + p.heightMm <= areaH + EPS) {
          shelves.push({
            y,
            height: p.heightMm,
            cursorX: p.widthMm,
            items: [{ key: p.key, xMm: 0, yMm: y, widthMm: p.widthMm, heightMm: p.heightMm }],
          });
          nextY = y + p.heightMm;
          placed = true;
        }
      }
    }
    if (!placed) {
      overflow[p.key] = (overflow[p.key] ?? 0) + 1;
      overflowTotal++;
    }
  }

  const placements = shelves.flatMap((s) => s.items);
  for (const p of placements) {
    p.xMm += opt.marginMm;
    p.yMm += opt.marginMm;
  }
  return { placements, overflow, overflowTotal };
}

/** 指定 key の写真を、既存の配置を崩さずに何枚まで追加できるか */
export function maxAdditional(
  items: readonly LayoutItem[],
  key: string,
  opt: LayoutOptions,
  limit = 200,
): number {
  const target = items.find((i) => i.key === key);
  if (!target) return 0;
  const base = items.map((i) => ({ ...i }));
  const t = base.find((i) => i.key === key) as LayoutItem;
  const start = t.count;
  if (computeLayout(base, opt).overflowTotal > 0) return 0;
  let lo = 0;
  let hi = limit;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    t.count = start + mid;
    if (computeLayout(base, opt).overflowTotal === 0) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
