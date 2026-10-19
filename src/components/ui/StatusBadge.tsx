import type { OperationalStatus } from '@/types';
import { useAppSettings } from '@/context/AppSettings';

/** 실제 운전 상태 배지 — 채움 캡슐 + 원형 점 */
export function StatusBadge({ status, label }: { status: OperationalStatus; label?: string }) {
  const { t } = useAppSettings();
  return <span className={`badge badge--status badge--${status}`}>{label ?? t.operational[status]}</span>;
}
