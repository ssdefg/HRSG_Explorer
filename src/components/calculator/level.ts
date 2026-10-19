import type { BackpressureLevel } from '@/lib/calc';
import type { OperationalStatus } from '@/types';
import type { CalcStrings } from '@/i18n/calculatorStrings';

/** 시연용 배압 단계 → 운전 상태 배지 스타일 (위험은 빨강 'warning' 스타일에 '위험' 문구) */
export const LEVEL_STATUS: Record<BackpressureLevel, OperationalStatus> = {
  normal: 'normal',
  caution: 'caution',
  danger: 'warning',
};

export function levelLabel(level: BackpressureLevel, c: CalcStrings): string {
  return level === 'normal' ? c.levelNormal : level === 'caution' ? c.levelCaution : c.levelDanger;
}
