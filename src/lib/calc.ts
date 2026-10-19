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
  if (!finite(costKrw) || !finite(monthlyBenefitKrw) || costKrw < 0 || monthlyBenefitKrw <= 0) return null;
  return roundTo(costKrw / monthlyBenefitKrw, 6);
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

/**
 * 손익분기점 예시 [일] = 세정 비용 ÷ 일일 순편익.
 * 가상 순편익으로 비용을 회수한다는 단순 시연 계산 — 실제 투자회수기간이 아니다.
 */
export function calcBreakEvenDays(costKrw: number | null, dailyNetBenefitKrw: number | null): number | null {
  if (!finite(costKrw) || !finite(dailyNetBenefitKrw) || costKrw < 0 || dailyNetBenefitKrw <= 0) return null;
  return roundTo(costKrw / dailyNetBenefitKrw, 6);
}

export interface CumulativePoint {
  day: number;
  /** 누적 순편익 − 세정 비용 [백만원] */
  netMillionKrw: number;
}

/** 누적 순편익 곡선: day일 경과 시 dailyNet × day − cost */
export function buildCumulativeBenefit(
  costKrw: number | null,
  dailyNetBenefitKrw: number | null,
  days: number,
): CumulativePoint[] {
  if (!finite(costKrw) || !finite(dailyNetBenefitKrw) || !(days >= 0)) return [];
  return Array.from({ length: Math.floor(days) + 1 }, (_, day) => ({
    day,
    netMillionKrw: roundTo((dailyNetBenefitKrw * day - costKrw) / 1e6, 6),
  }));
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
