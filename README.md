# 証明写真 ID Photo Maker

コンビニ印刷や自宅印刷用の証明写真データを作る Web アプリです。

**▶ https://masakiniwa.github.io/ID-Photo-Maker/**

- 履歴書・パスポート・マイナンバーカード・運転免許証などの規格を選択、または任意サイズ（mm）を指定
- AI（端末内で処理）が顔を検出し、規格に合わせて大きさ・位置・傾きを自動調整。人物を切り抜いて背景色を置き換え
- ドラッグ・ピンチで位置合わせ（頭頂・あごのガイド線つき）、傾き補正、明るさ・色の調整、背景色
- サイズの違う写真を組み合わせて L判・2L判・はがき・A4 などに面付けし、JPEG / 実寸 PDF で保存
- プリンターごとの印刷ズレ・倍率の補正（校正シートつき）
- 写真はすべて端末内で処理され、外部に送信されません（PWA としてオフラインでも動作）

## 開発

Node.js 26 以降が必要です。

```sh
npm ci
npm run dev        # 開発サーバー
npm run lint       # Biome
npm run typecheck  # TypeScript
npm test           # Vitest
npm run build      # 本番ビルド（dist/）
```

`main` への push で GitHub Actions が GitHub Pages へデプロイします。
設計については [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、今後の予定は [docs/ROADMAP.md](docs/ROADMAP.md) を参照してください。

## ライセンス

[MIT License](LICENSE)

利用しているオープンソースソフトウェアのライセンスは、アプリのヘルプ画面「クレジット」と、
ビルド時に生成される `THIRD_PARTY_LICENSES.txt` に記載しています。
