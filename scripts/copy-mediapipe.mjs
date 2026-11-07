// MediaPipe の WASM（ES Module 版）を public/ にコピーして自前ホストする。
// バージョンが npm の依存と常に一致し、CDN 障害の影響を受けない。
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const { version } = JSON.parse(readFileSync(join(src, '../package.json'), 'utf8'));
// バージョンをパスに含め、更新時に古いキャッシュと混ざらないようにする
rmSync(join(root, 'public/mediapipe'), { recursive: true, force: true });
const dest = join(root, 'public/mediapipe', version);
mkdirSync(dest, { recursive: true });
for (const f of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`mediapipe: wasm ${version} copied`);
