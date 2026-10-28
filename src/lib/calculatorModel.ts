/**
 * 계산기 파생 모델 — 케이스의 원문 입력 → 파싱·검증 → 중앙 계산 엔진 → 모드별 게이팅.
 * 대시보드·계산기·AI 답변은 모두 이 함수 결과만 사용한다 (화면별 계산식 중복 금지).
 */
import {
  computeCleaningEconomics,
  computeEconomics,
  gateByMode,
  type BackpressureLevel,
  type CleaningEconomicsResult,
  type EconomicsResult,
  type MetricStatus,
} from '@/lib/calc';
import { parseNumericInput, type ParseResult } from '@/lib/number';
import { NUMERIC_INPUTS, hrsgClassDef, type NumericInputId } from '@/data/calculatorInputs';
import type { CalcCaseState } from '@/lib/caseStore';

export type InputErrorReason = Extract<ParseResult, { ok: false }>['reason'];
export type ParsedValues = Record<NumericInputId, number | null>;
export type InputErrors = Record<NumericInputId, InputErrorReason | null>;

export interface Metric {
  value: number | null;
  status: MetricStatus;
}

export type MetricId =
  | 'deltaBp'
  | 'powerLossMw'
  | 'monthlyLossKrw'
  | 'effectiveHours'
  | 'additionalRevenueKrw'
  | 'shutdownLossKrw'
  | 'initialInvestmentKrw'
  | 'netBenefitKrw'
  | 'monthlyIncrementalBenefitKrw'
  | 'paybackMonths'
  | 'breakEvenDays';

/** 결과별 의존 입력 — '산출 불가' 사유 표시에 사용 */
const CLEANING_DEPS: NumericInputId[] = ['recoveredPowerMw', 'operatingHours', 'shutdownDays', 'smp', 'cleaningCostKrw', 'additionalCostKrw', 'capacityMw', 'loadPct'];
export const METRIC_DEPS: Record<MetricId, NumericInputId[]> = {
  deltaBp: ['currentBp', 'referenceBp'],
  powerLossMw: ['currentBp', 'referenceBp'],
  monthlyLossKrw: ['currentBp', 'referenceBp', 'operatingHours', 'smp'],
  effectiveHours: ['operatingHours', 'shutdownDays'],
  additionalRevenueKrw: ['recoveredPowerMw', 'operatingHours', 'shutdownDays', 'smp'],
  shutdownLossKrw: ['capacityMw', 'loadPct', 'shutdownDays', 'smp'],
  initialInvestmentKrw: ['cleaningCostKrw', 'additionalCostKrw', 'capacityMw', 'loadPct', 'shutdownDays', 'smp'],
  netBenefitKrw: CLEANING_DEPS,
  monthlyIncrementalBenefitKrw: ['recoveredPowerMw', 'operatingHours', 'smp'],
  paybackMonths: CLEANING_DEPS,
  breakEvenDays: CLEANING_DEPS,
};

/** 배압→출력 손실 계수(0.015)를 쓰는 결과 — 사용자 입력 모드에서는 '모델 미연동'으로 보류 */
const REQUIRES_MODEL: Record<MetricId, boolean> = {
  deltaBp: false,
  powerLossMw: true,
  monthlyLossKrw: true,
  effectiveHours: false,
  additionalRevenueKrw: false,
  shutdownLossKrw: false,
  initialInvestmentKrw: false,
  netBenefitKrw: false,
  monthlyIncrementalBenefitKrw: false,
  paybackMonths: false,
  breakEvenDays: false,
};

export interface DerivedCalculator {
  values: ParsedValues;
  errors: InputErrors;
  /** 입력 오류가 있는 필드 */
  errorIds: NumericInputId[];
  /** 모든 필수 입력이 유효함 */
  valid: boolean;
  model: string;
  /** 엔진 원결과 (게이팅 전) */
  bp: EconomicsResult;
  cleaning: CleaningEconomicsResult;
  /** 화면 표시용 — 상태(ok/invalid/model) 포함 */
  metrics: Record<MetricId, Metric>;
  level: BackpressureLevel | null;
  /** 같은 입력인지 판별하는 키 (스냅샷 최신 여부) */
  inputsKey: string;
}

export function parseCalcInputs(raw: Record<NumericInputId, string>): { values: ParsedValues; errors: InputErrors } {
  const values = {} as ParsedValues;
  const errors = {} as InputErrors;
  for (const d of NUMERIC_INPUTS) {
    const text = raw[d.id] ?? '';
    if (d.optional && text.trim() === '') {
      values[d.id] = null;
      errors[d.id] = null;
      continue;
    }
    const r = parseNumericInput(text, { min: d.min, max: d.max });
    values[d.id] = r.ok ? r.value : null;
    errors[d.id] = r.ok ? null : r.reason;
  }
  return { values, errors };
}

export function deriveCalculator(calc: CalcCaseState): DerivedCalculator {
  const { values, errors } = parseCalcInputs(calc.raw);
  const errorIds = NUMERIC_INPUTS.filter((d) => errors[d.id] !== null).map((d) => d.id);
  const bp = computeEconomics({
    currentBp: values.currentBp,
    referenceBp: values.referenceBp,
    operatingHours: values.operatingHours,
    smp: values.smp,
    capacityMw: values.capacityMw,
    loadPct: values.loadPct,
  });
  const cleaning = computeCleaningEconomics({
    recoveredPowerMw: values.recoveredPowerMw,
    operatingHours: values.operatingHours,
    shutdownDays: values.shutdownDays,
    smp: values.smp,
    cleaningCostKrw: values.cleaningCostKrw,
    additionalCostKrw: values.additionalCostKrw,
    outputMw: bp.outputMw,
  });
  const rawMetric: Record<MetricId, number | null> = {
    deltaBp: bp.deltaBp,
    powerLossMw: bp.powerLossMw,
    monthlyLossKrw: bp.monthlyLossKrw,
    effectiveHours: cleaning.effectiveHours,
    additionalRevenueKrw: cleaning.additionalRevenueKrw,
    shutdownLossKrw: cleaning.shutdownLossKrw,
    initialInvestmentKrw: cleaning.initialInvestmentKrw,
    netBenefitKrw: cleaning.netBenefitKrw,
    monthlyIncrementalBenefitKrw: cleaning.monthlyIncrementalBenefitKrw,
    paybackMonths: cleaning.paybackMonths,
    breakEvenDays: cleaning.breakEvenDays,
  };
  const metrics = Object.fromEntries(
    (Object.keys(rawMetric) as MetricId[]).map((id) => {
      // 의존 입력 중 오류가 있으면 이전 값이 아니라 '산출 불가'
      const depError = METRIC_DEPS[id].some((dep) => errors[dep] !== null);
      const gated = gateByMode(depError ? null : rawMetric[id], calc.mode, REQUIRES_MODEL[id]);
      return [id, gated];
    }),
  ) as Record<MetricId, Metric>;

  return {
    values,
    errors,
    errorIds,
    valid: errorIds.length === 0,
    model: hrsgClassDef(calc.hrsgClass).demoModel,
    bp,
    cleaning,
    metrics,
    level: errors.currentBp === null ? bp.level : null,
    inputsKey: JSON.stringify([calc.mode, calc.hrsgClass, NUMERIC_INPUTS.map((d) => values[d.id])]),
  };
}

/** 배압 기반 손실 지표를 쓰는지 (사용자 입력 모드 안내용) */
export function metricRequiresModel(id: MetricId): boolean {
  return REQUIRES_MODEL[id];
}
