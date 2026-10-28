/**
 * 중앙 계산 엔진 — UI와 분리된 순수 함수만 둔다 (React·DOM 의존 없음).
 *
 * ⚠ 모든 식은 프로토타입의 입력→출력 연결을 확인하기 위한 "예시 계산"이다.
 *   실제 HRSG 성능이나 발전 손실을 예측하는 검증된 모델이 아니다.
 */

/** 배압 1 mmH₂O 초과당 발전 손실(MW) — 시연용 임시 계수, 공학적으로 검증되지 않음 */
export const POWER_LOSS_COEFF_MW_PER_MMH2O = 0.015;

/** MW → kW */
const KW_PER_MW = 1000;

/** 시연용 배압 상태 임계값 (mmH₂O) — 검증된 공식 기준 아님 (기준값 미확정) */
export const BP_THRESHOLDS = {
  /** 이 값 미만: 정상 */
  caution: 270,
  /** 이 값 초과: 위험 (caution ≤ bp ≤ danger 는 주의) */
  danger: 300,
} as const;

export type BackpressureLevel = 'normal' | 'caution' | 'danger';

/** 부동소수 오차(예: 70 × 0.015 = 1.0499999…)를 표시 전에 정리한다. */
export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** delta_bp = max(0, input_bp − reference_bp)  [mmH₂O] */
export function calcDeltaBackpressure(inputBp: number | null, referenceBp: number | null): number | null {
  if (!finite(inputBp) || !finite(referenceBp)) return null;
  return roundTo(Math.max(0, inputBp - referenceBp), 6);
}

/** power_loss_mw = delta_bp × 0.015  [MW] */
export function calcPowerLossMw(deltaBp: number | null): number | null {
  if (!finite(deltaBp) || deltaBp < 0) return null;
  return roundTo(deltaBp * POWER_LOSS_COEFF_MW_PER_MMH2O, 6);
}

/**
 * monthly_loss_krw = power_loss_mw × 1000 × operating_hours × input_smp  [원]
 * SMP 단위가 이미 원/kWh 이므로 추가로 1000으로 나누지 않는다.
 */
export function calcMonthlyLossKrw(
  powerLossMw: number | null,
  operatingHours: number | null,
  smpKrwPerKwh: number | null,
): number | null {
  if (!finite(powerLossMw) || !finite(operatingHours) || !finite(smpKrwPerKwh)) return null;
  if (powerLossMw < 0 || operatingHours < 0 || smpKrwPerKwh < 0) return null;
  return Math.round(powerLossMw * KW_PER_MW * operatingHours * smpKrwPerKwh);
}

/** 시연용 임계값에 따른 배압 상태 — 세정 필요성을 확정하는 진단이 아니다. */
export function classifyBackpressure(bp: number | null): BackpressureLevel | null {
  if (!finite(bp) || bp < 0) return null;
  if (bp < BP_THRESHOLDS.caution) return 'normal';
  if (bp <= BP_THRESHOLDS.danger) return 'caution';
  return 'danger';
}

/** 운전 출력 예시 = 설비 용량 × 부하율  [MW] (시연용 맥락 정보) */
export function calcOperatingOutputMw(capacityMw: number | null, loadPct: number | null): number | null {
  if (!finite(capacityMw) || !finite(loadPct) || capacityMw < 0 || loadPct < 0) return null;
  return roundTo((capacityMw * loadPct) / 100, 6);
}

/** 발전 손실 예시가 운전 출력 예시에서 차지하는 비율 [%] */
export function calcLossSharePct(powerLossMw: number | null, outputMw: number | null): number | null {
  if (!finite(powerLossMw) || !finite(outputMw) || outputMw <= 0) return null;
  return roundTo((powerLossMw / outputMw) * 100, 6);
}

/** 단순 회수 기간 예시 = 세정 비용 ÷ 월간 편익  [개월] */
export function calcSimplePaybackMonths(costKrw: number | null, monthlyBenefitKrw: number | null): number | null {
  return calcPaybackMonths(costKrw, monthlyBenefitKrw);
}

export interface EconomicsInput {
  currentBp: number | null;
  referenceBp: number | null;
  operatingHours: number | null;
  smp: number | null;
  capacityMw: number | null;
  loadPct: number | null;
}

