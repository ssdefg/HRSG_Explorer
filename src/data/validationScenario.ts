/**
 * 세정 전후 검증용 가상 시나리오.
 * 계산기 입력값과 분리해서 관리한다 — 계산기 값을 바꿔도 이 시나리오는 변하지 않는다.
 * 실제 세정 성능이나 검증된 개선 효과가 아니다.
 */

export const VALIDATION_SCENARIO = {
  backPressure: { before: 320, after: 245 },     // mmH₂O
  exhaustTemp: { before: 135, after: 112 },      // °C
  /** 발전 성능 변화 가정 [MW] — 세정 전은 기준 상태(0) */
  powerChangeMw: { before: 0, after: 1.1 },
  /** 가상 세정 비용 [원] */
  cleaningCostKrw: 30_000_000,
  /** 가상 일일 순편익 [원/일] */
  dailyNetBenefitKrw: 1_250_000,
  /** 시계열 구간 [일] — 세정일(0) 기준 */
  daysBefore: 30,
  daysAfter: 60,
} as const;

export type SeriesMetric = 'backPressure' | 'exhaustTemp';

export interface ScenarioPoint {
  /** 세정일 기준 경과일 (음수: 세정 전) */
  day: number;
  backPressure: number;
  exhaustTemp: number;
}

/** 결정적 의사 잡음 — 렌더링마다 값이 바뀌지 않도록 한다 */
function wobble(day: number, seed: number): number {
  const x = Math.sin(day * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2; // −1 … 1
}

/**
 * 시연용 가상 시계열: 세정 전 30일(오염 진행) · 세정 후 60일(점진적 재오염).
 * 세정일(day 0)은 작업·정지 구간으로 보고 값을 두지 않는다.
 */
export function buildScenarioSeries(): ScenarioPoint[] {
  const s = VALIDATION_SCENARIO;
  const pts: ScenarioPoint[] = [];
  for (let d = -s.daysBefore; d <= s.daysAfter; d++) {
    if (d === 0) continue;
    const r = (v: number) => Math.round(v * 10) / 10;
    if (d < 0) {
      const t = (d + s.daysBefore) / (s.daysBefore - 1); // 0 → 1
      pts.push({
        day: d,
        backPressure: r(300 + 20 * t + wobble(d, 1) * 2.5),
        exhaustTemp: r(131 + 4 * t + wobble(d, 2) * 0.8),
      });
    } else {
      const t = (d - 1) / (s.daysAfter - 1);
      pts.push({
        day: d,
        backPressure: r(s.backPressure.after + 8 * t + wobble(d, 1) * 2.5),
        exhaustTemp: r(s.exhaustTemp.after + 2.5 * t + wobble(d, 2) * 0.8),
      });
    }
  }
  return pts;
}
