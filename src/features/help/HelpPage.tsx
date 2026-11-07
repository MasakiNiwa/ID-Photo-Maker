import {
  BookOpen,
  Code2,
  Crosshair,
  ExternalLink,
  FileText,
  Heart,
  Printer,
  Ruler,
  ShieldCheck,
} from 'lucide-react';
import { APP_NAME, APP_VERSION, BUILD_DATE, COMMIT_HASH, REPO_URL } from '@/app/meta';
import { Section, Sections } from '@/components/Sections';
import { formatSize, PRESET_SPECS } from '@/domain/specs';
import licenses from '@/generated/licenses.json';
import { workerCount } from '@/render/pool';
// リポジトリの LICENSE をそのまま表示する（二重管理を避ける）
import licenseText from '../../../LICENSE?raw';
import '../settings/settings.css';
import './help.css';

interface LicenseEntry {
  name: string;
  version: string;
  license: string;
  url: string;
  text: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}

export function HelpPage() {
  const list = licenses as LicenseEntry[];
  return (
    <div className="page">
      <h1 className="page-title">ヘルプ</h1>

      <section className="card about">
        <div className="about-head">
          <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
            <rect x="4" y="2" width="24" height="28" rx="4" fill="var(--accent)" />
            <circle cx="16" cy="13" r="5" fill="var(--on-accent)" />
            <path d="M7.5 27c1-5 4.5-7.5 8.5-7.5s7.5 2.5 8.5 7.5z" fill="var(--on-accent)" />
          </svg>
          <div>
            <h2 className="about-name">{APP_NAME}</h2>
            <p className="hint">コンビニ印刷や自宅印刷用の証明写真データを作るアプリ</p>
          </div>
        </div>
        <dl className="about-meta">
          <div>
            <dt>バージョン</dt>
            <dd>v{APP_VERSION}</dd>
          </div>
          <div>
            <dt>ビルド日時</dt>
            <dd>{formatDate(BUILD_DATE)}</dd>
          </div>
          <div>
            <dt>コミット</dt>
            <dd>
              <code>{COMMIT_HASH}</code>
            </dd>
          </div>
          <div>
            <dt>描画スレッド</dt>
            <dd>{workerCount}並列</dd>
          </div>
        </dl>
      </section>

      <Sections>
        <Section id="howto" title="使い方" icon={<BookOpen size={18} />}>
          <ol className="steps">
            <li>「作成」で顔写真を選ぶか、カメラで撮影します（ドラッグ&ドロップ・貼り付けも可）。</li>
            <li>
              「規格」から用途（履歴書・パスポートなど）を選びます。一覧にないサイズは「任意サイズ」で mm
              指定できます。
            </li>
            <li>
              読み込むと AI
              が顔を検出し、頭頂とあごがガイド線の帯に収まるよう自動で位置・大きさ・傾きを合わせます。必要に応じてドラッグ・ピンチで微調整してください（「顔に合わせる」でいつでもやり直せます）。
            </li>
            <li>
              「色・背景」で「背景を置き換える」をオンにすると、人物を切り抜いて背景を好きな色にできます。明るさや色味もここで調整します。
            </li>
            <li>「保存」から1枚だけ保存するか、「印刷レイアウトに追加」します。</li>
            <li>「印刷」で用紙と枚数を選びます。サイズの違う写真を1枚の用紙に組み合わせることもできます。</li>
            <li>JPEG または PDF で保存して印刷します。</li>
          </ol>
          <p className="hint">編集内容は自動で端末内に保存され、次回開いたときに続きから再開できます。</p>
        </Section>

        <Section id="print" title="印刷のコツ" icon={<Printer size={18} />}>
          <h3 className="help-h">コンビニで印刷する</h3>
          <ul className="steps">
            <li>
              「印刷」で用紙を「L判」にして JPEG
              で保存し、各コンビニのプリントサービス（アプリやWeb）に登録します。
            </li>
            <li>
              サービスによっては用紙の端が少し切れることがあります。用紙の余白を 2mm
              以上にしておくと安心です。
            </li>
            <li>「フチなし」「トリミング」の設定がある場合は、画像全体が収まる設定を選んでください。</li>
          </ul>
          <h3 className="help-h">自宅のプリンターで印刷する</h3>
          <ul className="steps">
            <li>
              A4 などは PDF
              で保存し、印刷設定で「実際のサイズ」「100%」を選びます（「用紙に合わせる」は使わない）。
            </li>
            <li>写真用紙を使うと仕上がりがきれいです。</li>
            <li>サイズが合わない場合は「設定 → 印刷のズレ補正」で調整できます。</li>
          </ul>
        </Section>

        <Section id="calibration" title="印刷のズレ補正について" icon={<Crosshair size={18} />}>
          <p className="hint">
            プリンターによっては、印刷位置がわずかにずれたり、拡大・縮小されて印刷されたりします。「設定 →
            印刷のズレ補正」で校正シートを印刷し、測った値を入力すると、以降の書き出しすべてに補正が反映されます。
          </p>
        </Section>

        <Section
          id="specs"
          title="対応している規格"
          icon={<Ruler size={18} />}
          summary={`${PRESET_SPECS.length}種類 + 任意サイズ`}
        >
          <table className="spec-table">
            <thead>
              <tr>
                <th>規格</th>
                <th>サイズ</th>
              </tr>
            </thead>
            <tbody>
              {PRESET_SPECS.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    {s.note && <span className="hint">{s.note}</span>}
                  </td>
                  <td>{formatSize(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">ガイド線は一般的な目安です。提出先の最新の規定を必ずご確認ください。</p>
        </Section>

        <Section id="privacy" title="プライバシー" icon={<ShieldCheck size={18} />}>
          <p className="hint">
            写真の読み込み・加工・書き出しはすべてお使いの端末のブラウザ内で行われ、写真が外部のサーバーに送信されることはありません。
            顔検出・背景の置き換えに使う AI（Google MediaPipe）も端末内で動作します（初回のみ AI
            モデルをダウンロードします）。データはこのブラウザの IndexedDB に保存され、「設定 →
            データ管理」からいつでも削除できます。
          </p>
        </Section>

        <Section id="source" title="ソースコード" icon={<Code2 size={18} />}>
          <p className="hint">
            このアプリはオープンソースです。不具合の報告や要望は GitHub の Issues からお寄せください。
          </p>
          <a className="btn" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub リポジトリを開く <ExternalLink size={16} />
          </a>
        </Section>

        <Section id="license" title="ライセンス" icon={<FileText size={18} />} summary="MIT License">
          <pre className="license-text">{licenseText}</pre>
        </Section>

        <Section
          id="credits"
          title="クレジット"
          icon={<Heart size={18} />}
          summary={`${list.length}件のオープンソースソフトウェア`}
        >
          <p className="hint">
            このアプリは、以下のオープンソースソフトウェアを利用しています。開発者の皆様に感謝いたします。
          </p>
          <ul className="credit-list">
            {list.map((l) => (
              <li key={`${l.name}@${l.version}`}>
                <details>
                  <summary>
                    <span className="credit-name">{l.name}</span>
                    <span className="credit-meta">
                      {l.version} ・ {l.license}
                    </span>
                  </summary>
                  <a href={l.url} target="_blank" rel="noreferrer" className="credit-link">
                    {l.url}
                  </a>
                  {l.text && <pre className="license-text">{l.text}</pre>}
                </details>
              </li>
            ))}
          </ul>
          <a className="btn btn-sm" href="./THIRD_PARTY_LICENSES.txt" target="_blank" rel="noreferrer">
            ライセンス全文（テキスト）
          </a>
        </Section>
      </Sections>
    </div>
  );
}