export interface EconomicsResult {
  deltaBp: number | null;
  powerLossMw: number | null;
  monthlyLossKrw: number | null;
  level: BackpressureLevel | null;
  outputMw: number | null;
  lossSharePct: number | null;
}

/** 대시보드 전체가 공유하는 단일 계산 진입점. 입력이 유효하지 않으면 해당 결과는 null. */
export function computeEconomics(i: EconomicsInput): EconomicsResult {
  const deltaBp = calcDeltaBackpressure(i.currentBp, i.referenceBp);
  const powerLossMw = calcPowerLossMw(deltaBp);
  const monthlyLossKrw = calcMonthlyLossKrw(powerLossMw, i.operatingHours, i.smp);
  const outputMw = calcOperatingOutputMw(i.capacityMw, i.loadPct);
  return {
    deltaBp,
    powerLossMw,
    monthlyLossKrw,
    level: classifyBackpressure(i.currentBp),
    outputMw,
    lossSharePct: calcLossSharePct(powerLossMw, outputMw),
  };
}

export interface SensitivityPoint {
  bp: number;
  monthlyLossMillionKrw: number;
}

/**
 * 배압 변화에 따른 월간 손실 예시 곡선 — 차트용.
 * KPI와 같은 함수(computeEconomics 경로)를 그대로 써서 값이 어긋나지 않게 한다.
 */
export function buildLossSensitivity(
  referenceBp: number | null,
  operatingHours: number | null,
  smp: number | null,
  from: number,
  to: number,
  step: number,
): SensitivityPoint[] {
  if (!finite(referenceBp) || !finite(operatingHours) || !finite(smp)) return [];
  if (!(step > 0) || !(to >= from)) return [];
  const pts: SensitivityPoint[] = [];
  for (let bp = from; bp <= to + 1e-9; bp += step) {
    const d = calcDeltaBackpressure(bp, referenceBp);
    const loss = calcMonthlyLossKrw(calcPowerLossMw(d), operatingHours, smp);
    if (loss === null) continue;
    pts.push({ bp: roundTo(bp, 6), monthlyLossMillionKrw: roundTo(loss / 1e6, 6) });
  }
  return pts;
}

/* ==========================================================================
   세정 전후 검증 · 체크리스트용 계산 (예시 계산)
   ========================================================================== */

export interface Change {
  /** after − before */
  abs: number;
  /** (after − before) / before × 100 */
  pct: number | null;
}

/** 전후 변화량·변화율 */
export function calcChange(before: number | null, after: number | null): Change | null {
  if (!finite(before) || !finite(after)) return null;
  return {
    abs: roundTo(after - before, 6),
    pct: before === 0 ? null : roundTo(((after - before) / before) * 100, 6),
  };
}

/** 유효한 값만 평균 — 값이 없으면 null */
export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter(finite);
  if (v.length === 0) return null;
  return roundTo(v.reduce((a, b) => a + b, 0) / v.length, 6);
}

/** 비율 [%] = part / total × 100 — 진행률·수령률 공통 */
export function calcRatioPct(part: number, total: number): number {
  if (!finite(part) || !finite(total) || total <= 0) return 0;
  return roundTo((Math.min(Math.max(part, 0), total) / total) * 100, 6);
}

/* ==========================================================================
   세정 경제성 — 표준 계산식 (예시 계산)
   단위: 출력 MW, 시간 h, 일 d, SMP 원/kWh, 금액 원.
   MW → kW 변환 계수 1000을 모든 매출·손실식에 포함한다.
   ========================================================================== */

export const HOURS_PER_DAY = 24;
/** 월간 가동시간 720 h = 30일 × 24 h 기준과 맞춘 평가 기간 일수 */
export const DAYS_PER_MONTH = 30;

/** 정지시간 [h] = 정지일수 × 24 */
export function calcShutdownHours(shutdownDays: number | null): number | null {
  if (!finite(shutdownDays) || shutdownDays < 0) return null;
  return roundTo(shutdownDays * HOURS_PER_DAY, 6);
}

/**
 * 세정 후 유효 가동시간 [h] = 평가 기간(월간) 가동시간 − 정지시간.
 * 정지시간이 평가 기간보다 길면 산출하지 않는다.
 * 입력 필드가 아니라 파생값이다 — 같은 정보를 두 입력란으로 중복 관리하지 않기 위함.
 */
