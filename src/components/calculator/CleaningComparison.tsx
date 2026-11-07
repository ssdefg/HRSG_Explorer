import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Card, DataTypeBadges, SegmentedToggle } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { formatKrw } from '@/lib/calc_adapter';
import type { KitMethodRow } from '@/lib/kit';
import type { CalculatorState } from '@/context/Workspace';

const AXIS_TICK = { fill: 'var(--c-ink-3)', fontSize: 11 };

type SortTab = 'payback' | 'total' | 'net';

const TXT = {
  ko: {
    tabs: { payback: '회수기간', total: '총투자', net: '첫 달 순편익' } satisfies Record<SortTab, string>,
    sort: '정렬',
    outage: '정지일수',
    recovered: '회수 출력',
    monthly: '월간 편익',
    outageLoss: '정지 손실',
    total: '총투자',
    net: '첫 달 순편익',
    fastest: '회수기간이 가장 짧은 공법 (가정 기준, 추천 아님)',
    maxNet: '연간 순편익 최대',
    input: '화면 입력',
    source: '키트 compareMethods — 드라이아이스 세정은 화면 입력값, 나머지 공법은 키트 데이터 (DEMO)',
  },
  en: {
    tabs: { payback: 'Payback', total: 'Total investment', net: 'First-month net' } satisfies Record<SortTab, string>,
    sort: 'Sort',
    outage: 'Outage days',
    recovered: 'Recovered',
    monthly: 'Monthly benefit',
    outageLoss: 'Outage loss',
    total: 'Total investment',
    net: 'First-month net',
    fastest: 'Shortest payback (assumption, not a recommendation)',
    maxNet: 'Max annual net benefit',
    input: 'screen input',
    source: 'Kit compareMethods — dry ice uses screen inputs; other methods use kit data (DEMO)',
  },
};

const SORT_KEY: Record<SortTab, (r: KitMethodRow) => number> = {
  payback: (r) => r.payback_months ?? Infinity,
  total: (r) => r.total_investment_krw ?? Infinity,
  net: (r) => -(r.first_month_net_krw ?? -Infinity),
};

/** 세정 공법 비교 — 키트 compareMethods 결과 (회수기간 · 총투자 · 첫 달 순편익 탭) */
export function CleaningComparison({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const x = TXT[lang];
  const [tab, setTab] = useState<SortTab>('payback');
  const rows = state.kit.methods;
  const ok = rows.filter((r) => r.available);
  const sorted = [...ok].sort((a, b) => SORT_KEY[tab](a) - SORT_KEY[tab](b)).concat(rows.filter((r) => !r.available));
  const krw = (v: number | undefined | null) => (lang === 'ko' ? formatKrw(v) : v == null ? '—' : `${formatNumber(v / 1e6, lang, 0)} M KRW`);

  const data = ok.map((r) => ({
    name: r.name,
    cost: (r.total_investment_krw ?? 0) / 1e6,
    benefit: (r.monthly_benefit_krw ?? 0) / 1e6,
    row: r,
  }));

  const renderTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = (payload[0].payload as (typeof data)[number]).row;
    return (
      <div className="chart-tip">
        <div className="chart-tip__head">{label}</div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--cost" aria-hidden="true" />
          {x.total}: <strong className="num">{krw(p.total_investment_krw)}</strong>
        </div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--benefit" aria-hidden="true" />
          {x.monthly}: <strong className="num">{krw(p.monthly_benefit_krw)}</strong>
        </div>
        <DataTypeBadges types={['mock', 'example']} />
      </div>
    );
  };

  return (
    <Card span={2} title={c.cleanTitle} subtitle={c.cleanSubtitle} badges={<DataTypeBadges types={['mock', 'example']} />}>
      <p className="note note--warn">{c.cleanNotice}</p>
      <SegmentedToggle<SortTab>
        className="seg--light"
        label={x.sort}
        value={tab}
        onChange={setTab}
        options={(['payback', 'total', 'net'] as SortTab[]).map((t) => ({ value: t, label: x.tabs[t] }))}
      />

      <div className="clean-grid clean-grid--stack">
        <div className="chart-box" role="img" aria-label={`${c.cleanTitle} (${c.million})`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid stroke="var(--c-chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--c-line-strong)' }} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => formatNumber(v, lang, 0)}
                label={{ value: c.million, angle: -90, position: 'insideLeft', offset: 14, fill: 'var(--c-ink-2)', fontSize: 12 }}
              />
              <Tooltip content={renderTooltip} cursor={{ fill: 'var(--c-surface-2)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                height={28}
                iconType="square"
                iconSize={10}
                formatter={(v: string) => <span className="chart-legend-text">{v}</span>}
              />
              <Bar dataKey="cost" name={`${x.total} (${c.million})`} fill="var(--c-chart-1)" barSize={16} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="benefit" name={`${x.monthly} (${c.million})`} fill="var(--c-chart-main)" barSize={16} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-wrap">
          <table className="data-table" data-testid="method-table">
            <thead>
              <tr>
                <th scope="col">{c.cleanMethod}</th>
                <th scope="col" className="num-col">{c.cleanCost}</th>
                <th scope="col" className="num-col">{x.outage}</th>
                <th scope="col" className="num-col">{x.recovered}</th>
                <th scope="col" className="num-col">{x.monthly}</th>
                <th scope="col" className="num-col">{x.outageLoss}</th>
                <th scope="col" className="num-col">{x.total}</th>
                <th scope="col" className="num-col">{c.cleanPayback}</th>
                <th scope="col" className="num-col">{x.net}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} data-method={r.id}>
                  <th scope="row">
                    {r.name}
                    {r.id === state.kit.bestPaybackId && <span className="src-tag src-tag--user"> {x.fastest}</span>}
                    {r.id === state.kit.maxNetBenefitId && <span className="src-tag"> {x.maxNet}</span>}
                    {r.id === 'dryice' && <span className="src-tag"> {x.input}</span>}
                  </th>
                  {r.available ? (
                    <>
                      <td className="num-col num">{krw(r.cost_krw)}</td>
                      <td className="num-col num">{formatNumber(r.outage_days ?? 0, lang, 0)}</td>
                      <td className="num-col num">{formatNumber(r.recovered_mw ?? 0, lang, 2)} MW</td>
                      <td className="num-col num">{krw(r.monthly_benefit_krw)}</td>
                      <td className="num-col num">{krw(r.outage_loss_krw)}</td>
                      <td className="num-col num">{krw(r.total_investment_krw)}</td>
                      <td className="num-col num">
                        {r.payback_months == null ? '—' : `${formatNumber(r.payback_months, lang, 2)} ${c.cleanPaybackUnit}`}
                      </td>
                      <td className="num-col num">{krw(r.first_month_net_krw)}</td>
                    </>
                  ) : (
                    <td colSpan={8} className="metric-tag metric-tag--invalid">
                      {r.message}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-foot">
            <DataTypeBadges types={['mock', 'example']} />
            <span className="note">{x.source}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
