import type { SystemStatusSummary } from '@/types';

/**
 * 시연용 가상 시스템 상태.
 * 기업 데이터 수령 전이므로 실제 설비 상태를 반영하지 않는다.
 */
export const MOCK_SYSTEM_STATUS: SystemStatusSummary = {
  units: [
    { unitId: 'HRSG-1', label: { ko: 'HRSG #1', en: 'HRSG #1' }, status: 'normal' },
    { unitId: 'HRSG-2', label: { ko: 'HRSG #2', en: 'HRSG #2' }, status: 'caution' },
  ],
  activeAlarms: 1,
  lastUpdated: '2026-10-17T09:00:00+09:00',
  dataTypes: ['mock'],
};
