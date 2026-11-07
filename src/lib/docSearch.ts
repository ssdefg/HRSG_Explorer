import type { RagSource } from '@/lib/ragClient';

/**
 * 브라우저 문헌 검색 (Standalone 모드) — public/data/rag_corpus.json (scripts/build_web_corpus.py) 을 BM25 로 검색한다.
 * 서버(rag/retriever.py)와 같은 문단·토큰화·BM25Okapi 점수식(k1 1.5 · b 0.75 · epsilon 0.25)·문헌당 2문단 제한.
 * BGE-M3 dense 검색은 브라우저에서 돌릴 수 없어 빠지므로, 한국어 질문은 아래 용어집으로 영어 검색어를 덧붙인다.
 */

export interface WebCorpus {
  version: number;
  docs: Record<string, { file: string; title: string | null; doi: string | null; citation: string | null }>;
  /** [id, doc_id, page, text] */
  passages: [string, string, number, string][];
}

export interface DocIndex {
  corpus: WebCorpus;
  /** 토큰 → [문단 번호, 출현 횟수][] */
  postings: Map<string, [number, number][]>;
  idf: Map<string, number>;
  docLen: Uint32Array;
  avgdl: number;
}

const K1 = 1.5;
const B = 0.75;
const EPSILON = 0.25;
export const TOP_K = 5;
const MAX_PER_DOC = 2;
const PREVIEW_CHARS = 100;

/** scripts/build_indices.py tokenize() 와 같다: 영문 소문자 단어(숫자 포함 허용)와 한글 어절 */
const TOKEN_RE = /[a-z][a-z0-9]*|[가-힣]+/g;
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

/**
 * 한국어 HRSG 용어 → 영어 검색어. 질문에 왼쪽 표현이 들어 있으면 오른쪽 단어를 검색어에 더한다.
 * (코퍼스 대부분이 영어 논문이라 한글 어절만으로는 BM25 가 거의 맞지 않는다)
 */
export const KO_GLOSSARY: [string, string][] = [
  ['배열회수보일러', 'hrsg heat recovery steam generator'],
  ['폐열회수보일러', 'hrsg heat recovery steam generator'],
  ['보일러', 'boiler'],
  ['복합화력', 'combined cycle'],
  ['복합발전', 'combined cycle'],
  ['가스터빈', 'gas turbine'],
  ['증기터빈', 'steam turbine'],
  ['터빈', 'turbine'],
  ['배압', 'back pressure backpressure'],
  ['차압', 'pressure drop differential'],
  ['압력손실', 'pressure drop loss'],
  ['압력 손실', 'pressure drop loss'],
  ['압력', 'pressure'],
  ['핀치', 'pinch point'],
  ['어프로치', 'approach temperature'],
  ['접근온도', 'approach temperature'],
  ['과열기', 'superheater'],
  ['재열기', 'reheater'],
  ['증발기', 'evaporator'],
  ['절탄기', 'economizer'],
  ['이코노마이저', 'economizer'],
  ['드럼', 'drum'],
  ['스택', 'stack'],
  ['굴뚝', 'stack'],
  ['배기가스', 'exhaust gas'],
  ['배기', 'exhaust'],
  ['연소', 'combustion'],
  ['보조연소', 'supplementary firing duct burner'],
  ['덕트버너', 'duct burner'],
  ['파울링', 'fouling'],
  ['오염', 'fouling deposit'],
  ['퇴적', 'deposit'],
  ['침착', 'deposit'],
  ['스케일', 'scale'],
  ['부식', 'corrosion'],
  ['유동가속부식', 'flow accelerated corrosion fac'],
  ['저온부식', 'cold end corrosion dew point'],
  ['산노점', 'acid dew point'],
  ['노점', 'dew point'],
  ['세정', 'cleaning'],
  ['청소', 'cleaning'],
  ['세척', 'cleaning washing'],
  ['드라이아이스', 'dry ice blasting'],
  ['고압수', 'high pressure water'],
  ['화학세정', 'chemical cleaning'],
  ['화학 세정', 'chemical cleaning'],
  ['기계식', 'mechanical'],
  ['정비', 'maintenance'],
  ['유지보수', 'maintenance'],
  ['점검', 'inspection'],
  ['검사', 'inspection'],
  ['수명', 'life lifetime'],
  ['피로', 'fatigue'],
  ['크리프', 'creep'],
  ['균열', 'crack cracking'],
  ['응력', 'stress'],
  ['열응력', 'thermal stress'],
  ['기동', 'startup start'],
  ['시동', 'startup start'],
  ['정지', 'shutdown outage'],
  ['부분부하', 'part load'],
  ['부하', 'load'],
  ['출력', 'output power'],
  ['효율', 'efficiency'],
  ['열효율', 'thermal efficiency'],
  ['성능', 'performance'],
  ['열전달', 'heat transfer'],
  ['전열', 'heat transfer'],
  ['열교환', 'heat exchanger'],
  ['핀튜브', 'finned tube fin'],
  ['튜브', 'tube'],
  ['수처리', 'water chemistry treatment'],
  ['수질', 'water chemistry'],
  ['급수', 'feedwater'],
  ['증기', 'steam'],
  ['온도', 'temperature'],
  ['유량', 'flow rate'],
  ['손실', 'loss'],
  ['비용', 'cost'],
  ['경제성', 'economic cost'],
  ['투자', 'investment'],
  ['회수기간', 'payback period'],
  ['최적화', 'optimization'],
  ['시뮬레이션', 'simulation model'],
  ['모델', 'model'],
  ['설계', 'design'],
  ['진동', 'vibration'],
  ['소음', 'noise'],
  ['배출', 'emission'],
  ['질소산화물', 'nox'],
  ['탈질', 'scr nox'],
  ['촉매', 'catalyst scr'],
  ['암모니아', 'ammonia'],
  ['황산암모늄', 'ammonium bisulfate'],
];

