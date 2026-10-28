/**
 * 체크리스트 진행률 — 모든 진행률 카드(상단·카테고리별·대시보드)가 이 함수만 사용한다.
 *
 * 정의
 * - 검토 진행률 = 검토 체크된 항목 수 ÷ 대상 항목 수 × 100
 * - 데이터 수령률 = (수령 완료 + 검증 필요) 항목 수 ÷ 대상 항목 수 × 100
 *   ('검증 필요'는 수령 이후 검증 대기 상태이므로 수령으로 집계한다)
 * - 필수 데이터 충족 = 필수 항목이 모두 '수령 완료' (검증 필요는 아직 미충족)
 * - 평가 가능 = 필수 데이터 충족 + 필수 항목 모두 검토 완료
 */
import type { ReceiptStatus } from '@/types';
import { calcRatioPct } from '@/lib/calc';
import { CHECKLIST_ITEMS, REQUIRED_ITEM_IDS, type ChecklistCategory } from '@/data/checklistItems';

export const RECEIVED_STATUSES: ReceiptStatus[] = ['received', 'needsVerification'];
export const PENDING_STATUSES: ReceiptStatus[] = ['noMeasured', 'requestNeeded'];

export interface ProgressStats {
  total: number;
  reviewedCount: number;
  reviewPct: number;
  receivedCount: number;
  receivedPct: number;
  byStatus: Record<ReceiptStatus, number>;
}

export function computeProgress(
  reviewed: Record<string, boolean>,
  status: Record<string, ReceiptStatus>,
  category?: ChecklistCategory,
): ProgressStats {
  const items = category ? CHECKLIST_ITEMS.filter((i) => i.category === category) : CHECKLIST_ITEMS;
  const byStatus: Record<ReceiptStatus, number> = { noMeasured: 0, requestNeeded: 0, received: 0, needsVerification: 0 };
  let reviewedCount = 0;
  for (const i of items) {
    byStatus[status[i.id] ?? 'noMeasured'] += 1;
    if (reviewed[i.id]) reviewedCount += 1;
  }
  const receivedCount = byStatus.received + byStatus.needsVerification;
  return {
    total: items.length,
    reviewedCount,
    reviewPct: calcRatioPct(reviewedCount, items.length),
    receivedCount,
    receivedPct: calcRatioPct(receivedCount, items.length),
    byStatus,
  };
}

export interface Readiness {
  requiredTotal: number;
  /** 필수 항목 중 '수령 완료'가 아닌 항목 */
  missingIds: string[];
  /** 필수 항목 중 검토되지 않은 항목 */
  unreviewedIds: string[];
  requiredMet: boolean;
  evaluable: boolean;
}

export function computeReadiness(reviewed: Record<string, boolean>, status: Record<string, ReceiptStatus>): Readiness {
  const missingIds = REQUIRED_ITEM_IDS.filter((id) => status[id] !== 'received');
  const unreviewedIds = REQUIRED_ITEM_IDS.filter((id) => !reviewed[id]);
  const requiredMet = missingIds.length === 0;
  return { requiredTotal: REQUIRED_ITEM_IDS.length, missingIds, unreviewedIds, requiredMet, evaluable: requiredMet && unreviewedIds.length === 0 };
}
