import type { DataType, Localized } from '@/types';
import { KIT_CALC_DATA, kitCalc } from '@/lib/kit';
import { kitDefaultValues, kitClass } from '@/lib/calc_adapter';

/**
 * 계산기 입력 정의 — 기본값·GT 등급·시나리오 값은 키트(hrsg_calc_kit_team1/data/calculator.json)에서 온다 (DEMO 값).
 * 범위(min/max)는 비정상 입력을 막기 위한 입력 검증용이며, 운전 한계를 뜻하지 않는다.
 */

/** 키트 GT 등급 F / H / E */
export type HrsgClass = 'F' | 'H' | 'E';

export interface HrsgClassDef {
  value: HrsgClass;
  label: string;
  /** 시연용 용량 — 실제 설비의 공식 용량이 아니다 */
  demoCapacityMw: number;
  /** 가상 가스터빈 모델명 — 실제 제조사·발전소 사양이 아니다 */
  demoModel: string;
}

/** 부하율 폴백 클램핑 한계 [%] — 가이드 §3.1 */
export const LOAD_CLAMP = { min: 30, max: 110 } as const;
/** 스택 온도 안전 한계 [°C] — 초과 시 '트립 위험' 경고 (가이드 §3.1) */
export const STACK_TEMP_SAFETY_LIMIT_C = 300;

export const HRSG_CLASSES: HrsgClassDef[] = KIT_CALC_DATA.gt_classes.map((g) => ({
  value: g.id as HrsgClass,
  label: `${g.id}-Class`,
  demoCapacityMw: g.rated_gt_mw,
  demoModel: g.name,
}));

/** 키트 기본 운전 상태 (default_case) — 계산기 기본값 */
const KD = kitDefaultValues();

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
  | 'referenceStackTemp'
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
  /** 정수만 허용 */
  integer?: boolean;
  /** 단위 선택 가능 — unit 은 기준 단위 */
  unitKind?: UnitKind;
  dataTypes: DataType[];
  /** 실측/설계 데이터로 교체해야 하는 항목 */
  needsReal: boolean;
  /** 실제 값이 없을 때 표시할 상태 */
  missingType: 'noMeasured' | 'unconfirmed';
  /** 짧은 보조 설명 */
  hint?: Localized;
}

/* ---- 단위 선택 (가이드 §2.3 '지원 단위') -------------------------------------
 * 계산은 항상 기준 단위(mmH₂O · °C · bar(g))로 한다. 입력란의 원문은 선택한 단위로 보관하고,
 * 파싱할 때 기준 단위로 환산한다.
 */
export type UnitKind = 'pressure' | 'temperature' | 'drumPressure';

export interface UnitDef {
  id: string;
  label: string;
  /** 선택 단위 → 기준 단위 */
  toBase: (v: number) => number;
  /** 기준 단위 → 선택 단위 */
  fromBase: (v: number) => number;
}

/** 1 mmH₂O = 9.80665 Pa = 0.00980665 kPa */
export const KPA_PER_MMH2O = 0.00980665;
const MMH2O_PER_INH2O = 25.4;
const MMH2O_PER_MBAR = 0.1 / KPA_PER_MMH2O;
const PSI_PER_BAR = 14.503773773;

const linear = (id: string, label: string, basePerUnit: number): UnitDef => ({
  id,
  label,
  toBase: (v) => v * basePerUnit,
  fromBase: (v) => v / basePerUnit,
});

