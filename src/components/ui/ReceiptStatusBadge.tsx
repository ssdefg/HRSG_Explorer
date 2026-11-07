import type { Lang, ReceiptStatus, VerifyStatus } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { SUPPLY_LABEL, SUPPLY_STATES, VERIFY_LABEL, VERIFY_STATES } from '@/lib/checklist_adapter';

/** 수급 상태 글자 — 한국어는 키트 supply_states 글자, 영어는 같은 키의 번역 (저장은 영문 키) */
export const RECEIPT_LABEL: Record<Lang, Record<ReceiptStatus, string>> = {
  ko: SUPPLY_LABEL,
  en: { not_entered: 'Not measured', requested: 'Request needed', received: 'Received', verify_needed: 'Needs verification', na: 'N/A' },
};

/** 검증 상태 글자 — 키트 verify_states */
export const VERIFY_LABEL_L: Record<Lang, Record<VerifyStatus, string>> = {
  ko: VERIFY_LABEL,
  en: { unverified: 'Unverified', in_progress: 'Verifying', verified: 'Verified', failed: 'Failed' },
};

const GLYPH: Record<ReceiptStatus, string> = {
  not_entered: '∅',
  requested: '→',
  received: '✓',
  verify_needed: '?',
  na: '–',
};

export const RECEIPT_STATUSES: ReceiptStatus[] = SUPPLY_STATES;
export const VERIFY_STATUSES: VerifyStatus[] = VERIFY_STATES;

export function isReceiptStatus(v: string): v is ReceiptStatus {
  return (RECEIPT_STATUSES as string[]).includes(v);
}

export function isVerifyStatus(v: string): v is VerifyStatus {
  return (VERIFY_STATUSES as string[]).includes(v);
}

/** 데이터 수급 상태 배지 — 운전 상태(원형 점)·데이터 유형(점선)과 구분되는 좌측 막대형 */
export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const { lang } = useAppSettings();
  return (
    <span className={`badge badge--receipt badge--receipt-${status}`}>
      <span className="badge__glyph" aria-hidden="true">
        {GLYPH[status]}
      </span>
      {RECEIPT_LABEL[lang][status]}
    </span>
  );
}
