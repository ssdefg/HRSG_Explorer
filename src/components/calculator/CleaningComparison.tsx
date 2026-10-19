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
import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { calcSimplePaybackMonths } from '@/lib/calc';
import { MOCK_CLEANING_METHODS } from '@/data/mockCleaning';

const AXIS_TICK = { fill: 'var(--c-ink-3)', fontSize: 11 };

export function CleaningComparison() {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const won = (v: number) => `${formatNumber(v, lang, 0)}${lang === 'ko' ? '원' : ' KRW'}`;

  const data = MOCK_CLEANING_METHODS.map((m) => ({
    name: m.label[lang],
    cost: m.costKrw / 1e6,
    benefit: m.monthlyBenefitKrw / 1e6,
    costKrw: m.costKrw,
    benefitKrw: m.monthlyBenefitKrw,
  }));

  const renderTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as (typeof data)[number];
    return (
      <div className="chart-tip">
        <div className="chart-tip__head">{label}</div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--cost" aria-hidden="true" />
          {c.cleanCost}: <strong className="num">{won(p.costKrw)}</strong>
        </div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--benefit" aria-hidden="true" />
          {c.cleanBenefit}: <strong className="num">{won(p.benefitKrw)}</strong>
        </div>
        <DataTypeBadges types={['mock']} />
      </div>
    );
  };

  return (
    <Card span={2} title={c.cleanTitle} subtitle={c.cleanSubtitle} badges={<DataTypeBadges types={['mock']} />}>
      <p className="note note--warn">{c.cleanNotice}</p>

      <div className="clean-grid">
        <div className="chart-box" role="img" aria-label={`${c.cleanTitle} (${c.million})`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid stroke="var(--c-line)" vertical={false} />
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
              <Bar dataKey="cost" name={`${c.cleanCost} (${c.million})`} fill="var(--c-chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar
                dataKey="benefit"
                name={`${c.cleanBenefit} (${c.million})`}
                fill="var(--c-chart-2)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{c.cleanMethod}</th>
                <th scope="col" className="num-col">
                  {c.cleanCost}
                </th>
                <th scope="col" className="num-col">
                  {c.cleanBenefit}
                </th>
                <th scope="col" className="num-col">
                  {c.cleanPayback}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CLEANING_METHODS.map((m) => {
                const pb = calcSimplePaybackMonths(m.costKrw, m.monthlyBenefitKrw);
                return (
                  <tr key={m.id}>
                    <th scope="row">{m.label[lang]}</th>
                    <td className="num-col num">{won(m.costKrw)}</td>
                    <td className="num-col num">{won(m.monthlyBenefitKrw)}</td>
                    <td className="num-col num">
                      {pb === null ? '—' : `${formatNumber(pb, lang, 2)} ${c.cleanPaybackUnit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-foot">
            <DataTypeBadges types={['mock']} />
            <span className="note">{c.cleanPaybackNote}</span>
            <DataTypeBadges types={['example']} />
          </div>
        </div>
      </div>
    </Card>
  );
}
