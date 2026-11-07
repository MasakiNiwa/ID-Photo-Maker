# アーキテクチャ

## 方針

- **mm 単位のドメインモデル**（`src/domain`）: 規格・用紙・面付け・編集パラメータは描画から独立した純粋なデータと関数。単体テスト対象。
- **非破壊編集**: 元画像は IndexedDB に保持し、構図（`CropState`）と色調整（`Adjustments`）だけを保存・変更する。
  構図は「枠の高さ = 1」の正規化座標なので、規格や出力解像度が変わっても同じ構図を保てる。
- **プレビューと出力の一致**: 色調整は 4×5 カラーマトリクス（`src/render/colorMatrix.ts`）に変換し、
  プレビューは SVG `feColorMatrix`（GPU）、出力は Worker の画素処理で同じ行列を使う。
- **AI 処理**（`src/ai`）: MediaPipe の顔検出（Face Landmarker）と人物セグメンテーション（Selfie Segmenter）を専用 Worker で実行（GPU 優先、失敗時は CPU）。
  WASM は `scripts/copy-mediapipe.mjs` がバージョン付きパスに自前ホストし、モデルは初回利用時に取得して Service Worker でキャッシュする。
  顔の特徴点から構図を求める計算（`src/domain/face.ts`）は純粋関数でテスト済み。
- **並列描画**: `src/render/pool.ts` が Web Worker（OffscreenCanvas）のプールを管理し、サイズの異なる写真を並列に描画してから面付けする。

## ディレクトリ

```
src/
  app/         シェル（ヘッダー・ナビ）、PWA更新通知、アプリ情報
  components/  汎用UI（折りたたみセクション、スライダー、ダイアログ、トースト）
  domain/      規格・用紙・面付け・編集・JPEG dpi（純粋関数 + テスト）
  features/    画面単位（editor / print / settings / help）
  lib/         IndexedDB、テーマ、ダウンロード等
  render/      描画 Worker とプール
  stores/      zustand ストア（IndexedDB に永続化）
  styles/      デザイントークンとグローバルCSS
scripts/       ビルド時スクリプト（ライセンス情報の生成）
```

## 機能追加の目安

- 規格を増やす: `src/domain/specs.ts` の `PRESET_SPECS` に追加
- 用紙を増やす: `src/domain/paper.ts` の `PAPERS` に追加
- 新しいページ: `src/features/<name>/` を作り、`src/main.tsx` のルートと `src/app/Shell.tsx` の `NAV` に追加
- 保存データの形式を変える: zustand `persist` の `version` と `migrate`、Dexie の `version()` を上げる

## ライセンス管理

`npm run build` / `npm run dev` の前に `scripts/gen-licenses.mjs` が `package-lock.json` から本番依存を収集し、
ヘルプ画面のクレジット（`src/generated/licenses.json`）と `public/THIRD_PARTY_LICENSES.txt` を生成する。
npm 以外で取り込むもの（CDN のモデルなど）は `scripts/extra-licenses.json` に手で追記する。