export function calcEffectiveHours(operatingHours: number | null, shutdownDays: number | null): number | null {
  const sh = calcShutdownHours(shutdownDays);
  if (!finite(operatingHours) || sh === null || operatingHours < 0 || sh > operatingHours) return null;
  return roundTo(operatingHours - sh, 6);
}

/** C. 추가 발전 매출 [원] = 회수 출력 MW × 1000 × 유효 운전시간 h × SMP */
export function calcAdditionalRevenueKrw(
  recoveredPowerMw: number | null,
  effectiveHours: number | null,
  smp: number | null,
): number | null {
  if (!finite(recoveredPowerMw) || !finite(effectiveHours) || !finite(smp)) return null;
  if (recoveredPowerMw < 0 || effectiveHours < 0 || smp < 0) return null;
  return Math.round(recoveredPowerMw * KW_PER_MW * effectiveHours * smp);
}

/**
 * 정지 손실 [원] = 정지 중 발전하지 못한 운전 출력 MW × 1000 × 정지시간 h × SMP.
 * 정지시간은 유효 가동시간에서 이미 빠진다(회수 출력이 없는 시간). 이 손실은 그와 별개인
 * '기저 출력'의 기회비용이므로 이중 반영이 아니다.
 */
export function calcShutdownLossKrw(outputMw: number | null, shutdownDays: number | null, smp: number | null): number | null {
  const sh = calcShutdownHours(shutdownDays);
  if (!finite(outputMw) || sh === null || !finite(smp) || outputMw < 0 || smp < 0) return null;
  return Math.round(outputMw * KW_PER_MW * sh * smp);
}

/** D. 세정 순편익 [원] = 추가 발전 매출 − 세정 비용 − 정지 손실 − 추가 비용 (각 항목 1회만 차감) */
export function calcNetBenefitKrw(
  additionalRevenueKrw: number | null,
  cleaningCostKrw: number | null,
  shutdownLossKrw: number | null,
  additionalCostKrw: number | null,
): number | null {
  if (![additionalRevenueKrw, cleaningCostKrw, shutdownLossKrw, additionalCostKrw].every(finite)) return null;
  return Math.round(additionalRevenueKrw! - cleaningCostKrw! - shutdownLossKrw! - additionalCostKrw!);
}

/**
 * E. 단순 회수 기간 [개월] = 초기 투자 ÷ 월간 순증분 편익.
 * 일회성 비용(세정 비용·정지 손실·추가 비용)은 '초기 투자'에만 넣고 편익에서 다시 빼지 않는다.
 * 월간 순증분 편익이 0 이하이면 회수 불가 → null.
 */
export function calcPaybackMonths(initialInvestmentKrw: number | null, monthlyIncrementalBenefitKrw: number | null): number | null {
  if (!finite(initialInvestmentKrw) || !finite(monthlyIncrementalBenefitKrw)) return null;
  if (initialInvestmentKrw < 0 || monthlyIncrementalBenefitKrw <= 0) return null;
  return roundTo(initialInvestmentKrw / monthlyIncrementalBenefitKrw, 6);
}

/** 손익분기 [일] = 정지일수 + 초기 투자 ÷ 일일 순증분 편익 (편익 ≤ 0이면 null) */
export function calcBreakEvenDays(
  initialInvestmentKrw: number | null,
  dailyIncrementalBenefitKrw: number | null,
  shutdownDays: number | null = 0,
): number | null {
  if (!finite(initialInvestmentKrw) || !finite(dailyIncrementalBenefitKrw) || !finite(shutdownDays)) return null;
  if (initialInvestmentKrw < 0 || dailyIncrementalBenefitKrw <= 0 || shutdownDays < 0) return null;
  return roundTo(shutdownDays + initialInvestmentKrw / dailyIncrementalBenefitKrw, 6);
}

export interface CumulativePoint {
  day: number;
  /** 누적 순증분 편익 − 초기 투자 [백만원] */
  netMillionKrw: number;
}

/** 누적 순편익 곡선: day일 경과 시 일일 편익 × max(0, day − 정지일수) − 초기 투자 */
export function buildCumulativeNetBenefit(
  initialInvestmentKrw: number | null,
  dailyIncrementalBenefitKrw: number | null,
  shutdownDays: number | null,
  days: number,
): CumulativePoint[] {
  if (!finite(initialInvestmentKrw) || !finite(dailyIncrementalBenefitKrw) || !finite(shutdownDays) || !(days >= 0)) return [];
  return Array.from({ length: Math.floor(days) + 1 }, (_, day) => ({
    day,
    netMillionKrw: roundTo((dailyIncrementalBenefitKrw * Math.max(0, day - shutdownDays) - initialInvestmentKrw) / 1e6, 6),
  }));
}

