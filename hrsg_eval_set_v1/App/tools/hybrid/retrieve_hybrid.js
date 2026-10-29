// BGE-M3 dense + BM25 가중 RRF 검색. 채점 스크립트가 web-server/lib/retrieve.js 대신 불러가도록 sweep_dev.mjs 가
// .cache/ 아래 복제 트리에 retrieve.js 라는 이름으로 복사한다. 원본 retrieve.js 는 바꾸지 않는다.
//   BM25: 원본 retrieve.js 와 같은 토큰화·점수식, 한국어 용어 확장(expandKo)은 원본 파일에서 그대로 불러온다.
//   Dense: embed_bge_m3.py 가 미리 계산한 질문별 passage 순위 (HYBRID_DENSE 파일).
//   결합: score = w/(60 + dense 순위) + (1 - w)/(60 + BM25 순위). 후보는 기본적으로 자르지 않는다 (전체 순위) —
//   상위 40개로 자르면 cap 뒤에 k 개가 안 채워지는 문항이 생겨 w = 0 이 공식 BM25 와 달라진다 (dev en05).
//   cap: 원본 search() 와 같이 참고문헌당 최대 2개, k 개.
// 환경변수: HYBRID_W_KO, HYBRID_W_EN (Dense 가중치 w, 기본 0.5), HYBRID_DENSE (dense 순위 json), HYBRID_CAND (후보 수, 기본 전체),
//          HYBRID_RRF_K (RRF 상수, 기본 60)
import { readFileSync } from 'node:fs';

const ORIG = process.env.HYBRID_ORIG_RETRIEVE;
const { expandKo } = await import('data:text/javascript;base64,' + Buffer.from(readFileSync(ORIG, 'utf8')).toString('base64'));

const STOP = new Set('a an and are as at be by for from how in is it of on or that the this to was what when where which why with does do can than then there these those their its into not no'.split(' '));
const tokens = s => String(s).toLowerCase().replace(/[^a-z0-9°.+\- ]+/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP.has(t));
const RRF_K = process.env.HYBRID_RRF_K ? +process.env.HYBRID_RRF_K : 60;
const CAND = process.env.HYBRID_CAND ? +process.env.HYBRID_CAND : Infinity;
const W = { ko: +(process.env.HYBRID_W_KO ?? 0.5), en: +(process.env.HYBRID_W_EN ?? 0.5) };
const DENSE = JSON.parse(readFileSync(process.env.HYBRID_DENSE, 'utf8'));
let index = null;

function build(corpus) {
  const df = new Map();
  const docs = corpus.passages.map(p => {
    const tf = new Map(), t = tokens(p.text);
    for (const w of t) tf.set(w, (tf.get(w) || 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
    return { tf, len: t.length };
  });
  return { df, docs, avg: docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length), N: docs.length };
}

function bm25Ranking(corpus, q) {
  index = index || build(corpus);
  const { df, docs, avg, N } = index, terms = [...new Set(tokens(expandKo(q)))];
  return docs.map((d, i) => {
    let s = 0;
    for (const w of terms) {
      const f = d.tf.get(w); if (!f) continue;
      const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5));
      s += idf * f * 2.2 / (f + 1.2 * (0.25 + 0.75 * d.len / avg));
    }
    return [s, i];
  }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
}

export function search(corpus, q, k) {
  const dense = DENSE[q];
  if (!dense) throw new Error('dense 순위 없음 (embed_bge_m3.py 를 이 질문 파일로 다시 실행): ' + q);
  const w = /[가-힣]/.test(q) ? W.ko : W.en;
  const score = new Map();
  for (const [wt, ranking] of [[w, dense.slice(0, CAND)], [1 - w, bm25Ranking(corpus, q).slice(0, CAND)]]) {
    if (wt <= 0) continue;
    ranking.forEach((i, r) => score.set(i, (score.get(i) || 0) + wt / (RRF_K + r + 1)));
  }
  const ordered = [...score].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const per = new Map(), out = [];
  for (const i of ordered) {
    const p = corpus.passages[i], n = per.get(p.ref) || 0;
    if (n >= 2) continue;
    per.set(p.ref, n + 1); out.push(p);
    if (out.length >= k) break;
  }
  return out;
}
