/**
 * 대시보드 파생값 — 계산기 결과(DerivedCalculator)·체크리스트·실측 스냅샷을 묶는 순수 함수.
 * 가이드 §1.2 의 탭 간 인터페이스(calc_summary_kpi · calc_economic_params · checklist_readiness ·
 * actual_performance_gap)를 화면별 재계산 없이 한 곳에서 만든다.
 */
import { roundTo } from '@/lib/calc';
import type { DerivedCalculator } from '@/lib/calculatorModel';
import type { MeasuredEntry } from '@/lib/caseStore';
import type { ProgressStats, Readiness } from '@/lib/checklistStats';
import { kitLossAtBp } from '@/lib/calc_adapter';

/** calc_summary_kpi */
export interface CalcSummaryKpi {
  backPressure: number | null;
  /** 기준 배압 대비 증감률 [%] */
  backPressureDeltaPct: number | null;
  deltaP: number | null;
  stackTemp: number | null;
  lossMW: number | null;
  lossMonthlyWon: number | null;
  /** 세정 시 예상 회수 효과 = 키트 예상 회수 출력 ÷ 운전 출력 × 100 [%] */
  recoveryBenefitPct: number | null;
  cleaningNeedScore: number | null;
}

export function buildCalcSummaryKpi(d: DerivedCalculator): CalcSummaryKpi {
  const v = d.values;
  const m = d.metrics;
  const ok = (id: keyof typeof m) => (m[id].status === 'ok' ? m[id].value : null);
  const out = d.bp.outputMw;
  return {
    backPressure: v.currentBp,
    backPressureDeltaPct:
      v.currentBp !== null && v.referenceBp !== null && v.referenceBp > 0 ? roundTo(((v.currentBp - v.referenceBp) / v.referenceBp) * 100, 6) : null,
    deltaP: v.diffPressure,
    stackTemp: v.exhaustTemp,
    lossMW: ok('powerLossMw'),
    lossMonthlyWon: ok('monthlyLossKrw'),
    recoveryBenefitPct: (() => {
      const rec = ok('recoveredMw');
      return rec !== null && out !== null && out > 0 ? roundTo((rec / out) * 100, 6) : null;
    })(),
    cleaningNeedScore: ok('cleaningScore'),
  };
}

/** 공법별 회수 기간 — 키트 compareMethods 결과 (드라이아이스 = 계산기 입력, 나머지 = 키트 데이터) */
export interface MethodPayback {
  method: { id: string; name: string };
  costKrw: number | null;
  outageDays: number | null;
  paybackMonths: number | null;
  /** 비용·정지일수 등이 비어 키트가 「산출 불가」로 뺀 공법의 사유 */
  message: string | null;
}

export function buildMethodPaybacks(d: DerivedCalculator): MethodPayback[] {
  return d.kit.methods.map((r) => ({
    method: { id: r.id, name: r.name },
    costKrw: r.cost_krw ?? null,
    outageDays: r.outage_days ?? null,
    paybackMonths: r.payback_months ?? null,
    message: r.available ? null : (r.message ?? null),
  }));
}

/** checklist_readiness */
export interface ChecklistReadiness {
  totalCount: number;
  receivedCount: number;
  requiredMetCount: number;
  requiredTotal: number;
  readinessRate: number;
  missingIds: string[];
}

export function buildChecklistReadiness(summary: ProgressStats, r: Readiness): ChecklistReadiness {
  return {
    totalCount: summary.total,
    receivedCount: summary.receivedCount,
    requiredMetCount: r.requiredTotal - r.missingIds.length,
    requiredTotal: r.requiredTotal,
    readinessRate: summary.receivedPct,
    missingIds: r.missingIds,
  };
}

/** actual_performance_gap — 사용자 실측 스냅샷 기준 (없으면 null 값) */
export interface ActualPerformanceGap {
  /** 세정 당일(또는 세정 후 첫 측정) 배압 */
  d0BackPressure: number | null;
  d0Day: number | null;
  /** 가장 최근 측정 배압 */
  currentBackPressure: number | null;
  currentDay: number | null;
  currentStackTemp: number | null;
  /** 세정 전 평균 배압 기준 손실 − 현재 배압 기준 손실 [MW] (키트 손실식, 배압 외 입력은 계산기 값) */
  actualRecoveryMW: number | null;
  /** 최근 측정일이 손익분기 일수 이상 */
  bepAchieved: boolean | null;
}

export function buildActualPerformanceGap(entries: MeasuredEntry[], d: DerivedCalculator, breakEvenDays: number | null): ActualPerformanceGap {
  const bpEntries = entries.filter((e) => e.backPressure !== null).sort((a, b) => a.day - b.day);
  const post = bpEntries.filter((e) => e.day >= 0);
  const pre = bpEntries.filter((e) => e.day < 0);
  const d0 = post[0] ?? null;
  const latest = entries.length ? [...entries].sort((a, b) => a.day - b.day)[entries.length - 1] : null;
  const latestBp = bpEntries.length ? bpEntries[bpEntries.length - 1] : null;
  const preAvg = pre.length ? pre.reduce((s, e) => s + (e.backPressure as number), 0) / pre.length : null;
  const lossAt = (bp: number | null) => (bp === null ? null : kitLossAtBp(d.kit.run, bp));
  const lossPre = lossAt(preAvg);
  const lossNow = latestBp && latestBp.day >= 0 ? lossAt(latestBp.backPressure) : null;
  return {
    d0BackPressure: d0?.backPressure ?? null,
    d0Day: d0?.day ?? null,
    currentBackPressure: latestBp?.backPressure ?? null,
    currentDay: latest?.day ?? null,
    currentStackTemp: [...entries].sort((a, b) => b.day - a.day).find((e) => e.exhaustTemp !== null)?.exhaustTemp ?? null,
    actualRecoveryMW: lossPre !== null && lossNow !== null ? roundTo(lossPre - lossNow, 6) : null,
    bepAchieved: latest && latest.day >= 0 && breakEvenDays !== null ? latest.day >= breakEvenDays : null,
  };
}

/** 4단계 진행률 — 자료 준비 → 시뮬레이션 → 분석 → AI */
export type ProgressStep = 'data' | 'simulation' | 'analysis' | 'ai';
export const PROGRESS_STEPS: ProgressStep[] = ['data', 'simulation', 'analysis', 'ai'];

export function buildStepProgress(input: {
  requiredMet: boolean;
  calcValid: boolean;
  calcStale: boolean;
  snapshots: number;
  aiMessages: number;
}): Record<ProgressStep, boolean> {
  return {
    data: input.requiredMet,
    simulation: input.calcValid && !input.calcStale,
    analysis: input.snapshots > 0,
    ai: input.aiMessages > 0,
  };
}
