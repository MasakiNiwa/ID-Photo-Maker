// 本番依存パッケージのライセンス情報を収集し、アプリ内クレジットと
// THIRD_PARTY_LICENSES.txt を生成する。package-lock.json を真実の情報源とする。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const extra = JSON.parse(readFileSync(join(root, 'scripts/extra-licenses.json'), 'utf8'));

const entries = [];
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path || info.dev || (info.optional && !existsSync(join(root, path)))) continue;
  const dir = join(root, path);
  const pkgFile = join(dir, 'package.json');
  if (!existsSync(pkgFile) || path.includes('node_modules/@types/')) continue;
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
  const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  entries.push({
    name: pkg.name,
    version: pkg.version,
    license: typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'UNKNOWN'),
    url:
      pkg.homepage ??
      repo
        ?.replace(/^git\+/, '')
        .replace(/^git:\/\//, 'https://')
        .replace(/\.git$/, '') ??
      `https://www.npmjs.com/package/${pkg.name}`,
    text: licenseFile ? readFileSync(join(dir, licenseFile), 'utf8').trim() : '',
  });
}

const unique = [...new Map([...entries, ...extra].map((e) => [`${e.name}@${e.version}`, e])).values()].sort(
  (a, b) => a.name.localeCompare(b.name),
);

mkdirSync(join(root, 'src/generated'), { recursive: true });
writeFileSync(join(root, 'src/generated/licenses.json'), `${JSON.stringify(unique, null, 2)}\n`);
const txt = unique
  .map(
    (e) =>
      `${e.name} ${e.version}\nLicense: ${e.license}\n${e.url}\n\n${e.text || '(ライセンス本文はURLを参照)'}\n`,
  )
  .join(`\n${'-'.repeat(72)}\n\n`);
writeFileSync(
  join(root, 'public/THIRD_PARTY_LICENSES.txt'),
  `証明写真 ID Photo Maker — Third-party licenses\n\n${txt}`,
);
console.log(`licenses: ${unique.length} packages`);