export const UNIT_SYSTEMS: Record<UnitKind, UnitDef[]> = {
  pressure: [
    linear('mmH2O', 'mmH₂O', 1),
    { id: 'kPa', label: 'kPa', toBase: (v) => v / KPA_PER_MMH2O, fromBase: (v) => v * KPA_PER_MMH2O },
    linear('inH2O', 'inH₂O', MMH2O_PER_INH2O),
    linear('mbar', 'mbar', MMH2O_PER_MBAR),
  ],
  temperature: [
    linear('C', '°C', 1),
    { id: 'F', label: '°F', toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
  ],
  // 드럼 압력은 키트와 같은 게이지압 (키트가 IF97 계산 때 +1.01325 bar 로 절대압 환산)
  drumPressure: [linear('bar', 'bar(g)', 1), linear('kPa', 'kPa(g)', 0.01), linear('psig', 'psig', 1 / PSI_PER_BAR)],
};

export function unitDef(kind: UnitKind, id: string | undefined): UnitDef {
  return UNIT_SYSTEMS[kind].find((u) => u.id === id) ?? UNIT_SYSTEMS[kind][0];
}

export const NUMERIC_INPUTS: NumericInputDef[] = [
  // ---- A. 설비 및 가스터빈 운전 데이터 ----
  {
    id: 'capacityMw', group: 'equipment',
    label: { ko: '정격 설비 용량', en: 'Rated capacity' },
    unit: 'MW', defaultValue: KD.capacityMw, min: 50, max: 600, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'unconfirmed',
  },
  {
    id: 'loadPct', group: 'equipment',
    label: { ko: '운전 부하율', en: 'Load factor' },
    unit: '%', defaultValue: KD.loadPct, min: LOAD_CLAMP.min, max: LOAD_CLAMP.max, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '정상 운전 30 ~ 105 % · 범위를 벗어나면 30/110 %로 보정', en: 'Normal 30–105 % · clamped to 30/110 % if outside' },
  },
  {
    id: 'currentBp', group: 'equipment', unitKind: 'pressure',
    label: { ko: '현재 배압', en: 'Current back pressure' },
    unit: 'mmH₂O', defaultValue: KD.currentBp, min: 0, max: 1200, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'referenceBp', group: 'equipment', unitKind: 'pressure',
    label: { ko: '기준 배압', en: 'Baseline back pressure' },
    unit: 'mmH₂O', defaultValue: KD.referenceBp, min: 0, max: 800, step: 1, digits: 1,
    dataTypes: ['mock', 'unconfirmed'], needsReal: true, missingType: 'unconfirmed',
  },
  {
    id: 'diffPressure', group: 'equipment',
    label: { ko: 'HRSG 가스측 차압 ΔP', en: 'HRSG gas-side ΔP' },
    unit: 'mbar', defaultValue: KD.diffPressure, min: 0, max: 200, step: 0.1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '입구–출구 압력차 · 배압과 다른 값', en: 'Inlet–outlet difference · distinct from back pressure' },
  },
  {
    id: 'operatingHours', group: 'equipment',
    label: { ko: '월간 가동시간', en: 'Monthly operating hours' },
    unit: 'h', defaultValue: KD.operatingHours, min: 0, max: 744, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'exhaustTemp', group: 'equipment', unitKind: 'temperature',
    label: { ko: '스택 배기가스 온도', en: 'Stack exhaust gas temp.' },
    unit: '°C', defaultValue: KD.exhaustTemp, min: 60, max: 250, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'referenceStackTemp', group: 'equipment', unitKind: 'temperature',
    label: { ko: '기준 스택 온도 (세정 직후)', en: 'Baseline stack temp. (post-cleaning)' },
    unit: '°C', defaultValue: KD.referenceStackTemp, min: 60, max: 250, step: 1, digits: 1,
    dataTypes: ['mock', 'unconfirmed'], needsReal: true, missingType: 'unconfirmed',
    hint: { ko: '키트 base_stack_c · 비워 두지 않으면 등급 설계값을 이 값으로 맞춤', en: 'Kit base_stack_c — rebases the class design value' },
  },

  // ---- B. HRSG 열역학 데이터 ----
  {
    id: 'drumPressure', group: 'thermo', unitKind: 'drumPressure',
    label: { ko: '고압 드럼 압력', en: 'HP drum pressure' },
    unit: 'bar(g)', defaultValue: KD.drumPressure, min: 1, max: 200, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '게이지압 · 키트가 +1.01325 bar 로 절대압 환산해 IF97 포화온도 계산', en: 'Gauge · kit adds 1.01325 bar for IF97 saturation temp.' },
  },
  {
    id: 'econOutletWaterTemp', group: 'thermo', unitKind: 'temperature',
    label: { ko: '절탄기 출구 급수온도', en: 'Economizer outlet water temp.' },
    unit: '°C', defaultValue: KD.econOutletWaterTemp, min: 50, max: 370, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'evapOutletGasTemp', group: 'thermo', unitKind: 'temperature',
    label: { ko: '증발기 출구 가스온도', en: 'Evaporator outlet gas temp.' },
    unit: '°C', defaultValue: KD.evapOutletGasTemp, min: 100, max: 600, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'designPinch', group: 'thermo',
    label: { ko: '핀치 포인트 설계값', en: 'Design pinch point' },
    unit: '°C', defaultValue: null, min: 0, max: 100, step: 0.1, digits: 1, optional: true,
    dataTypes: ['unconfirmed'], needsReal: true, missingType: 'unconfirmed',
    hint: { ko: '선택 · 비우면 키트 설계값 8 °C', en: 'Optional · blank = kit design 8 °C' },
  },
  {
    id: 'designApproach', group: 'thermo',
    label: { ko: '어프로치 포인트 설계값', en: 'Design approach point' },
    unit: '°C', defaultValue: null, min: 0, max: 100, step: 0.1, digits: 1, optional: true,
    dataTypes: ['unconfirmed'], needsReal: true, missingType: 'unconfirmed',
    hint: { ko: '선택 · 비우면 키트 설계값 5 °C', en: 'Optional · blank = kit design 5 °C' },
  },

  // ---- C. 경제성 기준 ----
  {
    id: 'smp', group: 'economics',
    label: { ko: 'SMP (전력시장가격)', en: 'SMP (system marginal price)' },
    unit: { ko: '원/kWh', en: 'KRW/kWh' }, defaultValue: KD.smp, min: 50, max: 500, step: 1, digits: 1,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'recoveredPowerMw', group: 'economics',
    label: { ko: '목표 회수 출력', en: 'Target recovered output' },
    unit: 'MW', defaultValue: KD.recoveredPowerMw, min: 0, max: 30, step: 0.1, digits: 2,
    dataTypes: ['mock', 'unconfirmed'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '공법 회수율·회수 출력이 모두 없을 때만 사용 (키트 economics.target_recovery_mw)', en: 'Used only when a method has no recovery ratio/MW (kit target_recovery_mw)' },
  },
  {
    id: 'cleaningCostKrw', group: 'economics',
    label: { ko: '드라이아이스 세정비용', en: 'Dry-ice cleaning cost' },
    unit: { ko: '원', en: 'KRW' }, defaultValue: KD.cleaningCostKrw, min: 0, max: 2_000_000_000, step: 1_000_000, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'shutdownDays', group: 'economics',
    label: { ko: '세정 정지 일수', en: 'Cleaning outage days' },
    unit: { ko: '일', en: 'd' }, defaultValue: KD.shutdownDays, min: 0, max: 30, step: 1, digits: 0, integer: true,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
    hint: { ko: '드라이아이스 세정 · 정지 손실 = (GT+ST 정격) × 부하 × 정지일 × 24 h × 단가 × 2 %', en: 'Dry ice · outage loss = (GT+ST rating) × load × days × 24 h × price × 2 %' },
  },
  {
    id: 'additionalCostKrw', group: 'economics',
    label: { ko: '간접 비용', en: 'Indirect cost' },
    unit: { ko: '원', en: 'KRW' }, defaultValue: KD.additionalCostKrw, min: 0, max: 2_000_000_000, step: 1_000_000, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
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

export const DEFAULT_HRSG_CLASS: HrsgClass = KIT_CALC_DATA.default_case.gt_class as HrsgClass;

/* ---- DEMO 운전 시나리오 프리셋 ---------------------------------------------
 * 상태 시연을 위한 가상 값이다. 실제 공학 기준·경보 설정값이 아니다.
 * 경보 시나리오는 키트 기본 운전 상태(default_case)와 같다.
 */
export type ScenarioId = 'normal' | 'alarm' | 'trip';
export type ScenarioSelection = ScenarioId | 'custom';

const mmh2o = (mbar: number) => Math.round(kitCalc.fromMbar(mbar, 'mmh2o') * 10) / 10;

/**
 * DEMO 시나리오 값 — 키트 GT 등급 지표에서 만든다 (공학 기준·경보 설정값 아님).
 *   정상: 설계 상태(designInputs) · 경보: 키트 기본 운전 상태(default_case) · 트립: 세 지표 모두 위험 구간
 */
export function scenarioValues(id: ScenarioId, classId: HrsgClass): Partial<Record<NumericInputId, number>> {
  const I = kitClass(classId).indicators;
  const dc = KIT_CALC_DATA.default_case;
  if (id === 'normal') return { currentBp: mmh2o(I.gt_bp_mbar.design), diffPressure: I.hrsg_dp_mbar.design, exhaustTemp: I.stack_c.design };
  if (id === 'alarm')
    return {
      currentBp: mmh2o(dc.gt_bp_mbar + (I.gt_bp_mbar.design - kitClass(dc.gt_class).indicators.gt_bp_mbar.design)),
      diffPressure: dc.hrsg_dp_mbar + (I.hrsg_dp_mbar.design - kitClass(dc.gt_class).indicators.hrsg_dp_mbar.design),
      exhaustTemp: dc.stack_c + (I.stack_c.design - kitClass(dc.gt_class).indicators.stack_c.design),
    };
  return { currentBp: mmh2o(I.gt_bp_mbar.danger + 0.5), diffPressure: I.hrsg_dp_mbar.danger + 0.5, exhaustTemp: I.stack_c.danger + 1 };
}

export const DEMO_SCENARIOS: Record<ScenarioId, { label: Localized; values: Partial<Record<NumericInputId, number>> }> = {
  normal: { label: { ko: '정상 시나리오', en: 'Normal scenario' }, values: scenarioValues('normal', 'F') },
  alarm: { label: { ko: '경보 시나리오', en: 'Alarm scenario' }, values: scenarioValues('alarm', 'F') },
  trip: { label: { ko: '트립 시나리오', en: 'Trip scenario' }, values: scenarioValues('trip', 'F') },
};

export const SCENARIO_LABEL: Record<ScenarioSelection, Localized> = {
  normal: DEMO_SCENARIOS.normal.label,
  alarm: DEMO_SCENARIOS.alarm.label,
  trip: DEMO_SCENARIOS.trip.label,
  custom: { ko: '사용자 지정', en: 'Custom' },
};

export const DEFAULT_SCENARIO: ScenarioSelection = 'alarm';
