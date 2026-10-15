import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json')));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versión inválida');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim() && !process.argv.includes('--allow-dirty')) {
  throw new Error('El paquete publicable requiere un árbol limpio. Para pruebas locales usa --allow-dirty.');
}
const output = resolve(root, 'artifacts');
mkdirSync(output, { recursive: true });
const staging = mkdtempSync(join(tmpdir(), 'cerritos-release-'));
try {
  // Explicit allowlist: never copy working-tree directories or private configuration.
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean)
    .filter(path => /^(src\/|public\/|server\/|scripts\/|tests\/|docs\/|firebase\/|package(?:-lock)?\.json$|tsconfig\.json$|vite\.config\.ts$|index\.html$|README\.md$|\.nvmrc$)/.test(path));
  paths.push('scripts/package-release.mjs', 'scripts/update-mac.sh', 'docs/UPDATES.md', 'tests/release.cjs');
  for (const path of new Set(paths)) {
    mkdirSync(join(staging, path, '..'), { recursive: true });
    cpSync(join(root, path), join(staging, path));
  }
  writeFileSync(join(staging, 'release.json'), JSON.stringify({ version, commit, testOnly: process.argv.includes('--allow-dirty') }, null, 2) + '\n');
  const name = `cerritos-home-${version}-server.tar.gz`;
  execFileSync('tar', ['-czf', join(output, name), '-C', staging, '.']);
  const updater = `cerritos-home-${version}-update-mac.sh`;
  cpSync(join(root, 'scripts/update-mac.sh'), join(output, updater));
  const instructions = `cerritos-home-${version}-UPDATES.md`;
  cpSync(join(root, 'docs/UPDATES.md'), join(output, instructions));
  for (const file of [name, updater, instructions]) {
    const hash = createHash('sha256').update(readFileSync(join(output, file))).digest('hex');
    writeFileSync(join(output, file + '.sha256'), `${hash}  ${file}\n`);
  }
  console.log(`Paquete de servidor y actualizador: ${output}`);
} finally { rmSync(staging, { recursive: true, force: true }); }