export interface CleaningEconomicsInput {
  /** 세정으로 회수되는 출력 (입력값 — 배압 기반 손실 추정치와 다른 개념) */
  recoveredPowerMw: number | null;
  operatingHours: number | null;
  shutdownDays: number | null;
  smp: number | null;
  cleaningCostKrw: number | null;
  additionalCostKrw: number | null;
  /** 정지 손실 산정용 운전 출력 = 설비 용량 × 부하율 */
  outputMw: number | null;
}

export interface CleaningEconomicsResult {
  shutdownHours: number | null;
  effectiveHours: number | null;
  additionalRevenueKrw: number | null;
  shutdownLossKrw: number | null;
  /** 초기 투자 = 세정 비용 + 정지 손실 + 추가 비용 */
  initialInvestmentKrw: number | null;
  /** 평가 기간(첫 1개월) 순편익 */
  netBenefitKrw: number | null;
  /** 정상 월간 순증분 편익 = 회수 출력 × 1000 × 월간 가동시간 × SMP */
  monthlyIncrementalBenefitKrw: number | null;
  dailyIncrementalBenefitKrw: number | null;
  paybackMonths: number | null;
  breakEvenDays: number | null;
}

/** 세정 경제성 단일 진입점 — 계산기·대시보드·AI가 모두 이 결과를 공유한다. */
export function computeCleaningEconomics(i: CleaningEconomicsInput): CleaningEconomicsResult {
  const shutdownHours = calcShutdownHours(i.shutdownDays);
  const effectiveHours = calcEffectiveHours(i.operatingHours, i.shutdownDays);
  const additionalRevenueKrw = calcAdditionalRevenueKrw(i.recoveredPowerMw, effectiveHours, i.smp);
  const shutdownLossKrw = calcShutdownLossKrw(i.outputMw, i.shutdownDays, i.smp);
  const initialInvestmentKrw = [i.cleaningCostKrw, shutdownLossKrw, i.additionalCostKrw].every(finite)
    ? Math.round(i.cleaningCostKrw! + shutdownLossKrw! + i.additionalCostKrw!)
    : null;
  const netBenefitKrw = calcNetBenefitKrw(additionalRevenueKrw, i.cleaningCostKrw, shutdownLossKrw, i.additionalCostKrw);
  const monthlyIncrementalBenefitKrw = calcAdditionalRevenueKrw(i.recoveredPowerMw, i.operatingHours, i.smp);
  const dailyIncrementalBenefitKrw =
    monthlyIncrementalBenefitKrw === null ? null : roundTo(monthlyIncrementalBenefitKrw / DAYS_PER_MONTH, 6);
  return {
    shutdownHours,
    effectiveHours,
    additionalRevenueKrw,
    shutdownLossKrw,
    initialInvestmentKrw,
    netBenefitKrw,
    monthlyIncrementalBenefitKrw,
    dailyIncrementalBenefitKrw,
    paybackMonths: calcPaybackMonths(initialInvestmentKrw, monthlyIncrementalBenefitKrw),
    breakEvenDays: calcBreakEvenDays(initialInvestmentKrw, dailyIncrementalBenefitKrw, i.shutdownDays),
  };
}

/* ==========================================================================
   평가 모드 게이팅
   DEMO 모드: 예시 계산 엔진을 그대로 사용.
   사용자 입력 모드: 검증되지 않은 공학 모델(배압→출력 손실 계수)은 산출하지 않는다.
   단위 환산·산술만으로 정의되는 경제성 계산은 입력값 그대로 계산한다.
   ========================================================================== */

export type EvaluationMode = 'demo' | 'user';
/** ok: 산출됨 · invalid: 입력 오류로 산출 불가 · model: 공학 모델 미연동으로 평가 보류 */
export type MetricStatus = 'ok' | 'invalid' | 'model';

export function gateByMode<T>(value: T | null, mode: EvaluationMode, requiresModel: boolean): { value: T | null; status: MetricStatus } {
  if (requiresModel && mode === 'user') return { value: null, status: 'model' };
  return value === null ? { value: null, status: 'invalid' } : { value, status: 'ok' };
}
