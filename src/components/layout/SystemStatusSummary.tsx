import type { SystemStatusSummary as Summary } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { formatDateTime } from '@/lib/format';

/** 헤더용 시스템 상태 요약 — 유닛별 운전 상태 점 + 활성 경보 수 (가상) */
export function SystemStatusSummary({ summary }: { summary: Summary }) {
  const { lang, t } = useAppSettings();
  return (
    <div className="sys-status" aria-label={`${t.systemStatus} (${t.dataType.mock})`}>
      <span className="sys-status__label">{t.systemStatus}</span>
      <span className="sys-status__mock" title={t.dataType.mock}>
        {t.dataType.mock}
      </span>
      {summary.units.map((u) => (
        <span key={u.unitId} className="sys-status__unit" title={t.operational[u.status]}>
          <span className={`sys-status__dot sys-status__dot--${u.status}`} aria-hidden="true" />
          {u.label[lang]}
          <span className="sr-only">: {t.operational[u.status]}</span>
        </span>
      ))}
      <span className="sys-status__sep" aria-hidden="true" />
      <span className="sys-status__alarm">
        {t.activeAlarms} <strong>{summary.activeAlarms}</strong>
      </span>
      <span className="sys-status__sep sys-status__updated" aria-hidden="true" />
      <span className="sys-status__updated">
        {t.lastUpdated} <span className="num">{formatDateTime(summary.lastUpdated, lang)}</span>
      </span>
    </div>
  );
}
