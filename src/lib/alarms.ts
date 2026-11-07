/**
 * DEMO 경보 규칙 — 활성 경보 수는 여기 정의된 규칙만 집계한다 (임의의 숫자를 만들지 않는다).
 * 판정 구간은 키트 GT 배압 지표(caution · danger, 기준 배압으로 다시 맞춘 값)를 쓴다. 실제 설비 경보 설정이 아니다.
 */
import type { Localized } from '@/types';
import type { ScenarioSelection } from '@/data/calculatorInputs';

export interface AlarmContext {
  currentBp: number | null;
  scenario: ScenarioSelection;
  /** 키트 GT 배압 판정 구간 [mmH₂O] (calc.bands) — 없으면 배압 규칙은 판정하지 않는다 */
  bands: { caution: number } | null;
}

export interface AlarmRule {
  id: string;
  label: Localized;
  active: (c: AlarmContext) => boolean;
}

export const DEMO_ALARM_RULES: AlarmRule[] = [
  {
    id: 'bp-over-caution',
    label: {
      ko: '현재 GT 배압 ≥ 키트 주의 구간 (GT 등급 지표)',
      en: 'GT back pressure ≥ kit caution band (GT class indicator)',
    },
    active: (c) => c.currentBp !== null && c.bands !== null && c.currentBp >= c.bands.caution,
  },
  {
    id: 'trip-scenario',
    label: { ko: '트립 시나리오 선택됨', en: 'Trip scenario selected' },
    active: (c) => c.scenario === 'trip',
  },
];

export function activeAlarms(c: AlarmContext): AlarmRule[] {
  return DEMO_ALARM_RULES.filter((r) => r.active(c));
}
