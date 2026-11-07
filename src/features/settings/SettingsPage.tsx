import {
  Crosshair,
  Database,
  Image,
  Palette,
  RotateCcw,
  Ruler,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog, NumberField, Segmented, Slider } from '@/components/controls';
import { Section, Sections } from '@/components/Sections';
import { toast } from '@/components/toast';
import { findPaper, orient } from '@/domain/paper';
import { formatSize } from '@/domain/specs';
import { clearAllData } from '@/lib/db';
import { downloadBlob, safeFilename } from '@/lib/download';
import { renderCalibrationSheet } from '@/render/pool';
import { useProject } from '@/stores/project';
import { DEFAULT_CALIBRATION, type ThemeMode, useSettings } from '@/stores/settings';
import { CustomSpecDialog } from '../editor/CustomSpecDialog';
import './settings.css';

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '端末に合わせる' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
];

const DPIS = [300, 350, 400, 600].map((v) => ({ value: v, label: `${v}` }));

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function StorageInfo() {
  const [info, setInfo] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  useEffect(() => {
    (async () => {
      const est = await navigator.storage?.estimate?.();
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      if (est) setInfo({ usage: est.usage ?? 0, quota: est.quota ?? 0, persisted });
    })().catch(() => {});
  }, []);
  if (!info) return null;
  return (
    <p className="hint">
      使用量 {formatBytes(info.usage)} / 上限の目安 {formatBytes(info.quota)}
      {info.persisted ? '（永続化済み：ブラウザに自動削除されにくい状態）' : ''}
    </p>
  );
}

