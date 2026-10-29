// dev 전용 격자 탐색: w_dense (0.0 … 1.0) × RRF 상수 k × 후보 수. sweep_dev.mjs 와 같은 복제 트리(공식 채점 스크립트)로 채점한다.
// 한국어·영어 질문은 각자 자기 언어 가중치만 쓰므로 w 를 두 언어에 똑같이 주고 언어별 점수를 따로 읽는다.
// 사용법 (작업 폴더 최상위에서):  node App/tools/hybrid/grid_dev.mjs --dense <dense_ranks.json>   → .cache/grid_dev.json
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const cache = resolve(root, '.cache');
const qFile = resolve(opt('questions', resolve(cache, 'questions_dev.json')));
if (JSON.parse(readFileSync(qFile, 'utf8')).some(q => q.split !== 'dev')) { console.error('dev 가 아닌 문항이 있음 — 격자 탐색은 dev 로만 한다.'); process.exit(1); }
const dense = resolve(opt('dense'));
const corpus = resolve(root, 'App/web-server/data/corpus.json');
const mirrorEval = resolve(cache, 'hybrid_eval/tools/eval_retrieval.mjs');
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
if (sha(mirrorEval) !== sha(resolve(root, 'App/tools/eval_retrieval.mjs'))) throw new Error('채점 스크립트 복사본이 원본과 다름 — sweep_dev.mjs 를 먼저 실행');
copyFileSync(resolve(root, 'App/tools/hybrid/retrieve_hybrid.js'), resolve(cache, 'hybrid_eval/web-server/lib/retrieve.js'));

const W = [...Array(11).keys()].map(i => +(i / 10).toFixed(1));
const K = [10, 20, 30, 60], CAND = [40, 100, 200, 'all'];
const out = resolve(cache, 'grid_tmp.json'), rows = [];
for (const k of K) for (const c of CAND) for (const w of W) {
  const env = { ...process.env, HYBRID_W_KO: String(w), HYBRID_W_EN: String(w), HYBRID_RRF_K: String(k), HYBRID_DENSE: dense,
    HYBRID_ORIG_RETRIEVE: resolve(root, 'App/web-server/lib/retrieve.js') };
  if (c !== 'all') env.HYBRID_CAND = String(c); else delete env.HYBRID_CAND;
  execFileSync(process.execPath, [mirrorEval, '--questions', qFile, '--corpus', corpus, '--json', out], { env, stdio: ['ignore', 'ignore', 'inherit'] });
  const s = JSON.parse(readFileSync(out, 'utf8')).summary;
  rows.push({ k, cand: c, w, ko: s.ko, en: s.en });
}
writeFileSync(resolve(cache, 'grid_dev.json'), JSON.stringify(rows));
console.log(`${rows.length}개 설정 채점 완료 → .cache/grid_dev.json`);
