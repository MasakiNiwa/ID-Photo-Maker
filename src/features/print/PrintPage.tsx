import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Download, FileText, Loader2, Maximize2, Plus, Share2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { NumberField, Segmented, Stepper } from '@/components/controls';
import { toast } from '@/components/toast';
import { computeLayout, type LayoutItem, type LayoutOptions, maxAdditional } from '@/domain/layout';
import { findPaper, orient, PAPERS } from '@/domain/paper';
import { buildCaptionLines, captionHeight, placeCaption, textColorFor } from '@/domain/sheetDesign';
import { formatSize, type PhotoSpec } from '@/domain/specs';
import { canShareFiles, downloadBlob, safeFilename, shareBlob } from '@/lib/download';
import { useObjectUrl } from '@/lib/useObjectUrl';
import { renderSheet, type SheetPhotoRequests } from '@/render/pool';
import type { SheetDecoration } from '@/render/sheetBackground';
import type { CutLineStyle } from '@/render/types';
import { useProject } from '@/stores/project';
import { useSettings } from '@/stores/settings';
import { findSpec, useAllSpecs } from '@/stores/specs';
import { ColorFilterDefs } from '../editor/ColorFilter';
import { PhotoThumb } from '../editor/PhotoThumb';
import { SpecPicker } from '../editor/SpecPicker';
import { exportPdf } from './pdf';
import { SheetDesignPanel } from './SheetDesignPanel';
import './print.css';

const CUT_LINES: { value: CutLineStyle; label: string }[] = [
  { value: 'outline', label: '枠線' },
  { value: 'marks', label: 'トンボ' },
  { value: 'none', label: 'なし' },
];

/** プレビュー用の解像度（長辺がおよそ 1400px になる程度） */
function previewDpi(longMm: number): number {
  return Math.min(150, Math.max(60, Math.round(1400 / (longMm / 25.4))));
}

