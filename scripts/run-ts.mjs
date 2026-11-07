/**
 * TS 스크립트 하나를 esbuild 로 번들(@/ · @kit 별칭 해석)해 Node 로 실행한다.
 * 사용: node scripts/run-ts.mjs scripts/kit-adapter-sample.ts
 */
import { build } from 'esbuild';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = process.argv[2];
if (!entry) {
  console.error('usage: node scripts/run-ts.mjs <file.ts>');
  process.exit(1);
}
const outfile = join(root, 'node_modules', '.tmp', 'run-ts', basename(entry).replace(/\.ts$/, '.mjs'));
await build({
  entryPoints: [join(root, entry)],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  tsconfig: join(root, 'tsconfig.app.json'),
  alias: { '@kit': join(root, 'hrsg_calc_kit_team1') },
  logLevel: 'warning',
});
const r = spawnSync(process.execPath, [outfile, ...process.argv.slice(3)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
