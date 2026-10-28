import type { QaPresetId, QaPreset } from '@/data/qaPresets';

/**
 * 시연용 질문 매칭 — 실제 AI/자연어 이해가 아니다.
 * 입력 문장을 준비된 질문 목록과 대조해 가장 가까운 항목을 고르고, 근거가 약하면 null을 돌려준다.
 */

export type MatchResult = { id: QaPresetId; via: 'exact' | 'keyword'; score: number } | null;

/** 소문자화, 공백·문장부호 제거 */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\s.,!?·'"’“”()[\]{}:;~\-_/]+/g, '');
}

/** 핵심어 1개 = 2점, 보조어 1개 = 1점. 핵심어 없이 보조어만으로는 매칭하지 않는다. */
export const MIN_MATCH_SCORE = 3;

export function matchQuestion(text: string, presets: QaPreset[]): MatchResult {
  const q = normalizeQuestion(text);
  if (q.length < 2) return null;

  for (const p of presets) {
    if (normalizeQuestion(p.question.ko) === q || normalizeQuestion(p.question.en) === q) {
      return { id: p.id, via: 'exact', score: Infinity };
    }
  }

  let best: MatchResult = null;
  for (const p of presets) {
    const req = p.required.filter((k) => q.includes(k)).length;
    if (req === 0) continue;
    const score = req * 2 + p.related.filter((k) => q.includes(k)).length;
    if (score >= MIN_MATCH_SCORE && (best === null || score > best.score)) {
      best = { id: p.id, via: 'keyword', score };
    }
  }
  return best;
}
