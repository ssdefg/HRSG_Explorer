import type { DataType, Localized } from '@/types';

/**
 * 계산기 입력 정의 — 기본값은 모두 시연용 가상 데이터다.
 * 범위(min/max)는 비정상 입력을 막기 위한 입력 검증용이며, 운전 한계를 뜻하지 않는다.
 */

export type HrsgClass = 'F' | 'J';

export const HRSG_CLASSES: { value: HrsgClass; label: string; demoCapacityMw: number }[] = [
  { value: 'F', label: 'F-class', demoCapacityMw: 150 },
  /** 270 MW는 시연용 값 — 실제 설비의 공식 용량이 아니다. */
  { value: 'J', label: 'J-class', demoCapacityMw: 270 },
];

export type NumericInputId =
  | 'capacityMw'
  | 'loadPct'
  | 'currentBp'
  | 'referenceBp'
  | 'exhaustTemp'
  | 'smp'
  | 'operatingHours'
  | 'drumPressure'
  | 'econOutletWaterTemp'
  | 'evapOutletGasTemp';

export type InputGroup = 'unit' | 'backpressure' | 'economics' | 'pinch';

export interface NumericInputDef {
  id: NumericInputId;
  group: InputGroup;
  label: Localized;
  unit: string | Localized;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  /** 표시 소수 자릿수 */
  digits: number;
  dataTypes: DataType[];
  /** 실측/설계 데이터로 교체해야 하는 항목 */
  needsReal: boolean;
  /** 실제 값이 없을 때 표시할 상태 */
  missingType: 'noMeasured' | 'unconfirmed';
}

export const NUMERIC_INPUTS: NumericInputDef[] = [
  {
    id: 'capacityMw', group: 'unit',
    label: { ko: '기준 설비 용량', en: 'Reference unit capacity' },
    unit: 'MW', defaultValue: 150, min: 1, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'unconfirmed',
  },
  {
    id: 'loadPct', group: 'unit',
    label: { ko: '운전 부하율', en: 'Operating load' },
    unit: '%', defaultValue: 90, min: 1, max: 110, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'currentBp', group: 'backpressure',
    label: { ko: '현재 배압', en: 'Current back pressure' },
    unit: 'mmH₂O', defaultValue: 320, min: 0, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'referenceBp', group: 'backpressure',
    label: { ko: '기준 배압', en: 'Reference back pressure' },
    unit: 'mmH₂O', defaultValue: 250, min: 0, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock', 'unconfirmed'], needsReal: true, missingType: 'unconfirmed',
  },
  {
    id: 'exhaustTemp', group: 'backpressure',
    label: { ko: '배기가스 출구 온도', en: 'Stack gas outlet temp.' },
    unit: '°C', defaultValue: 135, min: 30, max: 400, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'smp', group: 'economics',
    label: { ko: 'SMP', en: 'SMP' },
    unit: { ko: '원/kWh', en: 'KRW/kWh' }, defaultValue: 140, min: 0, max: 1000, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'operatingHours', group: 'economics',
    label: { ko: '월간 운전 시간', en: 'Monthly operating hours' },
    unit: 'h', defaultValue: 720, min: 0, max: 744, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'drumPressure', group: 'pinch',
    label: { ko: 'Drum Pressure', en: 'Drum pressure' },
    unit: 'bar', defaultValue: 100, min: 1, max: 250, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'econOutletWaterTemp', group: 'pinch',
    label: { ko: 'Economizer 출구 급수 온도', en: 'Economizer outlet water temp.' },
    unit: '°C', defaultValue: 150, min: 0, max: 400, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
  {
    id: 'evapOutletGasTemp', group: 'pinch',
    label: { ko: '증발기 출구 가스 온도', en: 'Evaporator outlet gas temp.' },
    unit: '°C', defaultValue: 350, min: 0, max: 700, step: 1, digits: 0,
    dataTypes: ['mock'], needsReal: true, missingType: 'noMeasured',
  },
];

export const INPUT_DEF: Record<NumericInputId, NumericInputDef> = Object.fromEntries(
  NUMERIC_INPUTS.map((d) => [d.id, d]),
) as Record<NumericInputId, NumericInputDef>;

export const INPUT_GROUP_LABEL: Record<InputGroup, Localized> = {
  unit: { ko: '설비·운전 조건', en: 'Unit & operation' },
  backpressure: { ko: '배압·배기', en: 'Back pressure & stack' },
  economics: { ko: '경제성 조건', en: 'Economic conditions' },
  pinch: { ko: 'Pinch / Approach 입력', en: 'Pinch / Approach inputs' },
};

export const DEFAULT_HRSG_CLASS: HrsgClass = 'F';