export function expandQuery(query: string): string[] {
  const tokens = tokenize(query);
  if (!/[가-힣]/.test(query)) return tokens;
  const extra = KO_GLOSSARY.filter(([ko]) => query.includes(ko)).flatMap(([, en]) => tokenize(en));
  return [...tokens, ...new Set(extra)];
}

/** rank_bm25.BM25Okapi 와 같은 색인 (음수 IDF 는 epsilon × 평균 IDF 로 바꾼다) */
export function buildIndex(corpus: WebCorpus): DocIndex {
  const postings = new Map<string, [number, number][]>();
  const docLen = new Uint32Array(corpus.passages.length);
  let total = 0;
  corpus.passages.forEach(([, , , text], i) => {
    const toks = tokenize(text);
    docLen[i] = toks.length;
    total += toks.length;
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let list = postings.get(t);
      if (!list) postings.set(t, (list = []));
      list.push([i, n]);
    }
  });
  const N = corpus.passages.length;
  const idf = new Map<string, number>();
  let idfSum = 0;
  const negative: string[] = [];
  for (const [t, list] of postings) {
    const v = Math.log(N - list.length + 0.5) - Math.log(list.length + 0.5);
    idf.set(t, v);
    idfSum += v;
    if (v < 0) negative.push(t);
  }
  const eps = EPSILON * (idfSum / Math.max(1, idf.size));
  for (const t of negative) idf.set(t, eps);
  return { corpus, postings, idf, docLen, avgdl: total / Math.max(1, N) };
}

export interface DocHit {
  index: number;
  score: number;
  bm25Rank: number;
}

/** BM25 상위 문단 — 점수 0 이하 제외, 문헌당 최대 2문단 */
export function searchIndex(idx: DocIndex, query: string, k = TOP_K): DocHit[] {
  const scores = new Map<number, number>();
  for (const t of expandQuery(query)) {
    const list = idx.postings.get(t);
    if (!list) continue;
    const w = idx.idf.get(t) ?? 0;
    for (const [i, tf] of list) {
      const s = (w * (tf * (K1 + 1))) / (tf + K1 * (1 - B + (B * idx.docLen[i]) / idx.avgdl));
      scores.set(i, (scores.get(i) ?? 0) + s);
    }
  }
  const ranked = [...scores].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const perDoc = new Map<string, number>();
  const hits: DocHit[] = [];
  ranked.forEach(([i, score], r) => {
    if (hits.length >= k) return;
    const doc = idx.corpus.passages[i][1];
    if ((perDoc.get(doc) ?? 0) >= MAX_PER_DOC) return;
    perDoc.set(doc, (perDoc.get(doc) ?? 0) + 1);
    hits.push({ index: i, score, bm25Rank: r + 1 });
  });
  return hits;
}

/** 검색 결과를 서버 답변과 같은 근거 카드 형식으로 */
export function toSources(idx: DocIndex, hits: DocHit[]): RagSource[] {
  return hits.map((h, n) => {
    const [id, docId, page, text] = idx.corpus.passages[h.index];
    const d = idx.corpus.docs[docId];
    return {
      rank: n + 1,
      doc_id: docId,
      page,
      text_preview: text.length <= PREVIEW_CHARS ? text : `${text.slice(0, PREVIEW_CHARS).trimEnd()}…`,
      rrf_score: Math.round(h.score * 1000) / 1000,
      id,
      file: d?.file ?? '',
      text,
      title: d?.title ?? null,
      doi: d?.doi ?? null,
      citation: d?.citation ?? null,
      dense_rank: null,
      bm25_rank: h.bm25Rank,
    };
  });
}

let indexPromise: Promise<DocIndex | null> | null = null;

/** 첫 질문 때 한 번만 내려받아 색인한다. 파일이 없거나 형식이 틀리면 null (일반 지식 답변으로) */
export function loadDocIndex(): Promise<DocIndex | null> {
  if (!indexPromise) {
    const base = import.meta.env?.BASE_URL ?? '/';
    indexPromise = fetch(`${base}data/rag_corpus.json`, { cache: 'force-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: WebCorpus | null) => (c && Array.isArray(c.passages) && c.passages.length > 0 ? buildIndex(c) : null))
      .catch(() => null)
      .then((idx) => {
        if (!idx) indexPromise = null; // 일시적인 실패면 다음 질문 때 다시 시도
        return idx;
      });
  }
  return indexPromise;
}
