import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Card, DataTypeBadges, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { BP_THRESHOLDS, buildLossSensitivity, classifyBackpressure } from '@/lib/calc';
import type { CalculatorState } from '@/context/Workspace';
import { LEVEL_STATUS, levelLabel } from './level';

const AXIS_TICK = { fill: 'var(--c-ink-3)', fontSize: 11 };

function chartRange(current: number | null, reference: number | null) {
  const lo = Math.min(200, reference ?? 200, current ?? 200);
  const hi = Math.max(400, (current ?? 0) + 50, (reference ?? 0) + 100);
  const from = Math.max(0, Math.floor((lo - 20) / 50) * 50);
  const to = Math.ceil(hi / 50) * 50;
  const step = Math.max(5, Math.ceil((to - from) / 120 / 5) * 5);
  return { from, to, step };
}

export function PerformanceChart({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const { currentBp, referenceBp, operatingHours, smp, exhaustTemp, capacityMw, loadPct } = state.values;
  const m = state.metrics;
  const monthlyLossKrw = m.monthlyLossKrw.value;
  const powerLossMw = m.powerLossMw.value;
  const outputMw = state.bp.outputMw;
  const lossSharePct = m.powerLossMw.status === 'ok' ? state.bp.lossSharePct : null;
  // 사용자 입력 모드: 배압→손실 계수(0.015)가 검증된 모델이 아니므로 곡선을 그리지 않는다
  const modelBlocked = state.mode === 'user';

  const { from, to, step } = chartRange(currentBp, referenceBp);
  const ticks = Array.from({ length: Math.floor((to - from) / 50) + 1 }, (_, i) => from + i * 50);
  const data = modelBlocked ? [] : buildLossSensitivity(referenceBp, operatingHours, smp, from, to, step);
  const currentLossM = monthlyLossKrw === null ? null : monthlyLossKrw / 1e6;
  const n = (x: number | null, d = 0) => (x === null ? '—' : formatNumber(x, lang, d));

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { bp: number; monthlyLossMillionKrw: number };
    const lvl = classifyBackpressure(p.bp);
    return (
      <div className="chart-tip">
        <div className="chart-tip__head">
          {c.chartXAxis}: <strong className="num">{formatNumber(p.bp, lang, 0)}</strong>
        </div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--series" aria-hidden="true" />
          {c.chartSeries}: <strong className="num">{formatNumber(p.monthlyLossMillionKrw, lang, 1)}</strong> {c.million}
        </div>
        {lvl && <StatusBadge status={LEVEL_STATUS[lvl]} label={levelLabel(lvl, c)} />}
      </div>
    );
  };

  return (
    <Card
      span={2}
      title={c.chartTitle}
      subtitle={c.chartSubtitle}
      badges={<DataTypeBadges types={['mock', 'example', 'unconfirmed']} />}
    >
      <dl className="cond-strip">
        <div className="cond-strip__item">
          <dt>{c.outputExample}</dt>
          <dd>
            <span className="num">{n(outputMw, 1)}</span> <small>MW</small>
          </dd>
          <span className="cond-strip__sub">
            {c.outputFormula} ({n(capacityMw)} MW × {n(loadPct)}%)
          </span>
        </div>
        <div className="cond-strip__item">
          <dt>{c.stepPower}</dt>
          <dd>
            <span className="num">{n(powerLossMw, 2)}</span> <small>MW</small>
          </dd>
          <span className="cond-strip__sub">
            {c.lossShare} <span className="num">{n(lossSharePct, 2)}%</span>
          </span>
        </div>
        <div className="cond-strip__item">
          <dt>{c.stepMonthly}</dt>
          <dd>
            <span className="num">{n(currentLossM, 2)}</span> <small>{c.million}</small>
          </dd>
          <span className="cond-strip__sub">
            <DataTypeBadges types={['example']} />
          </span>
        </div>
        <div className="cond-strip__item">
          <dt>{c.exhaustTemp}</dt>
          <dd>
            <span className="num">{n(exhaustTemp)}</span> <small>°C</small>
          </dd>
          <span className="cond-strip__sub">
            <DataTypeBadges types={['mock']} />
          </span>
        </div>
      </dl>

      {data.length === 0 ? (
        <p className="chart-empty">{modelBlocked ? c.chartModel : c.chartEmpty}</p>
      ) : (
        <>
          <div className="chart-box" role="img" aria-label={`${c.chartTitle} — ${c.chartSubtitle}`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 22, left: 4 }}>
                <ReferenceArea x1={from} x2={BP_THRESHOLDS.caution} fill="var(--c-normal)" fillOpacity={0.07} ifOverflow="hidden" />
                <ReferenceArea
                  x1={BP_THRESHOLDS.caution}
                  x2={BP_THRESHOLDS.danger}
                  fill="var(--c-caution)"
                  fillOpacity={0.1}
                  ifOverflow="hidden"
                />
                <ReferenceArea x1={BP_THRESHOLDS.danger} x2={to} fill="var(--c-warning)" fillOpacity={0.07} ifOverflow="hidden" />
                <CartesianGrid stroke="var(--c-line)" vertical={false} />
                <XAxis
                  dataKey="bp"
                  type="number"
                  domain={[from, to]}
                  ticks={ticks}
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--c-line-strong)' }}
                  label={{ value: c.chartXAxis, position: 'insideBottom', offset: -12, fill: 'var(--c-ink-2)', fontSize: 12 }}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v: number) => formatNumber(v, lang, 0)}
                  label={{
                    value: c.chartYAxis,
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    dy: 70,
                    fill: 'var(--c-ink-2)',
                    fontSize: 12,
                  }}
                />
                <Tooltip content={renderTooltip} cursor={{ stroke: 'var(--c-line-strong)', strokeDasharray: '3 3' }} />
                {referenceBp !== null && (
                  <ReferenceLine
                    x={referenceBp}
                    stroke="var(--c-ink-2)"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                    label={{ value: `${c.gaugeReference} ${n(referenceBp)}`, position: 'insideTopRight', offset: 6, fill: 'var(--c-ink-2)', fontSize: 11 }}
                  />
                )}
                <Line
                  type="linear"
                  dataKey="monthlyLossMillionKrw"
                  name={c.chartSeries}
                  stroke="var(--c-chart-2)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, stroke: 'var(--c-surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {currentBp !== null && currentLossM !== null && (
                  <>
                    <ReferenceLine
                      x={currentBp}
                      stroke="var(--c-accent)"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                      label={{ value: `${c.gaugeCurrent} ${n(currentBp)}`, position: 'insideTopLeft', offset: 6, fill: 'var(--c-accent-ink)', fontSize: 11, fontWeight: 600 }}
                    />
                    <ReferenceDot
                      x={currentBp}
                      y={currentLossM}
                      r={6}
                      fill="var(--c-accent)"
                      stroke="var(--c-surface)"
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-key">
            <span className="chart-key__item">
              <span className="chart-key__line chart-key__line--series" aria-hidden="true" />
              {c.chartSeries}
            </span>
            <span className="chart-key__item">
              <span className="chart-key__line chart-key__line--ref" aria-hidden="true" />
              {c.chartRefLine}
            </span>
            <span className="chart-key__item">
              <span className="chart-key__line chart-key__line--cur" aria-hidden="true" />
              {c.chartCurLine}
            </span>
            <span className="chart-key__item chart-key__zones">
              <span className="chart-key__zone chart-key__zone--normal" aria-hidden="true" />
              {c.levelNormal}
              <span className="chart-key__zone chart-key__zone--caution" aria-hidden="true" />
              {c.levelCaution}
              <span className="chart-key__zone chart-key__zone--danger" aria-hidden="true" />
              {c.levelDanger}
              <DataTypeBadges types={['unconfirmed']} />
            </span>
          </div>
        </>
      )}
      <p className="note note--example">
        <DataTypeBadges types={['example']} /> {c.exampleNote}
      </p>
    </Card>
  );
}
