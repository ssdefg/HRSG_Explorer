import type { Lang } from '@/types';
import type { MetricStatus } from '@/lib/calc';
import { METRIC_DEPS, type Metric, type MetricId } from '@/lib/calculatorModel';
import type { CalculatorState } from '@/context/Workspace';
import { INPUT_DEF } from '@/data/calculatorInputs';
import { formatNumber } from '@/lib/format';

export const METRIC_STATUS_TEXT: Record<Lang, Record<Exclude<MetricStatus, 'ok'>, string>> = {
  ko: { invalid: '산출 불가', model: '모델 미연동 · 평가 보류' },
  en: { invalid: 'Not computable', model: 'Model not connected · on hold' },
};

/** 산출 불가 사유 — 오류가 있는 의존 입력 이름 */
export function invalidReason(state: CalculatorState, id: MetricId, lang: Lang): string {
  const bad = METRIC_DEPS[id].filter((dep) => state.errors[dep] !== null).map((dep) => INPUT_DEF[dep].label[lang]);
  if (state.metrics[id].status === 'model') {
    return lang === 'ko'
      ? '사용자 입력 모드에서는 검증되지 않은 배압→출력 손실 계수를 쓰지 않습니다.'
      : 'User-input mode does not use the unverified back-pressure→loss coefficient.';
  }
  if (bad.length === 0) return lang === 'ko' ? '입력 조건상 계산할 수 없습니다 (예: 편익 0 이하).' : 'Not computable for these inputs (e.g., benefit ≤ 0).';
  return lang === 'ko' ? `입력 확인 필요: ${bad.join(', ')}` : `Check inputs: ${bad.join(', ')}`;
}

/** 값 또는 '—' (계산 불가 시 내부 값은 null, 이전 값을 보여주지 않는다) */
export function fmtMetric(m: Metric, lang: Lang, digits = 0): string {
  return m.status === 'ok' && m.value !== null ? formatNumber(m.value, lang, digits) : '—';
}

/** 상태 표시 — ok가 아니면 사유 툴팁이 붙은 배지 */
export function MetricStatusTag({ state, id, lang }: { state: CalculatorState; id: MetricId; lang: Lang }) {
  const m = state.metrics[id];
  if (m.status === 'ok') return null;
  return (
    <span className={`metric-tag metric-tag--${m.status}`} title={invalidReason(state, id, lang)}>
      {METRIC_STATUS_TEXT[lang][m.status]}
    </span>
  );
}
