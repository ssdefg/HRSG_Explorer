/**
 * 세정 전후 운전 조건 편차 가드 (가이드 §2.5) — 순수 함수.
 * |ΔLoadFactor| > 5 %p 또는 |ΔT_ambient| > 5 °C 이면 세정 효과를 단정하지 않는다.
 */
import { parseNumericInput } from '@/lib/number';

export const CONDITION_LIMITS = { loadPct: 5, ambientC: 5 } as const;

export interface ConditionInput {
  beforeLoadPct: string;
  afterLoadPct: string;
  beforeAmbientC: string;
  afterAmbientC: string;
}

export interface ConditionDeviation {
  loadDiff: number | null;
  ambientDiff: number | null;
  exceeded: boolean;
}

const num = (s: string, allowNegative = false): number | null => {
  const r = parseNumericInput(s, allowNegative ? { min: -100 } : {});
  return r.ok ? r.value : null;
};

const absDiff = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round(Math.abs(b - a) * 1e6) / 1e6);

export function assessConditionDeviation(c: ConditionInput): ConditionDeviation {
  const loadDiff = absDiff(num(c.beforeLoadPct), num(c.afterLoadPct));
  // 외기온도는 영하일 수 있다
  const ambientDiff = absDiff(num(c.beforeAmbientC, true), num(c.afterAmbientC, true));
  return {
    loadDiff,
    ambientDiff,
    exceeded: (loadDiff !== null && loadDiff > CONDITION_LIMITS.loadPct) || (ambientDiff !== null && ambientDiff > CONDITION_LIMITS.ambientC),
  };
}
