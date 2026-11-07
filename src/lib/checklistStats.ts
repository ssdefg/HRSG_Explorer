/**
 * 체크리스트 진행률 — 모든 진행률 카드(상단·카테고리별·대시보드)가 이 함수만 사용한다.
 * 계산 기준은 키트(checklist.js)를 그대로 쓴다 (checklist_adapter 경유):
 * - 수령 = 수령 완료(received) + 검증 필요(verify_needed)
 * - 해당 없음(na)은 모든 비율의 분모에서 뺀다
 * - 필수 충족 = 수령했고 검증 실패(failed)가 아님
 * - 평가 가능(앱 기준) = 필수 충족 + 필수 항목 모두 검토 완료
 */
import type { ReceiptStatus } from '@/types';
import type { KitProgress } from '@/lib/kit';
import { progressStats, requiredReadiness } from '@/lib/checklist_adapter';
import { REQUIRED_ITEM_IDS, type ChecklistCategory } from '@/data/checklistItems';

export const RECEIVED_STATUSES: ReceiptStatus[] = ['received', 'verify_needed'];
export const PENDING_STATUSES: ReceiptStatus[] = ['not_entered', 'requested'];

export interface ProgressStats {
  /** 해당 없음을 뺀 항목 수 */
  total: number;
  reviewedCount: number;
  reviewPct: number;
  receivedCount: number;
  receivedPct: number;
  verifiedCount: number;
  verifiedPct: number;
  byStatus: Record<ReceiptStatus, number>;
}

export function computeProgress(progress: KitProgress, category?: ChecklistCategory): ProgressStats {
  const s = progressStats(progress, category);
  return {
    total: s.total,
    reviewedCount: s.reviewedCount,
    reviewPct: s.reviewPct,
    receivedCount: s.receivedCount,
    receivedPct: s.receivedPct,
    verifiedCount: s.verifiedCount,
    verifiedPct: s.verifiedPct,
    byStatus: s.bySupply,
  };
}

export interface Readiness {
  requiredTotal: number;
  /** 필수 항목 중 충족(수령 + 검증 실패 아님)이 아닌 항목 — 해당 없음 제외 */
  missingIds: string[];
  /** 필수 항목 중 검토되지 않은 항목 */
  unreviewedIds: string[];
  requiredMet: boolean;
  evaluable: boolean;
}

export function computeReadiness(progress: KitProgress): Readiness {
  const r = requiredReadiness(progress);
  const unreviewedIds = REQUIRED_ITEM_IDS.filter((id) => progress[id]?.supply !== 'na' && !progress[id]?.reviewed);
  const requiredMet = r.missingIds.length === 0;
  return { requiredTotal: r.requiredTotal, missingIds: r.missingIds, unreviewedIds, requiredMet, evaluable: requiredMet && unreviewedIds.length === 0 };
}

/** 실측값이 있어야 고를 수 있는 상태 (가이드 §2.4 가드레일) */
export function statusNeedsValue(s: ReceiptStatus): boolean {
  return s === 'received' || s === 'verify_needed';
}
