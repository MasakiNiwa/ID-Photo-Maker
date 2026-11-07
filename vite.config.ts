/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const mediapipeVersion = (
  JSON.parse(
    readFileSync(new URL('./node_modules/@mediapipe/tasks-vision/package.json', import.meta.url), 'utf8'),
  ) as {
    version: string;
  }
).version;

function commitHash(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // 相対パスにしておくと GitHub Pages のサブパス・ローカルプレビューの両方で動く
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(commitHash()),
    __MEDIAPIPE_VERSION__: JSON.stringify(mediapipeVersion),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'THIRD_PARTY_LICENSES.txt'],
      manifest: {
        name: '証明写真 ID Photo Maker',
        short_name: '証明写真',
        description: 'コンビニ印刷や自宅印刷用の証明写真データを作るアプリ',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#15171a',
        theme_color: '#15171a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,txt,webmanifest}'],
        // AI の WASM・モデルは大きいので事前キャッシュせず、初回利用時にキャッシュする
        globIgnores: ['mediapipe/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/mediapipe/'),
            handler: 'CacheFirst',
            options: { cacheName: 'mediapipe-wasm', expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://storage.googleapis.com' &&
              url.pathname.startsWith('/mediapipe-models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-models',
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
