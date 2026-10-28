import type { DataType, Localized } from '@/types';

/**
 * 계산기 입력 정의 — 기본값은 모두 시연용 가상 데이터(DEMO)다.
 * 범위(min/max)는 비정상 입력을 막기 위한 입력 검증용이며, 운전 한계를 뜻하지 않는다.
 */

export type HrsgClass = 'F' | 'J';

export interface HrsgClassDef {
  value: HrsgClass;
  label: string;
  /** 시연용 용량 — 실제 설비의 공식 용량이 아니다 */
  demoCapacityMw: number;
  /** 가상 가스터빈 모델명 — 실제 제조사·발전소 사양이 아니다 */
  demoModel: string;
}

export const HRSG_CLASSES: HrsgClassDef[] = [
  { value: 'F', label: 'F-class', demoCapacityMw: 150, demoModel: 'DEMO-GT-150' },
  { value: 'J', label: 'J-class', demoCapacityMw: 270, demoModel: 'DEMO-GT-270' },
];

export function hrsgClassDef(c: HrsgClass): HrsgClassDef {
  return HRSG_CLASSES.find((x) => x.value === c) ?? HRSG_CLASSES[0];
}

export type NumericInputId =
  // A. 설비 및 가스터빈 운전
  | 'capacityMw'
  | 'loadPct'
  | 'currentBp'
  | 'referenceBp'
  | 'diffPressure'
  | 'operatingHours'
  // B. HRSG 열역학
  | 'exhaustTemp'
  | 'drumPressure'
  | 'econOutletWaterTemp'
  | 'evapOutletGasTemp'
  | 'designPinch'
  | 'designApproach'
  // C. 경제성 기준
  | 'smp'
  | 'cleaningCostKrw'
  | 'shutdownDays'
  | 'additionalCostKrw'
  | 'recoveredPowerMw';

/** A 설비·GT 운전 / B HRSG 열역학 / C 경제성 기준 */
export type InputGroup = 'equipment' | 'thermo' | 'economics';

export interface NumericInputDef {
  id: NumericInputId;
  group: InputGroup;
  label: Localized;
  unit: string | Localized;
  /** null = 기본적으로 비어 있는 선택 입력 */
  defaultValue: number | null;
  min: number;
  max: number;
  step: number;
  /** 표시 소수 자릿수 */
  digits: number;
  /** 비워 둘 수 있는 선택 입력 (비어 있으면 '미입력', 오류 아님) */
  optional?: boolean;
  dataTypes: DataType[];
  /** 실측/설계 데이터로 교체해야 하는 항목 */
  needsReal: boolean;
  /** 실제 값이 없을 때 표시할 상태 */
  missingType: 'noMeasured' | 'unconfirmed';
  /** 짧은 보조 설명 */
  hint?: Localized;
}

