import type { Lang } from '@/types';
import type { ContextSnapshot } from '@/lib/aiContext';
import type { RagLlmStatus, RagResult } from '@/lib/ragClient';
import { maskSensitive } from '@/lib/privacy';

/**
 * Gemini 직결 모드 — RAG 서버(server/app.py) 없이 정적 사이트만 배포했을 때 브라우저에서 Gemini API 를 직접 부른다.
 * 참고문헌 검색이 없으므로 근거 문단·인용 번호 없이, 아래 HRSG 일반 지식 컨텍스트와 첨부 화면 데이터만 넣는다.
 *
 * VITE_GEMINI_API_KEY 는 빌드 시 JS 번들에 그대로 들어가 사이트 방문자 누구나 볼 수 있다.
 * Google Cloud 콘솔에서 키를 배포 도메인(HTTP 리퍼러)과 Generative Language API 로만 제한해 둔다.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODELS = 'gemini-3.5-flash,gemini-3.8-flash'; // server/app.py RAG_MODEL 기본값과 같다
const MAX_OUTPUT_TOKENS = 8192;
/** 모델 하나당 — 두 모델을 다 시도해도 askRag 타임아웃(120s)보다 짧게 (server/app.py 와 같은 값) */
const LLM_TIMEOUT_MS = 45_000;
const FALLBACK_CODES = new Set([404, 429, 500, 502, 503, 504]);
const BLOCKED_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

/**
 * 빌드 시 주입된 키 — VITE_GEMINI_API_KEY, 없으면 VITE_gemini_API (테스트 런너처럼 import.meta.env 가 없으면 빈 문자열).
 * Vite 는 VITE_ 로 시작하는 변수만 번들에 넣으므로 접두사 없는 이름(gemini_API 등)은 읽을 수 없다.
 */
function directKey(): string {
  const env = import.meta.env;
  return (env?.VITE_GEMINI_API_KEY || env?.VITE_gemini_API || '').trim();
}

/** 직결 모드를 쓸 수 있는지 — 키가 빌드에 들어 있을 때만 */
export function hasDirectKey(): boolean {
  return directKey().length > 0;
}

export function directModels(): string[] {
  return (import.meta.env?.VITE_GEMINI_MODEL || DEFAULT_MODELS)
    .split(',')
    .map((m: string) => m.trim())
    .filter(Boolean);
}

export const DIRECT_SYSTEM_PROMPT = `You are a technical assistant for combined-cycle power plant engineers working on HRSG (heat recovery steam generator) maintenance.
The literature search server is not available, so no reference passages are provided. Answer from general engineering knowledge and the background below.

- Say at the start of the answer, in one short clause, that it is based on general knowledge without literature search ("문헌 검색 없이 일반 지식 기준" / "general knowledge, no literature search").
- Never invent citations, reference numbers like [1], paper titles, standards clauses or DOIs.
- Give typical ranges only when they are widely accepted, and mark them as typical values to be checked against plant design documents.
- The message may include a block "[현재 화면 데이터]" with values from the HRSG Explorer app (mock data and example calculations).
  Call them "앱 계산값" / "app values" and do not present them as measured or validated plant data.
- If you are not sure, say so plainly and state what data would be needed.
- Reply in the language of the question (Korean or English). Use short paragraphs; you may use "- " bullet lines, numbered steps and **bold** for key terms. No tables.
- Keep the answer focused: usually 3-8 sentences.`;

/** 일반 HRSG 지식 컨텍스트 — 앱(키트) 계산 가정과 용어. 문헌 인용이 아니라 배경 설명으로만 넣는다. */
export const HRSG_BACKGROUND = `[HRSG 일반 배경 — HRSG Explorer 앱의 계산 가정, 문헌 아님]
- HRSG 가스측 오염(파울링)이 쌓이면 가스측 차압과 GT 배압이 오르고 스택 온도가 올라간다. 배압 상승은 GT 출력을, 스택 온도 상승은 회수 열량(ST 출력)을 줄인다.
- 앱은 팀 공통 계산 키트(DEMO 값)를 쓴다: 출력 손실 = GT 정격 × 0.08 %/mbar × 초과 압력 × 부하율 + ST 정격 × 0.12 %/°C × 스택 초과 온도 × 부하율.
- 초과 압력은 HRSG 차압 초과와 GT 배압 초과 중 큰 값 하나만 쓴다 (이중 계산 방지). 월간 손실 = 손실 MW × 월간 가동 시간 × 전력 단가.
- 세정 공법(기계식·고압수·드라이아이스·화학)은 회수율·비용·정지일수가 다르며, 앱은 회수기간이 가장 짧은 공법을 "가정 기준, 추천 아님"으로만 표시한다.
- 핀치 = 증발기 출구 가스 온도 − 드럼 포화 온도, 어프로치 = 포화 온도 − 이코노마이저 출구 수온. 어프로치가 0 이하이면 이코노마이저 스티밍 위험이다.`;