export function PrintPage() {
  const p = useProject();
  const s = useSettings();
  const specs = useAllSpecs();
  const imageUrl = useObjectUrl(p.imageBlob);
  const [adding, setAdding] = useState(false);
  const [panel, setPanel] = useState<'layout' | 'design'>('layout');
  const [busy, setBusy] = useState<false | 'jpeg' | 'pdf' | 'share'>(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [rendering, setRendering] = useState(false);
  const previewUrl = useObjectUrl(previewBlob);

  const paper = findPaper(s.paperId);
  const sheet = orient(paper, s.landscape);
  const entries = useMemo(
    () =>
      p.layout
        .map((e) => ({ entry: e, spec: findSpec(specs, e.specId) }))
        .filter((x): x is { entry: typeof x.entry; spec: PhotoSpec } => !!x.spec),
    [p.layout, specs],
  );
  // 空きスペースに入れる文字（文字があるときは用紙下部にその分の場所を確保する）
  const design = s.sheetDesign;
  const sizeRows = useMemo(
    () => entries.map(({ entry, spec }) => ({ ...spec, count: entry.count })),
    [entries],
  );
  const reserveMm = captionHeight(buildCaptionLines(design, sizeRows, new Date()));

  const opt: LayoutOptions = useMemo(
    () => ({
      sheetWidthMm: sheet.widthMm,
      sheetHeightMm: sheet.heightMm - reserveMm,
      marginMm: s.marginMm,
      gapMm: s.gapMm,
      center: true,
      valign: s.sheetDesign.valign,
    }),
    [sheet.widthMm, sheet.heightMm, reserveMm, s.marginMm, s.gapMm, s.sheetDesign.valign],
  );

  const items: LayoutItem[] = useMemo(
    () =>
      entries.map(({ entry, spec }) => ({
        key: spec.id,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
        count: entry.count,
      })),
    [entries],
  );
  const result = useMemo(() => computeLayout(items, opt), [items, opt]);

  // 空きスペースのデザイン（文字の位置は配置結果から決める）
  const decoration: SheetDecoration & { captionFits: boolean } = useMemo(() => {
    // サイズ一覧は実際に配置できた枚数で表記する
    const placed = sizeRows.map((r) => ({ ...r, count: r.count - (result.overflow[r.id] ?? 0) }));
    const lines = buildCaptionLines(design, placed, new Date());
    const texts = placeCaption(lines, result.placements, sheet, s.marginMm, s.gapMm);
    return {
      baseColor: design.baseColor,
      accentColor: design.accentColor,
      pattern: design.pattern,
      gradient: design.gradient,
      photoMat: design.photoMat,
      texts: texts ?? [],
      textColor: textColorFor(design.baseColor),
      captionFits: texts !== null,
    };
  }, [design, sizeRows, result, sheet, s.marginMm, s.gapMm]);

  // 印刷レイアウトに入っている規格の構図を用意する
  const activeSpec = findSpec(specs, p.activeSpecId);
  useEffect(() => {
    if (!p.image) return;
    for (const { spec } of entries) {
      if (!p.crops[spec.id]) useProject.getState().ensureCrop(spec, activeSpec);
    }
  }, [entries, p.image, p.crops, activeSpec]);

  const buildRequests = (dpi: number): SheetPhotoRequests | null => {
    if (!p.imageBlob || !p.image) return null;
    const reqs: SheetPhotoRequests = {};
    for (const { spec } of entries) {
      const crop = p.crops[spec.id];
      if (!crop) return null;
      reqs[spec.id] = {
        source: p.imageBlob,
        sourceKey: p.image.id,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
        crop,
        adjustments: p.adjustments,
        background: p.background,
        dpi,
      };
    }
    return reqs;
  };

  const render = async (dpi: number, quality: number) => {
    const reqs = buildRequests(dpi);
    if (!reqs) throw new Error('not ready');
    return renderSheet(reqs, {
      widthMm: sheet.widthMm,
      heightMm: sheet.heightMm,
      dpi,
      placements: result.placements,
      calibration: s.calibration,
      cutLine: s.cutLine,
      quality,
      gapMm: s.gapMm,
      decoration,
    });
  };

  // プレビューを Worker で描画（入力が落ち着いてから）
  // biome-ignore lint/correctness/useExhaustiveDependencies: render は下記の値から決まる
  useEffect(() => {
    if (!p.imageBlob || result.placements.length === 0) {
      setPreviewBlob(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setRendering(true);
      try {
        const blob = await render(previewDpi(Math.max(sheet.widthMm, sheet.heightMm)), 0.85);
        if (!cancelled) setPreviewBlob(blob);
      } catch {
        // 構図の準備中などは次の更新で再描画される
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    p.imageBlob,
    p.crops,
    p.adjustments,
    p.background,
    result,
    s.calibration,
    s.cutLine,
    decoration,
    sheet.widthMm,
    sheet.heightMm,
  ]);

  const baseName = safeFilename(`id-photo-sheet_${paper.id}_${s.landscape ? 'landscape' : 'portrait'}`);

  const onSave = async (kind: 'jpeg' | 'pdf' | 'share') => {
    setBusy(kind);
    try {
      const jpeg = await render(s.dpi, s.jpegQuality);
      if (kind === 'jpeg') {
        downloadBlob(jpeg, `${baseName}.jpg`);
        toast('JPEGを保存しました');
      } else if (kind === 'pdf') {
        downloadBlob(await exportPdf(jpeg, sheet.widthMm, sheet.heightMm), `${baseName}.pdf`);
        toast('PDFを保存しました');
      } else {
        await shareBlob(jpeg, `${baseName}.jpg`, '証明写真');
      }
    } catch {
      toast('書き出しに失敗しました', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!p.image) {
    return (
      <div className="print-empty card">
        <h1>印刷レイアウト</h1>
        <p className="hint">まず「作成」で写真を読み込んでください。</p>
        <NavLink to="/" viewTransition className="btn btn-primary">
          写真を読み込む
        </NavLink>
      </div>
    );
  }

  const aspect = sheet.widthMm / sheet.heightMm;

  return (
    <div className="print">
      <ColorFilterDefs />
      <section className="print-preview" aria-label="印刷プレビュー">
        <div
          className="sheet"
          style={{
            aspectRatio: `${sheet.widthMm} / ${sheet.heightMm}`,
            ['--sheet-aspect' as string]: aspect,
          }}
        >
          {previewUrl && result.placements.length > 0 ? (
            <img src={previewUrl} alt={`${paper.name}の印刷プレビュー`} />
          ) : (
            <svg className="sheet-placeholder" viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`} aria-hidden>
              {result.placements.map((pl, i) => (
                <rect
                  // biome-ignore lint/suspicious/noArrayIndexKey: 配置の順序が識別子
                  key={i}
                  x={pl.xMm}
                  y={pl.yMm}
                  width={pl.widthMm}
                  height={pl.heightMm}
                  className="sheet-slot"
                />
              ))}
            </svg>
          )}
          {rendering && <Loader2 className="spin sheet-spinner" size={20} />}
        </div>
        <p className="sheet-caption">
          {paper.name}（{sheet.widthMm}×{sheet.heightMm}mm）・{result.placements.length}枚
        </p>
      </section>

      <aside className="print-panel">
        <Segmented
          label="印刷メニュー"
          value={panel}
          options={[
            { value: 'layout', label: 'レイアウト' },
            { value: 'design', label: 'デザイン' },
          ]}
          onChange={setPanel}
        />
        {panel === 'layout' ? (
          <>
            <div className="card print-block">
              <h2 className="block-title">用紙</h2>
              <div className="paper-grid">
                {PAPERS.map((pp) => (
                  <button
                    key={pp.id}
                    type="button"
                    className="paper-option"
                    aria-pressed={pp.id === paper.id}
                    onClick={() => s.set({ paperId: pp.id })}
                  >
                    <span className="paper-name">{pp.name}</span>
                    <span className="paper-size">
                      {pp.widthMm}×{pp.heightMm}
                    </span>
                  </button>
                ))}
              </div>
              <Segmented
                label="用紙の向き"
                value={s.landscape}
                options={[
                  { value: false, label: '縦' },
                  { value: true, label: '横' },
                ]}
                onChange={(v) => s.set({ landscape: v })}
              />
              {paper.note && <p className="hint">{paper.note}</p>}
            </div>

            <div className="card print-block">
              <div className="block-head">
                <h2 className="block-title">並べる写真</h2>
                <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>
                  <Plus size={16} /> 追加
                </button>
              </div>
              {entries.length === 0 && (
                <p className="hint">
                  「追加」から規格を選ぶと、用紙に並べられます。サイズの違う写真も組み合わせられます。
                </p>
              )}
              <ul className="item-list">
                {entries.map(({ entry, spec }) => {
                  const room = maxAdditional(items, spec.id, opt);
                  const over = result.overflow[spec.id] ?? 0;
                  return (
                    <li key={spec.id} className="item">
                      <PhotoThumb
                        imageUrl={imageUrl}
                        imageAspect={p.image ? p.image.width / p.image.height : 1}
                        spec={spec}
                        crop={p.crops[spec.id]}
                        background={p.background}
                        height={52}
                      />
                      <div className="item-text">
                        <span className="item-name">{spec.name}</span>
                        <span className="item-size">
                          {formatSize(spec)}
                          {over > 0 ? (
                            <span className="item-over"> ・{over}枚はみ出し</span>
                          ) : room > 0 ? (
                            ` ・あと${room}枚入ります`
                          ) : (
                            ' ・満杯'
                          )}
                        </span>
                      </div>
                      <div className="item-actions">
                        <Stepper
                          label={`${spec.name}の枚数`}
                          value={entry.count}
                          min={1}
                          onChange={(v) => p.setLayoutCount(spec.id, v)}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          title="空きを埋める"
                          aria-label={`${spec.name}で空きを埋める`}
                          disabled={room === 0}
                          onClick={() => p.setLayoutCount(spec.id, entry.count + room)}
                        >
                          <Maximize2 size={18} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="削除"
                          aria-label={`${spec.name}を削除`}
                          onClick={() => p.removeFromLayout(spec.id)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {result.overflowTotal > 0 && (
                <p className="notice notice-warn row">
                  <AlertTriangle size={16} /> {result.overflowTotal}
                  枚が用紙に入りきりません。枚数・用紙・余白を調整してください。
                </p>
              )}
              <p className="hint">構図は「作成」画面で規格ごとに調整できます。</p>
            </div>

            <div className="card print-block">
              <h2 className="block-title">余白とカット線</h2>
              <div className="grid-2">
                <NumberField
                  label="用紙の余白"
                  unit="mm"
                  value={s.marginMm}
                  min={0}
                  max={30}
                  step={0.5}
                  onChange={(v) => s.set({ marginMm: Math.max(0, v) })}
                />
                <NumberField
                  label="写真の間隔"
                  unit="mm"
                  value={s.gapMm}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={(v) => s.set({ gapMm: Math.max(0, v) })}
                />
              </div>
              <Segmented
                label="カット線"
                value={s.cutLine}
                options={CUT_LINES}
                onChange={(v) => s.set({ cutLine: v })}
              />
              <p className="hint">印刷のズレや倍率の補正は「設定 → 印刷のズレ補正」で行えます。</p>
            </div>
          </>
        ) : (
          <div className="card print-block">
            <h2 className="block-title">用紙のデザイン</h2>
            <SheetDesignPanel captionFits={decoration.captionFits} overflow={result.overflowTotal} />
          </div>
        )}
        <div className="card print-block">
          <h2 className="block-title">書き出し</h2>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!!busy || result.placements.length === 0}
            onClick={() => onSave('jpeg')}
          >
            {busy === 'jpeg' ? <Loader2 size={18} className="spin" /> : <Download size={18} />} JPEGで保存（
            {s.dpi}dpi）
          </button>
          <button
            type="button"
            className="btn btn-block"
            disabled={!!busy || result.placements.length === 0}
            onClick={() => onSave('pdf')}
          >
            {busy === 'pdf' ? <Loader2 size={18} className="spin" /> : <FileText size={18} />}{' '}
            PDFで保存（実寸）
          </button>
          {canShareFiles() && (
            <button
              type="button"
              className="btn btn-block"
              disabled={!!busy || result.placements.length === 0}
              onClick={() => onSave('share')}
            >
              <Share2 size={18} /> 共有（プリントアプリなどへ）
            </button>
          )}
          <p className="hint">
            コンビニの写真プリントは JPEG を「L判」で、自宅プリンターは PDF
            を「実際のサイズ（100%）」で印刷してください。
          </p>
        </div>
      </aside>

      <Dialog.Root open={adding} onOpenChange={setAdding}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog dialog-wide">
            <Dialog.Title className="dialog-title">並べる写真を追加</Dialog.Title>
            <Dialog.Description className="dialog-desc">規格を選ぶと1枚追加されます。</Dialog.Description>
            <SpecPicker
              marked={(id) => p.layout.some((e) => e.specId === id)}
              onSelect={(spec) => {
                useProject.getState().ensureCrop(spec, activeSpec);
                p.addToLayout(spec.id, 1);
                setAdding(false);
              }}
            />
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button type="button" className="btn">
                  閉じる
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
