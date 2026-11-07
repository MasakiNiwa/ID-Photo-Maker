import {
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
  ImagePlus,
  LayoutGrid,
  Loader2,
  RotateCcw,
  RotateCw,
  Share2,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog, Segmented, Slider } from '@/components/controls';
import { toast } from '@/components/toast';
import { BACKGROUND_COLORS, DEFAULT_ADJUSTMENTS } from '@/domain/edit';
import { formatSize, type PhotoSpec, PRESET_SPECS } from '@/domain/specs';
import { canShareFiles, downloadBlob, safeFilename, shareBlob } from '@/lib/download';
import { useObjectUrl } from '@/lib/useObjectUrl';
import { renderPhotoJpeg } from '@/render/pool';
import { useProject } from '@/stores/project';
import { useSettings } from '@/stores/settings';
import { findSpec, useAllSpecs } from '@/stores/specs';
import { ColorFilterDefs } from './ColorFilter';
import { Cropper, SCALE_MAX, SCALE_MIN } from './Cropper';
import { ImageDropzone, useFilePicker, useImagePaste } from './ImageInput';
import { SpecPicker } from './SpecPicker';
import './editor.css';

type Tab = 'spec' | 'position' | 'color' | 'export';

const TABS = [
  { value: 'spec', label: '規格' },
  { value: 'position', label: '位置' },
  { value: 'color', label: '色・背景' },
  { value: 'export', label: '保存' },
] as const;

