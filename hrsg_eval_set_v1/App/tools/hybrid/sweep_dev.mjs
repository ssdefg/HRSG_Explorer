// dev 전용 가중 RRF sweep: w_dense = 0.0 … 1.0 (0.1 단위)를 공식 채점 스크립트로 채점한다.
// 지표를 새로 구현하지 않기 위해 App/tools/eval_retrieval.mjs 를 바이트 그대로 .cache/hybrid_eval/tools/ 에 복사하고
// (sha256 일치 확인), 그 옆 web-server/lib/retrieve.js 자리에 retrieve_hybrid.js 를 둔다. 원본 파일은 바꾸지 않는다.
// 질문 파일에 split 이 "dev" 가 아닌 문항이 있으면 실행하지 않는다 (test 는 설정 확정 뒤 한 번만).
//
// 사용법 (작업 폴더 최상위에서):  node App/tools/hybrid/sweep_dev.mjs [--questions .cache/questions_dev.json] [--dense <dense_ranks.json>]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const cache = resolve(root, '.cache');
const qFile = resolve(opt('questions', resolve(cache, 'questions_dev.json')));
const corpus = resolve(root, 'App/web-server/data/corpus.json');
const origEval = resolve(root, 'App/tools/eval_retrieval.mjs');
const origRetrieve = resolve(root, 'App/web-server/lib/retrieve.js');

const qs = JSON.parse(readFileSync(qFile, 'utf8'));
if (qs.some(q => q.split !== 'dev')) { console.error('질문 파일에 dev 가 아닌 문항이 있음 — sweep 은 dev 로만 한다.'); process.exit(1); }

const latest = readdirSync(cache).filter(f => f.startsWith('dense_ranks_')).map(f => resolve(cache, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const dense = resolve(opt('dense', latest || ''));
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');

// 공식 채점 스크립트 복제 트리
const mirror = resolve(cache, 'hybrid_eval');
mkdirSync(resolve(mirror, 'tools'), { recursive: true }); mkdirSync(resolve(mirror, 'web-server/lib'), { recursive: true });
copyFileSync(origEval, resolve(mirror, 'tools/eval_retrieval.mjs'));
copyFileSync(resolve(root, 'App/tools/hybrid/retrieve_hybrid.js'), resolve(mirror, 'web-server/lib/retrieve.js'));
if (sha(origEval) !== sha(resolve(mirror, 'tools/eval_retrieval.mjs'))) throw new Error('채점 스크립트 복사본이 원본과 다름');

const outDir = resolve(cache, 'sweep'); mkdirSync(outDir, { recursive: true });
const run = (script, env, tag) => {
  const out = resolve(outDir, tag + '.json');
  execFileSync(process.execPath, [script, '--questions', qFile, '--corpus', corpus, '--json', out],
    { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(readFileSync(out, 'utf8')).summary;
};

const base = run(origEval, {}, 'bm25_official');
const grid = [...Array(11).keys()].map(i => +(i / 10).toFixed(1));
const res = grid.map(w => [w, run(resolve(mirror, 'tools/eval_retrieval.mjs'),
  { HYBRID_W_KO: String(w), HYBRID_W_EN: String(w), HYBRID_DENSE: dense, HYBRID_ORIG_RETRIEVE: origRetrieve }, `w${w.toFixed(1)}`)]);

const f = x => x == null ? '  -  ' : x.toFixed(3);
const cell = s => `${f(s.recall)} ${f(s.hit)} ${f(s.mrr)} ${f(s.page)}`;
console.log(`dev 문항 ${qs.length}개 (답 있는 문항 ${base.dev.n}) · dense 순위: ${dense.split(/[\/]/).pop()} · 채점 스크립트 sha256 ${sha(origEval).slice(0, 12)}… 원본과 일치\n`);
console.log(`셀 = recall@8 hit@8 MRR page@8\n${'w_dense'.padEnd(16)} ${'dev 전체'.padEnd(25)} ${('ko (n=' + base.ko.n + ')').padEnd(25)} en (n=${base.en.n})`);
console.log(`${'BM25 공식'.padEnd(16)} ${cell(base.dev)}   ${cell(base.ko)}   ${cell(base.en)}`);
for (const [w, s] of res) console.log(`${w.toFixed(1).padEnd(16)} ${cell(s.dev)}   ${cell(s.ko)}   ${cell(s.en)}`);

const same = ['dev', 'ko', 'en'].every(g => ['recall', 'hit', 'mrr', 'page'].every(m => Math.abs(res[0][1][g][m] - base[g][m]) < 1e-9));
console.log(`\n재현 확인: w_dense = 0.0 결과가 공식 BM25 와 ${same ? '완전히 같음' : '다름 (후보 수 확인 필요)'}`);
for (const g of ['ko', 'en']) {
  const best = [...res].sort((a, b) => b[1][g].recall - a[1][g].recall || b[1][g].mrr - a[1][g].mrr)[0];
  const ties = res.filter(([, s]) => Math.abs(s[g].recall - best[1][g].recall) < 1e-9).map(([w]) => w.toFixed(1));
  console.log(`${g} 최적: w_dense = ${best[0].toFixed(1)}  recall@8 ${f(best[1][g].recall)} / MRR ${f(best[1][g].mrr)}   (같은 recall 인 w: ${ties.join(', ')})`);
}
