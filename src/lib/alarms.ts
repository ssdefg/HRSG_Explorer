/**
 * DEMO 경보 규칙 — 활성 경보 수는 여기 정의된 규칙만 집계한다 (임의의 숫자를 만들지 않는다).
 * 규칙과 임계값은 시연용이며 실제 설비 경보 설정이 아니다.
 */
import type { Localized } from '@/types';
import { BP_THRESHOLDS } from '@/lib/calc';
import type { ScenarioSelection } from '@/data/calculatorInputs';

export interface AlarmContext {
  currentBp: number | null;
  scenario: ScenarioSelection;
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
      ko: `현재 배압 ≥ 시연용 주의 임계값 ${BP_THRESHOLDS.caution} mmH₂O`,
      en: `Current back pressure ≥ demo caution threshold ${BP_THRESHOLDS.caution} mmH₂O`,
    },
    active: (c) => c.currentBp !== null && c.currentBp >= BP_THRESHOLDS.caution,
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