export function EditorPage() {
  const p = useProject();
  const settings = useSettings();
  const specs = useAllSpecs();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('spec');
  const [confirmClear, setConfirmClear] = useState(false);
  const imageUrl = useObjectUrl(p.imageBlob);

  const spec: PhotoSpec = findSpec(specs, p.activeSpecId) ?? (PRESET_SPECS[0] as PhotoSpec);
  const crop = p.crops[spec.id];
  const imageAspect = p.image ? p.image.width / p.image.height : 1;

  // 規格が消された場合などに構図を用意する
  useEffect(() => {
    if (p.image && !crop) p.ensureCrop(spec);
  }, [p.image, crop, spec, p.ensureCrop]);

  const onFile = useCallback(async (blob: Blob, name?: string) => {
    setBusy(true);
    try {
      await useProject.getState().loadImage(blob, name ?? (blob instanceof File ? blob.name : 'photo'));
      setTab('spec');
    } catch {
      toast('画像を読み込めませんでした。別の形式（JPEG/PNG）でお試しください。', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, []);
  useImagePaste(onFile);
  const picker = useFilePicker(onFile);

  const updateCrop = useCallback(
    (patch: Parameters<typeof p.updateCrop>[1]) => useProject.getState().updateCrop(spec.id, patch),
    [spec.id],
  );

  const baseRotation = crop ? Math.round(crop.rotation / 90) * 90 : 0;
  const fineRotation = crop ? crop.rotation - baseRotation : 0;

  const filename = useMemo(
    () => safeFilename(`id-photo_${spec.custom ? 'custom' : spec.id}_${spec.widthMm}x${spec.heightMm}mm.jpg`),
    [spec],
  );

  const renderJpeg = async () => {
    if (!p.imageBlob || !p.image || !crop) throw new Error('no image');
    return renderPhotoJpeg(
      {
        source: p.imageBlob,
        sourceKey: p.image.id,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
        crop,
        adjustments: p.adjustments,
        background: p.background,
        dpi: settings.dpi,
      },
      settings.jpegQuality,
    );
  };

  const onDownload = async () => {
    setBusy(true);
    try {
      downloadBlob(await renderJpeg(), filename);
      toast('写真を保存しました');
    } catch {
      toast('保存に失敗しました', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onShare = async () => {
    setBusy(true);
    try {
      await shareBlob(await renderJpeg(), filename, '証明写真');
    } catch {
      toast('共有できませんでした', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onAddToLayout = () => {
    p.addToLayout(spec.id, 1);
    toast(`${spec.name}を印刷レイアウトに追加しました`, {
      action: { label: '印刷へ', run: () => navigate('/print', { viewTransition: true }) },
    });
  };

  if (!p.image || !imageUrl || !crop) {
    return (
      <div className="editor-empty">
        {p.image && !imageUrl ? (
          <div className="loading">
            <Loader2 className="spin" /> 読み込み中…
          </div>
        ) : (
          <ImageDropzone onFile={onFile} busy={busy} />
        )}
      </div>
    );
  }

  return (
    <div className="editor">
      <ColorFilterDefs />
      <div className="editor-stage">
        <div className="editor-toolbar">
          <span className="editor-spec">
            {spec.name}
            <span>{formatSize(spec)}</span>
          </span>
          <div className="row">
            <button type="button" className="btn btn-sm btn-ghost" onClick={picker.open} title="写真を変更">
              <ImagePlus size={16} /> <span className="hide-sm">変更</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost btn-danger"
              onClick={() => setConfirmClear(true)}
              title="クリア"
            >
              <Trash2 size={16} /> クリア
            </button>
          </div>
        </div>
        <Cropper
          imageUrl={imageUrl}
          imageAspect={imageAspect}
          spec={spec}
          crop={crop}
          background={p.background}
          showGuides={settings.showGuides}
          onChange={updateCrop}
        />
        <div className="editor-quick" role="toolbar" aria-label="写真の操作">
          <button
            type="button"
            className="icon-btn"
            onClick={() => updateCrop({ rotation: crop.rotation - 90 })}
            aria-label="左に90度回転"
            title="左に90°回転"
          >
            <RotateCcw size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => updateCrop({ rotation: crop.rotation + 90 })}
            aria-label="右に90度回転"
            title="右に90°回転"
          >
            <RotateCw size={20} />
          </button>
          <button
            type="button"
            className={`icon-btn ${crop.flipH ? 'is-active' : ''}`}
            onClick={() => updateCrop({ flipH: !crop.flipH })}
            aria-pressed={crop.flipH}
            aria-label="左右反転"
            title="左右反転"
          >
            <FlipHorizontal2 size={20} />
          </button>
          <button
            type="button"
            className={`icon-btn ${settings.showGuides ? 'is-active' : ''}`}
            onClick={() => settings.set({ showGuides: !settings.showGuides })}
            aria-pressed={settings.showGuides}
            aria-label="ガイド線の表示"
            title="ガイド線"
          >
            {settings.showGuides ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => p.resetCrop(spec)}>
            位置をリセット
          </button>
        </div>
      </div>

      <aside className="editor-panel">
        <Segmented label="編集メニュー" value={tab} options={TABS} onChange={setTab} />
        <div className="editor-panel-body">
          {tab === 'spec' && (
            <div className="stack">
              <SpecPicker
                value={spec.id}
                onSelect={(s) => p.setActiveSpec(s, spec)}
                marked={(id) => p.layout.some((e) => e.specId === id)}
              />
              {spec.note && <p className="hint">{spec.note}</p>}
              <p className="hint">ガイド線（頭頂・あご）は目安です。必ず提出先の規定もご確認ください。</p>
            </div>
          )}

          {tab === 'position' && (
            <div className="stack">
              <Slider
                label="拡大・縮小"
                value={crop.scale}
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={0.01}
                onChange={(v) => updateCrop({ scale: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <Slider
                label="傾き補正"
                value={fineRotation}
                min={-15}
                max={15}
                step={0.1}
                onChange={(v) => updateCrop({ rotation: baseRotation + v })}
                format={(v) => `${v.toFixed(1)}°`}
              />
              <p className="hint">
                写真をドラッグして移動、ピンチやマウスホイールで拡大縮小できます。キーボードの矢印キーで微調整もできます。
              </p>
            </div>
          )}

          {tab === 'color' && (
            <div className="stack">
              <div className="field">
                <span className="field-label">背景色（写真の外側の余白）</span>
                <div className="swatches">
                  {BACKGROUND_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="swatch"
                      style={{ background: c.value }}
                      aria-pressed={p.background === c.value}
                      aria-label={c.name}
                      title={c.name}
                      onClick={() => p.setBackground(c.value)}
                    />
                  ))}
                  <label className="swatch swatch-custom" title="任意の色">
                    <input
                      type="color"
                      value={p.background}
                      onChange={(e) => p.setBackground(e.target.value)}
                      aria-label="任意の背景色"
                    />
                  </label>
                </div>
                <p className="hint">背景の自動置き換え（背景除去）は今後のバージョンで対応予定です。</p>
              </div>
              <Slider
                label="明るさ"
                value={p.adjustments.brightness}
                min={0.6}
                max={1.6}
                step={0.01}
                onChange={(v) => p.setAdjustments({ brightness: v })}
                format={(v) => `${Math.round((v - 1) * 100)}`}
              />
              <Slider
                label="コントラスト"
                value={p.adjustments.contrast}
                min={0.6}
                max={1.6}
                step={0.01}
                onChange={(v) => p.setAdjustments({ contrast: v })}
                format={(v) => `${Math.round((v - 1) * 100)}`}
              />
              <Slider
                label="彩度"
                value={p.adjustments.saturation}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => p.setAdjustments({ saturation: v })}
                format={(v) => `${Math.round((v - 1) * 100)}`}
              />
              <Slider
                label="色温度"
                value={p.adjustments.warmth}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => p.setAdjustments({ warmth: v })}
                format={(v) => `${Math.round(v * 100)}`}
              />
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => p.setAdjustments(DEFAULT_ADJUSTMENTS)}
              >
                色調整をリセット
              </button>
            </div>
          )}

          {tab === 'export' && (
            <div className="stack">
              <div className="notice">
                {spec.name}（{formatSize(spec)}）を {settings.dpi}dpi で書き出します。
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={onAddToLayout}>
                <LayoutGrid size={18} /> 印刷レイアウトに追加
              </button>
              <button type="button" className="btn btn-block" onClick={onDownload} disabled={busy}>
                {busy ? <Loader2 size={18} className="spin" /> : <Download size={18} />} この1枚をJPEGで保存
              </button>
              {canShareFiles() && (
                <button type="button" className="btn btn-block" onClick={onShare} disabled={busy}>
                  <Share2 size={18} /> 共有（他のアプリへ送る）
                </button>
              )}
              <p className="hint">
                コンビニで印刷する場合は、「印刷レイアウト」で
                L判などの用紙に並べてから保存するのがおすすめです。
              </p>
            </div>
          )}
        </div>
      </aside>
      {picker.input}
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="写真をクリアしますか？"
        description="読み込んだ写真と、位置・色の調整、印刷レイアウトがすべて消去されます。"
        confirmLabel="クリア"
        danger
        onConfirm={() => {
          void p.clear().then(() => toast('クリアしました'));
        }}
      />
    </div>
  );
}