export function SettingsPage() {
  const s = useSettings();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [addingSpec, setAddingSpec] = useState(false);
  const [busy, setBusy] = useState(false);
  const paper = findPaper(s.paperId);
  const cal = s.calibration;

  const onCalibrationSheet = async () => {
    setBusy(true);
    try {
      const sheet = orient(paper, s.landscape);
      const blob = await renderCalibrationSheet({
        ...sheet,
        dpi: s.dpi,
        calibration: cal,
        quality: 0.95,
      });
      downloadBlob(blob, safeFilename(`calibration_${paper.id}.jpg`));
    } catch {
      toast('校正シートを作成できませんでした', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">設定</h1>
      <Sections>
        <Section id="display" title="表示" icon={<Palette size={18} />} summary="テーマ・ガイド線">
          <div className="field">
            <span className="field-label">テーマ</span>
            <Segmented
              label="テーマ"
              value={s.theme}
              options={THEMES}
              onChange={(v) => s.set({ theme: v })}
            />
          </div>
          <label className="switch-row">
            <span>
              編集画面にガイド線（頭頂・あご）を表示
              <span className="hint">規格ごとの顔の大きさの目安を表示します</span>
            </span>
            <input
              type="checkbox"
              className="switch"
              checked={s.showGuides}
              onChange={(e) => s.set({ showGuides: e.target.checked })}
            />
          </label>
        </Section>

        <Section
          id="output"
          title="出力品質"
          icon={<Image size={18} />}
          summary={`${s.dpi}dpi・JPEG品質 ${Math.round(s.jpegQuality * 100)}`}
        >
          <div className="field">
            <span className="field-label">解像度（dpi）</span>
            <Segmented label="解像度" value={s.dpi} options={DPIS} onChange={(v) => s.set({ dpi: v })} />
            <p className="hint">
              写真プリントは 300〜350dpi
              が一般的です。数値を上げるとファイルが大きくなり、書き出しに時間がかかります。
            </p>
          </div>
          <Slider
            label="JPEG品質"
            value={s.jpegQuality}
            min={0.8}
            max={1}
            step={0.01}
            onChange={(v) => s.set({ jpegQuality: v })}
            format={(v) => `${Math.round(v * 100)}`}
          />
        </Section>

        <Section
          id="calibration"
          title="印刷のズレ補正"
          icon={<Crosshair size={18} />}
          summary="プリンターごとの位置・倍率のズレを補正"
        >
          <ol className="steps">
            <li>「校正シートを保存」で、いま選んでいる用紙（{paper.name}）の校正シートを作ります。</li>
            <li>普段と同じ方法（同じプリンター・同じ設定）で印刷します。</li>
            <li>定規で目盛りの長さと、枠線から用紙端までの距離を測ります。</li>
            <li>ズレの分だけ下の値を入力し、もう一度印刷して確認します。</li>
          </ol>
          <div className="grid-2">
            <NumberField
              label="左右の位置（右へ＋）"
              unit="mm"
              value={cal.offsetXMm}
              step={0.1}
              onChange={(v) => s.setCalibration({ offsetXMm: v })}
            />
            <NumberField
              label="上下の位置（下へ＋）"
              unit="mm"
              value={cal.offsetYMm}
              step={0.1}
              onChange={(v) => s.setCalibration({ offsetYMm: v })}
            />
            <NumberField
              label="横の倍率"
              unit="%"
              value={cal.scaleXPct}
              step={0.1}
              min={80}
              max={120}
              onChange={(v) => s.setCalibration({ scaleXPct: v })}
            />
            <NumberField
              label="縦の倍率"
              unit="%"
              value={cal.scaleYPct}
              step={0.1}
              min={80}
              max={120}
              onChange={(v) => s.setCalibration({ scaleYPct: v })}
            />
          </div>
          <p className="hint">
            例：100mm の目盛りが 98mm で印刷された場合、倍率を 100 ÷ 98 × 100 ≒ 102.0% にします。
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={onCalibrationSheet} disabled={busy}>
              <Ruler size={18} /> 校正シートを保存
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => s.set({ calibration: DEFAULT_CALIBRATION })}
            >
              補正をリセット
            </button>
          </div>
        </Section>

        <Section
          id="custom"
          title="任意サイズの規格"
          icon={<SlidersHorizontal size={18} />}
          summary={s.customSpecs.length ? `${s.customSpecs.length}件` : '未登録'}
        >
          {s.customSpecs.length === 0 && <p className="hint">登録した任意サイズはまだありません。</p>}
          <ul className="spec-list">
            {s.customSpecs.map((c) => (
              <li key={c.id}>
                <span>
                  {c.name}
                  <span className="hint">{formatSize(c)}</span>
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${c.name}を削除`}
                  onClick={() => {
                    s.removeCustomSpec(c.id);
                    useProject.getState().removeFromLayout(c.id);
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn" onClick={() => setAddingSpec(true)}>
            任意サイズを追加
          </button>
        </Section>

        <Section
          id="data"
          title="データ管理"
          icon={<Database size={18} />}
          summary="端末内に保存されたデータ"
        >
          <p className="hint">
            写真と設定は、このブラウザの中（IndexedDB）だけに保存されます。外部のサーバーには送信されません。
          </p>
          <StorageInfo />
          <div className="row">
            <button type="button" className="btn" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={18} /> 設定を初期値に戻す
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmWipe(true)}>
              <Trash2 size={18} /> すべてのデータを削除
            </button>
          </div>
        </Section>
      </Sections>

      <CustomSpecDialog open={addingSpec} onOpenChange={setAddingSpec} />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="設定を初期値に戻しますか？"
        description="表示・出力・印刷補正などの設定が初期値に戻ります。任意サイズの規格と写真は残ります。"
        confirmLabel="初期値に戻す"
        onConfirm={() => {
          s.reset();
          toast('設定を初期値に戻しました');
        }}
      />
      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="すべてのデータを削除しますか？"
        description="写真・編集内容・設定・任意サイズの規格がすべて削除されます。元に戻せません。"
        confirmLabel="削除"
        danger
        onConfirm={async () => {
          await clearAllData();
          location.reload();
        }}
      />
    </div>
  );
}
