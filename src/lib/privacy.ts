/**
 * 보안·RAG 가드 (최종 구현 가이드 §3.2) — React와 무관한 순수 함수.
 * - maskSensitive: AI 질의 전송·기록 전에 전화번호·이메일·발전소 고유 명칭을 [마스킹] 처리
 * - findUnsupportedNumbers: AI 답변의 수치가 검색된 상위 문맥에 없으면 '출처 외 수치'로 돌려준다
 */

export const MASK = '[마스킹]';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** 휴대전화 · 지역번호 유선 · 국제 표기 (숫자에 붙어 있으면 제외) */
const PHONE_RES = [
  /(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g,
  /(?<!\d)0(?:2|[3-6][1-5]|70)[-.\s)]?\d{3,4}[-.\s]?\d{4}(?!\d)/g,
  /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g,
];
/** '○○발전소', '○○복합화력발전소', '○○발전본부' 같은 고유 명칭 */
const PLANT_KO_RE = /([가-힣A-Za-z0-9]{1,15}?)(복합화력|화력|복합)?(발전소|발전본부|발전처|화력본부)/g;
const PLANT_EN_RE = /\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?\s(?:Power\s(?:Plant|Station)|Generating\sStation|CCPP)\b/g;
/** 고유 명칭이 아닌 일반 수식어 — 이 단어 + 발전소는 마스킹하지 않는다 */
const GENERIC_PREFIX = new Set([
  '복합', '화력', '복합화력', '원자력', '수력', '양수', '태양광', '풍력', '열병합', '가스', '석탄', 'LNG', '해당', '우리', '이', '그', '각', '국내',
  '해외', '전체', '대상', '기존', '신규', '일반', '모든', '여러', '전국',
]);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 질문 문장의 민감 정보를 [마스킹]으로 바꾼다. extraNames 는 케이스에 적은 고객사/발전소명 등 */
export function maskSensitive(text: string, extraNames: string[] = []): string {
  let out = text.replace(EMAIL_RE, MASK);
  for (const re of PHONE_RES) out = out.replace(re, MASK);
  for (const name of extraNames) {
    const n = name.trim();
    if (n.length >= 2) out = out.replace(new RegExp(escapeRe(n), 'g'), MASK);
  }
  out = out.replace(PLANT_KO_RE, (whole, prefix: string, mid: string | undefined) => {
    const head = prefix + (mid ?? '');
    return GENERIC_PREFIX.has(prefix) || GENERIC_PREFIX.has(head) ? whole : MASK;
  });
  out = out.replace(PLANT_EN_RE, MASK);
  return out;
}

/** 답변 속 수치 — 인용 번호 [1], 목록 번호 "1." 은 빼고, 한 자리 정수(문장 속 '2개' 등)는 오탐이 많아 제외 */
function extractNumbers(text: string): string[] {
  const stripped = text.replace(/\[\d+\](?:\[\d+\])*/g, ' ').replace(/^\s*\d+[.)]\s/gm, ' ');
  const found = stripped.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return found.map((n) => n.replace(/,/g, '')).filter((n) => n.includes('.') || n.length >= 2);
}

/**
 * 근거 문맥(검색 상위 문단 + 질문)에 나오지 않는 답변 수치 목록.
 * 비어 있지 않으면 화면에 '출처 외 수치 포함 주의' 배지를 표시한다.
 */
export function findUnsupportedNumbers(answer: string, contexts: string[]): string[] {
  const corpus = contexts.join('\n').replace(/(\d),(?=\d{3})/g, '$1');
  const known = new Set(corpus.match(/\d+(?:\.\d+)?/g) ?? []);
  const missing = extractNumbers(answer).filter((n) => {
    if (known.has(n)) return false;
    // 12.0 ↔ 12 처럼 표기만 다른 값
    const v = Number(n);
    return ![...known].some((k) => Number(k) === v);
  });
  return [...new Set(missing)];
}
