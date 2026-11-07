/**
 * 계산기 파생 모델 — 케이스의 원문 입력 → 파싱·검증 → 키트 계산(calc_adapter) → 화면 공통 결과.
 * 대시보드·계산기·AI 답변은 모두 이 함수 결과만 사용한다 (화면별 계산식 중복 금지).
 * 계산식의 단일 기준은 키트(hrsg_calc_kit_team1)다. 이 파일은 결과를 화면 모양으로 옮기기만 한다.
 */
import {
  calcLossSharePct,
  calcOperatingOutputMw,
  roundTo,
  type BackpressureLevel,
  type CleaningEconomicsResult,
  type EconomicsResult,
  type MetricStatus,
  type PinchApproachResult,
} from '@/lib/calc';
import { parseNumericInput, type ParseResult } from '@/lib/number';
import { NUMERIC_INPUTS, STACK_TEMP_SAFETY_LIMIT_C, hrsgClassDef, unitDef, type NumericInputId } from '@/data/calculatorInputs';
import { bpBands, runKit, type BpBands, type KitRun } from '@/lib/calc_adapter';
import type { KitMethodRow, KitResult } from '@/lib/kit';
import type { CalcCaseState } from '@/lib/caseStore';

export type InputErrorReason = Extract<ParseResult, { ok: false }>['reason'] | 'safety';
export type ParsedValues = Record<NumericInputId, number | null>;
export type InputErrors = Record<NumericInputId, InputErrorReason | null>;

export interface Metric {
  value: number | null;
  status: MetricStatus;
}

export type MetricId =
  | 'deltaBp'
  | 'gtLossMw'
  | 'stLossMw'
  | 'powerLossMw'
  | 'monthlyLossKrw'
  | 'annualLossKrw'
  | 'recoveredMw'
  | 'shutdownLossKrw'
  | 'initialInvestmentKrw'
  | 'netBenefitKrw'
  | 'monthlyIncrementalBenefitKrw'
  | 'paybackMonths'
  | 'breakEvenDays'
  | 'cleaningScore';

/** 키트 calculate 가 반드시 필요로 하는 입력 — 하나라도 오류면 키트 결과 전체가 「산출 불가」 */
const KIT_CORE: NumericInputId[] = [
  'capacityMw',
  'loadPct',
  'currentBp',
  'referenceBp',
  'diffPressure',
  'exhaustTemp',
  'referenceStackTemp',
  'operatingHours',
  'smp',
];
/** 화면 공법(드라이아이스) 입력 — 오류면 그 공법만 키트가 「산출 불가 — 입력 필요」로 뺀다 */
const METHOD_INPUTS: NumericInputId[] = ['cleaningCostKrw', 'shutdownDays', 'additionalCostKrw', 'recoveredPowerMw'];

/** 결과별 의존 입력 — '산출 불가' 사유 표시에 사용 */
export const METRIC_DEPS: Record<MetricId, NumericInputId[]> = {
  deltaBp: KIT_CORE,
  gtLossMw: KIT_CORE,
  stLossMw: KIT_CORE,
  powerLossMw: KIT_CORE,
  monthlyLossKrw: KIT_CORE,
  annualLossKrw: KIT_CORE,
  recoveredMw: [...KIT_CORE, ...METHOD_INPUTS],
  shutdownLossKrw: [...KIT_CORE, ...METHOD_INPUTS],
  initialInvestmentKrw: [...KIT_CORE, ...METHOD_INPUTS],
  netBenefitKrw: [...KIT_CORE, ...METHOD_INPUTS],
  monthlyIncrementalBenefitKrw: [...KIT_CORE, ...METHOD_INPUTS],
  paybackMonths: [...KIT_CORE, ...METHOD_INPUTS],
  breakEvenDays: [...KIT_CORE, ...METHOD_INPUTS],
  cleaningScore: KIT_CORE,
};

