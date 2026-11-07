import {
  Area,
  ComposedChart,
  CartesianGrid,
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
import { classifyBackpressure } from '@/lib/calc';
import { kitLossCurve } from '@/lib/calc_adapter';
import type { CalculatorState } from '@/context/Workspace';
import { LEVEL_STATUS, levelLabel } from './level';

const AXIS_TICK = { fill: 'var(--c-ink-3)', fontSize: 11 };

/** 눈금 간격 — 범위에 따라 25·50·100 mmH₂O */
function tickStep(span: number): number {
  return span <= 150 ? 25 : span <= 400 ? 50 : 100;
}

export function PerformanceChart({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const { currentBp, referenceBp, operatingHours, smp, exhaustTemp, capacityMw, loadPct } = state.values;
  const bands = state.bands;
  const m = state.metrics;
  const monthlyLossKrw = m.monthlyLossKrw.value;
  const powerLossMw = m.powerLossMw.value;
  const outputMw = state.bp.outputMw;
  const lossSharePct = m.powerLossMw.status === 'ok' ? state.bp.lossSharePct : null;
  // 키트 lossCurve(GT 배압만 min~max 로 변화) — 손실 MW 를 키트 월간 금액식(MW × 월간 가동시간 × 원/MWh)으로 백만원 환산
  const curve = kitLossCurve(state.kit.run);
  const data =
    operatingHours === null || smp === null
      ? []
      : curve.map((p) => ({ bp: p.bp, monthlyLossMillionKrw: (p.lossMw * operatingHours * smp * 1000) / 1e6 }));
  const from = data.length ? Math.floor(data[0].bp / 25) * 25 : 0;
  const to = data.length ? Math.ceil(data[data.length - 1].bp / 25) * 25 : 0;
  const tStep = tickStep(to - from);
  const ticks = Array.from({ length: Math.floor((to - from) / tStep) + 1 }, (_, i) => from + i * tStep);
  const currentLossM = monthlyLossKrw === null ? null : monthlyLossKrw / 1e6;
  const n = (x: number | null, d = 0) => (x === null ? '—' : formatNumber(x, lang, d));

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { bp: number; monthlyLossMillionKrw: number };
    const lvl = classifyBackpressure(p.bp, bands);
    return (
      <div className="chart-tip">
        <div className="chart-tip__head">
          {c.chartXAxis}: <strong className="num">{formatNumber(p.bp, lang, 0)}</strong>
        </div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--main" aria-hidden="true" />
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
            <span className="num">{n(powerLossMw, 3)}</span> <small>MW</small>
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
        <p className="chart-empty">{c.chartEmpty}</p>
      ) : (
        <>
          <div className="chart-box" role="img" aria-label={`${c.chartTitle} — ${c.chartSubtitle}`}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 22, left: 4 }}>
                <defs>
                  <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-chart-main)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--c-chart-main)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceArea x1={from} x2={bands?.caution ?? from} fill="var(--c-normal)" fillOpacity={0.07} ifOverflow="hidden" />
                <ReferenceArea
                  x1={bands?.caution ?? from}
                  x2={bands?.danger ?? from}
                  fill="var(--c-caution)"
                  fillOpacity={0.1}
                  ifOverflow="hidden"
                />
                <ReferenceArea x1={bands?.danger ?? to} x2={to} fill="var(--c-warning)" fillOpacity={0.07} ifOverflow="hidden" />
                <CartesianGrid stroke="var(--c-chart-grid)" vertical={false} />
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
                {/* 메인 라인 — 오렌지 + 위에서 아래로 사라지는 영역 채움 */}
                <Area
                  type="linear"
                  dataKey="monthlyLossMillionKrw"
                  name={c.chartSeries}
                  stroke="var(--c-chart-main)"
                  strokeWidth={2.5}
                  fill="url(#perf-fill)"
                  dot={false}
                  activeDot={{ r: 5, stroke: 'var(--c-surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {currentBp !== null && currentLossM !== null && (
                  <>
                    <ReferenceLine
                      x={currentBp}
                      stroke="var(--c-ink-2)"
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-key">
            <span className="chart-key__item">
              <span className="chart-key__line chart-key__line--main" aria-hidden="true" />
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
