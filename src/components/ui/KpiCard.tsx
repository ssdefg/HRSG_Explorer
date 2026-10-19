import type { Kpi } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { formatNumber, pick } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { DeltaBadge } from './DeltaBadge';
import { DataTypeBadges } from './DataTypeBadge';

/** 핵심 KPI 카드 — 값은 크고 굵게, 단위·설명은 작고 차분하게 */
export function KpiCard({ kpi }: { kpi: Kpi }) {
  const { lang } = useAppSettings();
  const statusClass = kpi.status ? ` kpi--${kpi.status}` : '';
  return (
    <article className={`card kpi${statusClass}`}>
      <div className="kpi__top">
        <span className="kpi__label">{pick(kpi.label, lang)}</span>
        {kpi.status && <StatusBadge status={kpi.status} label={kpi.statusLabel?.[lang]} />}
      </div>
      <div className="kpi__value-row">
        <span className="kpi__value">{formatNumber(kpi.value, lang, kpi.digits)}</span>
        <span className="kpi__unit">{pick(kpi.unit, lang)}</span>
      </div>
      <div className="kpi__meta">
        {kpi.deltaPct !== undefined && <DeltaBadge value={kpi.deltaPct} higherIsBetter={kpi.higherIsBetter} />}
        {kpi.note && <span>{pick(kpi.note, lang)}</span>}
      </div>
      <div className="kpi__badges">
        <DataTypeBadges types={kpi.dataTypes} />
      </div>
    </article>
  );
}
