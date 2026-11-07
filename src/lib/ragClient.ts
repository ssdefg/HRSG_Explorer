import type { Lang } from '@/types';
import type { ContextSnapshot } from '@/lib/aiContext';

/**
 * 참고문헌 RAG 서버(server/app.py) 클라이언트.
 * 개발 중에는 Vite가 /api 를 http://127.0.0.1:8000 으로 프록시한다 (vite.config.ts).
 */

export interface RagSource {
  /** 검색 순위 = 답변 속 인용 번호 [rank] */
  rank: number;
  doc_id: string;
  page: number;
  /** 문단 앞부분 100자 */
  text_preview: string;
  rrf_score: number;
  id: string;
  /** 원본 PDF 파일명 (rag/doc_map.json) */
  file: string;
  /** 문단 전문 */
  text: string;
  /** 서지 (rag/bibliography.json) — 없으면 null */
  title?: string | null;
  doi?: string | null;
  citation?: string | null;
  /** 검색 방식 — BGE-M3 dense · BM25 각각의 후보 순위 (후보 40개 밖이면 null) */
  dense_rank?: number | null;
  bm25_rank?: number | null;
}

export type RagLlmStatus = 'ok' | 'unavailable' | 'refusal' | 'error';

export interface RagResult {
  /** LLM 답변 — 자격 증명 없음·오류·거절이면 null (검색 결과만 표시) */
  answer: string | null;
  llmStatus: RagLlmStatus;
  llmMessage?: string;
  model?: string;
  sources: RagSource[];
  retrievalMs: number;
  llmMs?: number;
  /** direct: RAG 서버 없이 브라우저에서 Gemini 직결 (근거 문단 없음). 없으면 RAG 서버 답변 */
  mode?: 'rag' | 'direct';
}

export interface RagHealth {
  passages: number;
  docs: number;
  device: string;
  model: string;
}

/** 서버에 연결할 수 없거나 응답 형식이 맞지 않을 때 */
export class RagUnavailableError extends Error {}

const ASK_TIMEOUT_MS = 120_000;

/** 서버로 보내는 화면 데이터 — 라벨·값·단위만 (id·시각 등 내부 필드는 보내지 않음) */
export function contextPayload(ctx: ContextSnapshot) {
  return { page: ctx.page, title: ctx.title, items: ctx.items.map(({ label, value, unit }) => ({ label, value, unit: unit ?? null })) };
}

export async function askRag(question: string, lang: Lang, context?: ContextSnapshot): Promise<RagResult> {
  let res: Response;
  try {
    res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, lang, context: context ? contextPayload(context) : null }),
      signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
    });
  } catch (e) {
    throw new RagUnavailableError(String(e));
  }
  if (!res.ok) throw new RagUnavailableError(`HTTP ${res.status}`);
  const d = await res.json();
  if (!Array.isArray(d?.sources)) throw new RagUnavailableError('invalid response');
  return {
    answer: typeof d.answer === 'string' ? d.answer : null,
    llmStatus: d.llm_status,
    llmMessage: d.llm_message ?? undefined,
    model: d.model ?? undefined,
    sources: d.sources,
    retrievalMs: d.retrieval_ms,
    llmMs: d.llm_ms ?? undefined,
    mode: 'rag',
  };
}

export async function fetchRagHealth(): Promise<RagHealth | null> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
