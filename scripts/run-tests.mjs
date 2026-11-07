/**
 * 최소 테스트 러너 — 별도 테스트 프레임워크 없이 Node 내장 `node:test`를 사용한다.
 * tests/*.test.ts 를 esbuild로 번들(@/ 경로 별칭 해석)한 뒤 `node --test`로 실행한다.
 * 대상은 React에 의존하지 않는 순수 로직(계산 엔진, 매칭, 이메일 초안, 데이터 정합성)이다.
 */
import { build } from 'esbuild';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// fileURLToPath: 한글·공백이 있는 경로도 올바르게 디코딩한다
const root = fileURLToPath(new URL('..', import.meta.url));
const testDir = join(root, 'tests');
const outDir = join(root, 'node_modules', '.tmp', 'tests');

const entries = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => join(testDir, f));

if (entries.length === 0) {
  console.error('No tests found in tests/');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
await build({
  entryPoints: entries,
  outdir: outDir,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  tsconfig: join(root, 'tsconfig.app.json'),
  // 계산기·체크리스트 키트 (vite.config.ts 의 '@kit' 별칭과 같은 위치)
  alias: { '@kit': join(root, 'hrsg_calc_kit_team1') },
  logLevel: 'warning',
});

const files = readdirSync(outDir)
  .filter((f) => f.endsWith('.mjs'))
  .map((f) => join(outDir, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
