import type { Lang, ReceiptStatus } from '@/types';
import { useAppSettings } from '@/context/AppSettings';

export const RECEIPT_LABEL: Record<Lang, Record<ReceiptStatus, string>> = {
  ko: { noMeasured: '실측 데이터 미입력', requestNeeded: '요청 필요', received: '수령 완료', needsVerification: '검증 필요' },
  en: { noMeasured: 'No measured data', requestNeeded: 'Request needed', received: 'Received', needsVerification: 'Needs verification' },
};

const GLYPH: Record<ReceiptStatus, string> = {
  noMeasured: '∅',
  requestNeeded: '→',
  received: '✓',
  needsVerification: '?',
};

export const RECEIPT_STATUSES: ReceiptStatus[] = ['noMeasured', 'requestNeeded', 'received', 'needsVerification'];

export function isReceiptStatus(v: string): v is ReceiptStatus {
  return (RECEIPT_STATUSES as string[]).includes(v);
}

/** 데이터 수령 상태 배지 — 운전 상태(원형 점)·데이터 유형(점선)과 구분되는 좌측 막대형 */
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