export interface DerivedCalculator {
  values: ParsedValues;
  errors: InputErrors;
  /** 입력 오류가 있는 필드 */
  errorIds: NumericInputId[];
  /** 모든 필수 입력이 유효함 */
  valid: boolean;
  model: string;
  /** 화면용 요약 (키트 결과에서 옮김) */
  bp: EconomicsResult;
  cleaning: CleaningEconomicsResult;
  /** 화면 표시용 — 상태(ok/invalid) 포함 */
  metrics: Record<MetricId, Metric>;
  /** 종합 판정 (키트 overall_level — GT 배압·HRSG 차압·스택 온도 중 가장 나쁜 것) */
  level: BackpressureLevel | null;
  /** GT 배압 판정 구간 [mmH₂O] (키트 지표, 기준 배압으로 다시 맞춘 값) */
  bands: BpBands | null;
  /** IAPWS-IF97 포화온도 기준 HP 핀치/어프로치 (키트 pinchSection) */
  pinch: PinchApproachResult;
  /** 입력 경고 (오류는 아님) — 현재 배압 < 기준 배압이면 GT 배압 초과분 0 */
  warnings: { bpBelowBaseline: boolean };
  /** 키트 원결과 · 공법 비교 · 경고 (키트 화면 요소를 그대로 쓰는 곳에서 사용) */
  kit: {
    run: KitRun;
    result: KitResult | null;
    methods: KitMethodRow[];
    bestPaybackId: string | null;
    maxNetBenefitId: string | null;
    /** 키트 결과 경고 + 입력 형식 경고 */
    messages: string[];
  };
  /** 같은 입력인지 판별하는 키 (스냅샷 최신 여부) */
  inputsKey: string;
}

export type InputUnits = Partial<Record<NumericInputId, string>>;

/**
 * 원문 입력(선택 단위) → 기준 단위 값. 범위 검증은 기준 단위로 한다.
 * 스택 온도가 안전 한계를 넘으면 범위 초과가 아니라 'safety'로 구분한다 (가이드 §3.1).
 */
export function parseCalcInputs(raw: Record<NumericInputId, string>, units: InputUnits = {}): { values: ParsedValues; errors: InputErrors } {
  const values = {} as ParsedValues;
  const errors = {} as InputErrors;
  for (const d of NUMERIC_INPUTS) {
    const text = raw[d.id] ?? '';
    if (d.optional && text.trim() === '') {
      values[d.id] = null;
      errors[d.id] = null;
      continue;
    }
    const r = parseNumericInput(text, { min: d.unitKind ? undefined : d.min, integer: d.integer });
    let reason: InputErrorReason | null = r.ok ? null : r.reason;
    let v: number | null = null;
    if (r.ok) {
      v = d.unitKind ? unitDef(d.unitKind, units[d.id]).toBase(r.value) : r.value;
      // 단위 환산의 부동소수 오차가 범위 경계에서 오류를 내지 않게 정리
      v = Math.round(v * 1e9) / 1e9;
      if (d.id === 'exhaustTemp' && v > STACK_TEMP_SAFETY_LIMIT_C) reason = 'safety';
      else if (v < d.min) reason = 'min';
      else if (v > d.max) reason = 'max';
    }
    values[d.id] = reason === null ? v : null;
    errors[d.id] = reason;
  }
  return { values, errors };
}

const EMPTY_PINCH = (run: KitRun): PinchApproachResult => ({
  tSatC: run.pinch.t_sat_c ?? null,
  pinchC: run.pinch.current?.pinch_c ?? null,
  approachC: run.pinch.current?.approach_c ?? null,
  level: run.pinch.level,
  design: run.pinch.design,
  message: run.pinch.message,
});