function formatValue(v: ContextSnapshot['items'][number]['value']): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Math.abs(v) < 1e6 ? String(Number(v.toPrecision(6))) : Math.round(v).toLocaleString('en-US');
  return maskSensitive(v).slice(0, 60);
}

/** 첨부 화면 데이터 — server/app.py build_screen_context 와 같은 형식 (문자열 값은 한 번 더 마스킹) */
export function buildScreenContext(ctx?: ContextSnapshot): string {
  if (!ctx || ctx.items.length === 0) return '';
  const lines = [`[현재 화면 데이터 — HRSG Explorer 앱 계산값, 문헌 아님] ${maskSensitive(ctx.title)}`];
  for (const it of ctx.items.slice(0, 40)) lines.push(`- ${maskSensitive(it.label)}: ${formatValue(it.value)}${it.unit ? ` ${it.unit}` : ''}`);
  return lines.join('\n');
}

export function buildDirectUserText(question: string, context?: ContextSnapshot): string {
  return [HRSG_BACKGROUND, buildScreenContext(context), `[질문]\n${maskSensitive(question)}`].filter(Boolean).join('\n\n');
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
}

/** server/app.py parse_response 와 같은 판정 */
export function parseGeminiResponse(d: GeminiResponse, model: string): { answer: string | null; status: RagLlmStatus; message?: string; model: string } {
  const served = d.modelVersion || model;
  if (d.promptFeedback?.blockReason) return { answer: null, status: 'refusal', message: `질문이 안전 정책으로 차단되었습니다 (${d.promptFeedback.blockReason}).`, model: served };
  const cand = d.candidates?.[0];
  const finish = cand?.finishReason;
  if (finish && BLOCKED_FINISH.has(finish)) return { answer: null, status: 'refusal', message: `모델이 답변을 생성하지 않았습니다 (${finish}).`, model: served };
  let text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) return { answer: null, status: 'error', message: `모델이 빈 응답을 반환했습니다 (${finish ?? '—'}).`, model: served };
  if (finish === 'MAX_TOKENS') text += '\n\n(답변이 길이 제한으로 잘렸습니다.)';
  return { answer: text, status: 'ok', model: served };
}

/** 네트워크 자체가 안 될 때 — 호출한 쪽에서 '연결 오류 · 다시 시도'로 표시한다 */
export class DirectUnavailableError extends Error {}

/** 브라우저에서 Gemini 로 직접 질의 — 결과는 RAG 답변과 같은 형태(근거 문단 0개, mode: 'direct') */
export async function askGeminiDirect(question: string, _lang: Lang, context?: ContextSnapshot): Promise<RagResult> {
  const key = directKey();
  const base = { sources: [], retrievalMs: 0, mode: 'direct' as const };
  if (!key) return { ...base, answer: null, llmStatus: 'unavailable' };
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: DIRECT_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildDirectUserText(question, context) }] }],
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  });
  const t0 = performance.now();
  let last: { status: RagLlmStatus; message: string; model?: string } = { status: 'error', message: '사용할 모델이 없습니다.' };
  let reached = false;
  for (const model of directModels()) {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      });
    } catch {
      // 네트워크 오류·시간 초과 — 다음 모델로
      last = { status: 'error', message: `Gemini 요청 실패 (${model})`, model };
      continue;
    }
    reached = true;
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      const msg = String(detail?.error?.message ?? '').slice(0, 160);
      last = { status: 'error', message: `Gemini ${model} 오류 ${res.status}${msg ? `: ${msg}` : ''}`, model };
      if (FALLBACK_CODES.has(res.status)) continue;
      break; // 400·401·403 (키 오류·권한) 은 다른 모델로 바꿔도 같다
    }
    const r = parseGeminiResponse(await res.json(), model);
    return { ...base, answer: r.answer, llmStatus: r.status, llmMessage: r.message, model: r.model, llmMs: performance.now() - t0 };
  }
  if (!reached) throw new DirectUnavailableError(last.message);
  return { ...base, answer: null, llmStatus: last.status, llmMessage: last.message, model: last.model, llmMs: performance.now() - t0 };
}