export const NUMERIC_INPUTS: NumericInputDef[] = [
  // ---- A. 설비 및 가스터빈 운전 데이터 ----
  {
    id: 'capacityMw', group: 'equipment',
    label: { ko: '설비 용량', en: 'Unit capacity' },
    unit: 'MW', defaultValue: 150, min: 1, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'unconfirmed',
  },
  {
    id: 'loadPct', group: 'equipment',
    label: { ko: '가스터빈 부하율', en: 'GT load' },
    unit: '%', defaultValue: 90, min: 1, max: 110, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'currentBp', group: 'equipment',
    label: { ko: '현재 배압', en: 'Current back pressure' },
    unit: 'mmH₂O', defaultValue: 320, min: 0, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'referenceBp', group: 'equipment',
    label: { ko: '기준 배압', en: 'Reference back pressure' },
    unit: 'mmH₂O', defaultValue: 250, min: 0, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock', 'unconfirmed'], needsReal: true, missingType: 'unconfirmed',
  },
  {
    id: 'diffPressure', group: 'equipment',
    label: { ko: 'HRSG 가스측 차압 ΔP', en: 'HRSG gas-side ΔP' },
    unit: 'mbar', defaultValue: 28.6, min: 0, max: 200, step: 0.1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '입구–출구 압력차 · 배압과 다른 값', en: 'Inlet–outlet difference · distinct from back pressure' },
  },
  {
    id: 'operatingHours', group: 'equipment',
    label: { ko: '월간 가동시간', en: 'Monthly operating hours' },
    unit: 'h', defaultValue: 720, min: 0, max: 744, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },

  // ---- B. HRSG 열역학 데이터 ----
  {
    id: 'exhaustTemp', group: 'thermo',
    label: { ko: '배기가스 출구(스택) 온도', en: 'Stack gas outlet temp.' },
    unit: '°C', defaultValue: 135, min: 30, max: 400, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'drumPressure', group: 'thermo',
    label: { ko: '드럼 압력', en: 'Drum pressure' },
    unit: 'bar', defaultValue: 100, min: 1, max: 250, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'econOutletWaterTemp', group: 'thermo',
    label: { ko: '절탄기(Economizer) 출구 급수 온도', en: 'Economizer outlet water temp.' },
    unit: '°C', defaultValue: 150, min: 0, max: 400, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'evapOutletGasTemp', group: 'thermo',
    label: { ko: '증발기 출구 가스 온도', en: 'Evaporator outlet gas temp.' },
    unit: '°C', defaultValue: 350, min: 0, max: 700, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'designPinch', group: 'thermo',
    label: { ko: '핀치 포인트 설계값', en: 'Design pinch point' },
    unit: '°C', defaultValue: null, min: 0, max: 100, step: 0.1, digits: 1, optional: true,
    dataTypes: ['unconfirmed'], needsReal: true, missingType: 'unconfirmed',
    hint: { ko: '선택 · 제작사 설계 기준값', en: 'Optional · OEM design value' },
  },
  {
    id: 'designApproach', group: 'thermo',
    label: { ko: '어프로치 포인트 설계값', en: 'Design approach point' },
    unit: '°C', defaultValue: null, min: 0, max: 100, step: 0.1, digits: 1, optional: true,
    dataTypes: ['unconfirmed'], needsReal: true, missingType: 'unconfirmed',
    hint: { ko: '선택 · 제작사 설계 기준값', en: 'Optional · OEM design value' },
  },

  // ---- C. 경제성 기준 ----
  {
    id: 'smp', group: 'economics',
    label: { ko: 'SMP', en: 'SMP' },
    unit: { ko: '원/kWh', en: 'KRW/kWh' }, defaultValue: 140, min: 0, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'cleaningCostKrw', group: 'economics',
    label: { ko: '세정 비용', en: 'Cleaning cost' },
    unit: { ko: '원', en: 'KRW' }, defaultValue: 30_000_000, min: 0, max: 10_000_000_000, step: 1_000_000, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'shutdownDays', group: 'economics',
    label: { ko: '정지일수', en: 'Shutdown days' },
    unit: { ko: '일', en: 'd' }, defaultValue: 0, min: 0, max: 30, step: 0.5, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '0 = 계획 정지 중 세정 가정 · 정지 손실은 운전 출력 기준', en: '0 = cleaning during planned outage · loss uses operating output' },
  },
  {
    id: 'additionalCostKrw', group: 'economics',
    label: { ko: '추가 비용', en: 'Additional cost' },
    unit: { ko: '원', en: 'KRW' }, defaultValue: 0, min: 0, max: 10_000_000_000, step: 1_000_000, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'recoveredPowerMw', group: 'economics',
    label: { ko: '회수 출력', en: 'Recovered output' },
    unit: 'MW', defaultValue: 1.1, min: 0, max: 100, step: 0.1, digits: 2,
    dataTypes: ['mock', 'unconfirmed'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '세정 후 회수 가정값 · 배압 기반 손실 추정치와 별개', en: 'Assumed post-cleaning recovery · separate from BP-based loss' },
  },
];

export const INPUT_DEF: Record<NumericInputId, NumericInputDef> = Object.fromEntries(
  NUMERIC_INPUTS.map((d) => [d.id, d]),
) as Record<NumericInputId, NumericInputDef>;

export const INPUT_GROUPS: InputGroup[] = ['equipment', 'thermo', 'economics'];

export const INPUT_GROUP_LABEL: Record<InputGroup, Localized> = {
  equipment: { ko: 'A. 설비 및 가스터빈 운전 데이터', en: 'A. Equipment & gas turbine operation' },
  thermo: { ko: 'B. HRSG 열역학 데이터', en: 'B. HRSG thermodynamic data' },
  economics: { ko: 'C. 경제성 기준', en: 'C. Economic basis' },
};

export const DEFAULT_HRSG_CLASS: HrsgClass = 'F';

/* ---- DEMO 운전 시나리오 프리셋 ---------------------------------------------
 * 상태 시연을 위한 가상 값이다. 실제 공학 기준·경보 설정값이 아니다.
 * 경보 시나리오는 계산기 기본값(320 mmH₂O, 28.6 mbar)을 그대로 쓴다.
 */
export type ScenarioId = 'normal' | 'alarm' | 'trip';
export type ScenarioSelection = ScenarioId | 'custom';

export const DEMO_SCENARIOS: Record<ScenarioId, { label: Localized; values: Partial<Record<NumericInputId, number>> }> = {
  normal: { label: { ko: '정상 시나리오', en: 'Normal scenario' }, values: { currentBp: 255, diffPressure: 22.0 } },
  alarm: { label: { ko: '경보 시나리오', en: 'Alarm scenario' }, values: { currentBp: 320, diffPressure: 28.6 } },
  trip: { label: { ko: '트립 시나리오', en: 'Trip scenario' }, values: { currentBp: 360, diffPressure: 34.0 } },
};

export const SCENARIO_LABEL: Record<ScenarioSelection, Localized> = {
  normal: DEMO_SCENARIOS.normal.label,
  alarm: DEMO_SCENARIOS.alarm.label,
  trip: DEMO_SCENARIOS.trip.label,
  custom: { ko: '사용자 지정', en: 'Custom' },
};

export const DEFAULT_SCENARIO: ScenarioSelection = 'alarm';