export function deriveCalculator(calc: CalcCaseState): DerivedCalculator {
  const { values, errors } = parseCalcInputs(calc.raw, calc.units);
  const errorIds = NUMERIC_INPUTS.filter((d) => errors[d.id] !== null).map((d) => d.id);

  // 오류인 입력은 null 로 넘긴다 — 핵심 입력이면 키트가 계산하지 않고, 공법·핀치 입력이면 그 부분만 「산출 불가」·「데이터 필요」
  const run = runKit(values, calc.hrsgClass);
  const r = run.result;
  const kpi = r?.kpi;
  const best = r ? (r.methods.rows.find((m) => m.id === r.methods.best_payback_id) ?? null) : null;
  const monthlyHours = values.operatingHours;
  const outputMw = calcOperatingOutputMw(values.capacityMw, values.loadPct);
  const mm = (v: number | undefined | null) => (v === undefined || v === null ? null : roundTo(v, 6));

  const rawMetric: Record<MetricId, number | null> = {
    deltaBp: mm(kpi?.excess_bp.mmh2o),
    gtLossMw: mm(r?.loss.gt_mw),
    stLossMw: mm(r?.loss.st_mw),
    powerLossMw: mm(kpi?.power_loss_mw),
    monthlyLossKrw: kpi ? Math.round(kpi.monthly_loss_krw) : null,
    annualLossKrw: r ? Math.round(r.annual_loss_krw) : null,
    recoveredMw: mm(kpi?.expected_recovery_mw),
    shutdownLossKrw: best?.outage_loss_krw !== undefined ? Math.round(best.outage_loss_krw) : null,
    initialInvestmentKrw: kpi?.investment_krw != null ? Math.round(kpi.investment_krw) : null,
    netBenefitKrw: kpi?.first_month_net_krw != null ? Math.round(kpi.first_month_net_krw) : null,
    monthlyIncrementalBenefitKrw: kpi?.monthly_benefit_krw != null ? Math.round(kpi.monthly_benefit_krw) : null,
    paybackMonths: mm(kpi?.payback_months),
    breakEvenDays: mm(kpi?.breakeven_days),
    cleaningScore: mm(r?.index.value),
  };
  const metrics = Object.fromEntries(
    (Object.keys(rawMetric) as MetricId[]).map((id) => [id, { value: rawMetric[id], status: rawMetric[id] === null ? 'invalid' : 'ok' }]),
  ) as Record<MetricId, Metric>;

  const monthlyBenefit = rawMetric.monthlyIncrementalBenefitKrw;
  const cleaning: CleaningEconomicsResult = {
    methodId: best?.id ?? null,
    methodName: best?.name ?? null,
    recoveredMw: rawMetric.recoveredMw,
    shutdownHours: best?.outage_days !== undefined ? best.outage_days * 24 : null,
    shutdownLossKrw: rawMetric.shutdownLossKrw,
    initialInvestmentKrw: rawMetric.initialInvestmentKrw,
    netBenefitKrw: rawMetric.netBenefitKrw,
    monthlyIncrementalBenefitKrw: monthlyBenefit,
    dailyIncrementalBenefitKrw:
      monthlyBenefit !== null && monthlyHours !== null && monthlyHours > 0 ? roundTo(monthlyBenefit / (monthlyHours / 24), 6) : null,
    paybackMonths: rawMetric.paybackMonths,
    breakEvenDays: rawMetric.breakEvenDays,
  };
  const level = r ? r.overall_level : null;

  return {
    values,
    errors,
    errorIds,
    valid: errorIds.length === 0,
    model: hrsgClassDef(calc.hrsgClass).demoModel,
    bp: {
      deltaBp: rawMetric.deltaBp,
      powerLossMw: rawMetric.powerLossMw,
      monthlyLossKrw: rawMetric.monthlyLossKrw,
      level,
      outputMw,
      lossSharePct: calcLossSharePct(rawMetric.powerLossMw, outputMw),
    },
    cleaning,
    metrics,
    level,
    bands: bpBands(run),
    pinch: EMPTY_PINCH(run),
    warnings: {
      bpBelowBaseline: values.currentBp !== null && values.referenceBp !== null && values.currentBp < values.referenceBp,
    },
    kit: {
      run,
      result: r,
      methods: r?.methods.rows ?? [],
      bestPaybackId: r?.methods.best_payback_id ?? null,
      maxNetBenefitId: r?.methods.max_net_benefit_id ?? null,
      messages: [...(r?.warnings ?? []), ...run.warnings],
    },
    inputsKey: JSON.stringify([calc.mode, calc.hrsgClass, NUMERIC_INPUTS.map((d) => values[d.id])]),
  };
}
