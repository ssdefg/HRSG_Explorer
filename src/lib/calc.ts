/**
 * 계산 보조 함수와 결과 타입 — UI와 분리된 순수 함수만 둔다 (React·DOM 의존 없음).
 *
 * 성능·경제성 계산식(출력 손실, 세정 공법 경제성, 세정 필요도 지수, IF97 핀치·어프로치)은 이 파일에 없다.
 * 단일 기준은 키트(hrsg_calc_kit_team1)이고, 앱은 calc_adapter.ts 를 거쳐서만 계산한다.
 * 여기에는 화면 표시용 보조 계산(변화율·평균·비율·누적 곡선)과 결과 타입만 남긴다.
 */

/** 판정 구간 — 키트 지표 판정(normal · caution · danger)과 같다 */
export type BackpressureLevel = 'normal' | 'caution' | 'danger';

/** 부동소수 오차(예: 0.1 + 0.2 = 0.30000000000000004)를 표시 전에 정리한다. */
export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

const finite = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** 배압 판정 — 키트 GT 배압 구간(calc_adapter.bpBands)을 받아 판정한다. 키트 indicatorLevel 과 같은 경계(≥). */
export function classifyBackpressure(bp: number | null, bands: { caution: number; danger: number } | null): BackpressureLevel | null {
  if (!finite(bp) || bp < 0 || !bands) return null;
  if (bp >= bands.danger) return 'danger';
  if (bp >= bands.caution) return 'caution';
  return 'normal';
}

/** 운전 출력 = 정격 용량 × 부하율  [MW] (화면 표시용 맥락 정보) */
export function calcOperatingOutputMw(capacityMw: number | null, loadPct: number | null): number | null {
  if (!finite(capacityMw) || !finite(loadPct) || capacityMw < 0 || loadPct < 0) return null;
  return roundTo((capacityMw * loadPct) / 100, 6);
}

/** 출력 손실이 운전 출력에서 차지하는 비율 [%] */
export function calcLossSharePct(powerLossMw: number | null, outputMw: number | null): number | null {
  if (!finite(powerLossMw) || !finite(outputMw) || outputMw <= 0) return null;
  return roundTo((powerLossMw / outputMw) * 100, 6);
}

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

export interface CumulativePoint {
  day: number;
  /** 누적 월간 편익 [백만원] — 총투자 기준선과 만나는 날이 손익분기 */
  benefitMillionKrw: number;
}

/** 누적 편익 곡선: day일 경과 시 일일 편익 × day (일일 편익 = 키트 월간 편익 ÷ 월간 가동일) */
export function buildCumulativeBenefit(dailyBenefitKrw: number | null, days: number): CumulativePoint[] {
  if (!finite(dailyBenefitKrw) || dailyBenefitKrw < 0 || !(days >= 0)) return [];
  return Array.from({ length: Math.floor(days) + 1 }, (_, day) => ({
    day,
    benefitMillionKrw: roundTo((dailyBenefitKrw * day) / 1e6, 6),
  }));
}

/* ==========================================================================
   결과 타입 — 키트 결과를 화면·스냅샷이 쓰는 모양으로 옮긴 것 (calculatorModel 이 채운다)
   ========================================================================== */

export interface EconomicsResult {
  /** 초과 압력 (GT 배압·HRSG 차압 중 설계 초과분이 큰 것) [mmH₂O] */
  deltaBp: number | null;
  /** 발전 출력 손실 = GT 손실 + ST 손실 [MW] */
  powerLossMw: number | null;
  monthlyLossKrw: number | null;
  level: BackpressureLevel | null;
  /** 운전 출력 = 정격 × 부하율 [MW] */
  outputMw: number | null;
  lossSharePct: number | null;
}

export interface CleaningEconomicsResult {
  /** 결과를 낸 공법 (키트 kpi: 회수기간이 가장 짧은 공법 — 가정 기준, 추천 아님) */
  methodId: string | null;
  methodName: string | null;
  recoveredMw: number | null;
  shutdownHours: number | null;
  /** 정지 손실 [원] */
  shutdownLossKrw: number | null;
  /** 총투자 = 세정 비용 + 간접 비용 + 정지 손실 */
  initialInvestmentKrw: number | null;
  /** 첫 달 순편익 = 월간 편익 − 총투자 */
  netBenefitKrw: number | null;
  /** 월간 편익 = 회수 출력 × 월간 가동시간 × 단가 */
  monthlyIncrementalBenefitKrw: number | null;
  /** 일일 편익 = 월간 편익 ÷ (월간 가동시간 ÷ 24) — 키트 손익분기 일수와 맞물린다 */
  dailyIncrementalBenefitKrw: number | null;
  paybackMonths: number | null;
  breakEvenDays: number | null;
}

export interface PinchApproachResult {
  tSatC: number | null;
  /** Pinch = T_eva,gas,out − Tsat(P_drum) */
  pinchC: number | null;
  /** Approach = Tsat(P_drum) − T_eco,water,out */
  approachC: number | null;
  /** 키트 판정 — no_data 면 「데이터 필요」 */
  level: BackpressureLevel | 'no_data';
  design: { pinch_c: number; approach_c: number };
  message: string;
}

/* ==========================================================================
   평가 모드 — DEMO 시나리오 / 사용자 입력. 두 모드 모두 키트 계산식을 쓴다.
   ========================================================================== */

export type EvaluationMode = 'demo' | 'user';
/** ok: 산출됨 · invalid: 입력 오류로 산출 불가 · model: 모델 미연동으로 평가 보류 (현재 키트 계산은 모드와 무관) */
export type MetricStatus = 'ok' | 'invalid' | 'model';
