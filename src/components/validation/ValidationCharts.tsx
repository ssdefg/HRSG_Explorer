import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Card, DataTypeBadges, SegmentedToggle } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useMeasurements } from '@/context/Workspace';
import { formatNumber } from '@/lib/format';
import { buildCumulativeBenefit } from '@/lib/calc';
import type { CalculatorState } from '@/context/Workspace';
import { VALIDATION_SCENARIO, buildScenarioSeries, type SeriesMetric } from '@/data/validationScenario';

const AXIS_TICK = { fill: 'var(--c-ink-3)', fontSize: 11 };

const TXT = {
  ko: {
    tsTitle: '세정 전후 시계열',
    tsSub: '세정 전 30일 · 세정 후 60일 (세정일 = 0일)',
    demoTag: '시연용 가상 데이터',
    metric: '지표',
    bp: '배압',
    temp: '배기가스 출구 온도',
    xDay: '세정일 기준 경과일 (일)',
    cleaning: '세정 시점',
    scenario: '가상 시나리오',
    measured: '사용자 입력 측정값 (검증 전)',
    noMeasured: '실측 데이터 미입력 — 측정값 구간은 비어 있습니다',
    day: (d: number) => (d > 0 ? `세정 후 ${d}일` : `세정 전 ${-d}일`),
    gapNote: '세정일(0일)은 작업·정지 구간으로 보고 값을 두지 않았습니다. 측정값이 없는 구간은 측정값으로 채우지 않습니다.',
    cumTitle: '누적 순편익 및 손익분기 (예시 계산)',
    cumSub: '일일 순증분 편익 × 경과일 vs 총 세정비용(초기 투자) 기준선 · 교차점 = 손익분기',
    cumEmpty: '입력값 오류 또는 편익 0 이하로 누적 순편익을 산출할 수 없습니다 (산출 불가).',
    beyond: (d: string) => `손익분기 ${d}일 — 표시 구간(60일)을 벗어납니다.`,
    cumY: '누적 금액 (백만원)',
    costLine: (v: string) => `총 세정비용 ${v}백만원`,
    cumX: '세정 후 경과일 (일)',
    cumSeries: '누적 순편익',
    breakEven: (d: string) => `손익분기 ${d}일`,
    cumNote: (daily: string) => `일일 순증분 편익 ${daily}원(= 월간 순증분 편익 ÷ 30일)을 일정하게 가정한 단순 시연 계산입니다. 실제 투자회수기간이 아닙니다.`,
    million: '백만원',
  },
  en: {
    tsTitle: 'Pre/post time series',
    tsSub: '30 days before · 60 days after (cleaning day = 0)',
    demoTag: 'Mock data for demo',
    metric: 'Metric',
    bp: 'Back pressure',
    temp: 'Stack gas outlet temp.',
    xDay: 'Days from cleaning (d)',
    cleaning: 'Cleaning',
    scenario: 'Mock scenario',
    measured: 'User-entered measurements (unverified)',
    noMeasured: 'No measured data — measurement series is empty',
    day: (d: number) => (d > 0 ? `${d} d after cleaning` : `${-d} d before cleaning`),
    gapNote: 'Cleaning day (0) is treated as work/outage and has no value. Periods without measurements are not filled with measured data.',
    cumTitle: 'Cumulative net benefit & break-even (example calc)',
    cumSub: 'Daily incremental benefit × days vs total cleaning cost (initial investment) · crossing = break-even',
    cumEmpty: 'Cannot compute cumulative benefit — invalid inputs or benefit ≤ 0 (not computable).',
    beyond: (d: string) => `Break-even ${d} d — beyond the 60-day window shown.`,
    cumY: 'Cumulative (KRW M)',
    costLine: (v: string) => `Total cleaning cost ${v} M`,
    cumX: 'Days after cleaning (d)',
    cumSeries: 'Cumulative net benefit',
    breakEven: (d: string) => `Break-even ${d} d`,
    cumNote: (daily: string) => `Simple demo calc assuming a constant daily incremental benefit of ${daily} KRW (= monthly ÷ 30). Not an actual payback period.`,
    million: 'KRW M',
  },
};

const UNIT: Record<SeriesMetric, string> = { backPressure: 'mmH₂O', exhaustTemp: '°C' };

export function TimeSeriesCard() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const { entries } = useMeasurements();
  const [metric, setMetric] = useState<SeriesMetric>('backPressure');
  const series = useMemo(buildScenarioSeries, []);
  const before = series.filter((p) => p.day < 0);
  const after = series.filter((p) => p.day > 0);
  const measured = entries
    .filter((e) => e[metric] !== null)
    .map((e) => ({ day: e.day, value: e[metric] as number }))
    .sort((a, b) => a.day - b.day);
  const label = metric === 'backPressure' ? x.bp : x.temp;
  const unit = UNIT[metric];

  const renderTip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p) => typeof p.value === 'number');
    if (rows.length === 0) return null;
    const day = (rows[0].payload as { day: number }).day;
    return (
      <div className="chart-tip">
        <div className="chart-tip__head">{x.day(day)}</div>
        {rows.map((r, i) => {
          const isMeasured = r.dataKey === 'value';
          return (
            <div key={i} className="chart-tip__row">
              <span
                className={`chart-tip__swatch ${isMeasured ? 'chart-tip__swatch--measured' : 'chart-tip__swatch--series'}`}
                aria-hidden="true"
              />
              {isMeasured ? x.measured : x.scenario}: <strong className="num">{formatNumber(r.value as number, lang, 1)}</strong> {unit}
            </div>
          );
        })}
        <DataTypeBadges types={[rows.some((r) => r.dataKey === 'value') ? 'measured' : 'scenario']} />
      </div>
    );
  };

  return (
    <Card
      span={2}
      title={x.tsTitle}
      subtitle={x.tsSub}
      badges={<DataTypeBadges types={['scenario', entries.length ? 'measured' : 'noMeasured']} />}
    >
      <div className="ts-toolbar">
        <SegmentedToggle<SeriesMetric>
          className="seg--light"
          label={x.metric}
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'backPressure', label: `${x.bp} (mmH₂O)` },
            { value: 'exhaustTemp', label: `${x.temp} (°C)` },
          ]}
        />
        <span className="demo-tag">{x.demoTag}</span>
      </div>
      <div className="chart-box" role="img" aria-label={`${x.tsTitle}: ${label} (${unit})`}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart margin={{ top: 8, right: 16, bottom: 22, left: 4 }}>
            <CartesianGrid stroke="var(--c-chart-grid)" vertical={false} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[-VALIDATION_SCENARIO.daysBefore, VALIDATION_SCENARIO.daysAfter]}
              ticks={[-30, -15, 0, 15, 30, 45, 60]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--c-line-strong)' }}
              allowDuplicatedCategory={false}
              label={{ value: x.xDay, position: 'insideBottom', offset: -12, fill: 'var(--c-ink-2)', fontSize: 12 }}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={['auto', 'auto']}
              label={{ value: `${label} (${unit})`, angle: -90, position: 'insideLeft', offset: 12, dy: 60, fill: 'var(--c-ink-2)', fontSize: 12 }}
            />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--c-line-strong)', strokeDasharray: '3 3' }} />
            <ReferenceLine
              x={0}
              stroke="var(--c-ink-2)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              label={{ value: x.cleaning, position: 'insideTopRight', fill: 'var(--c-ink-2)', fontSize: 11, fontWeight: 600 }}
            />
            {/* 가상 시나리오 기준선 = 점선 · 사용자 실측값 = 실선 + 포인트 (가이드 §2.5) */}
            <Line data={before} dataKey={metric} name={x.scenario} stroke="var(--c-chart-2)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line data={after} dataKey={metric} name={x.scenario} stroke="var(--c-chart-2)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            {measured.length > 0 && (
              <Line
                data={measured}
                dataKey="value"
                name={x.measured}
                stroke="var(--c-chart-main)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'var(--c-chart-main)', stroke: 'var(--c-surface)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-key">
        <span className="chart-key__item">
          <span className="chart-key__line chart-key__line--ref" aria-hidden="true" />
          {x.scenario}
          <DataTypeBadges types={['scenario']} />
        </span>
        <span className="chart-key__item">
          <span className="chart-key__line chart-key__line--main chart-key__line--dot" aria-hidden="true" />
          {x.measured}
          {measured.length === 0 ? <DataTypeBadges types={['noMeasured']} /> : <DataTypeBadges types={['measured']} />}
        </span>
        <span className="chart-key__item">
          <span className="chart-key__line chart-key__line--ref" aria-hidden="true" />
          {x.cleaning}
        </span>
      </div>
      {measured.length === 0 && <p className="note">{x.noMeasured}</p>}
      <p className="note">{x.gapNote}</p>
    </Card>
  );
}

export function CumulativeBenefitCard({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const s = VALIDATION_SCENARIO;
  const m = state.metrics;
  // 중앙 계산 엔진의 초기 투자·일일 순증분 편익·정지일수로만 그린다 (별도 하드코딩 값 없음)
  const ok = m.initialInvestmentKrw.status === 'ok' && m.monthlyIncrementalBenefitKrw.status === 'ok';
  const data = ok ? buildCumulativeBenefit(state.cleaning.dailyIncrementalBenefitKrw, s.daysAfter) : [];
  const costM = ok && m.initialInvestmentKrw.value !== null ? m.initialInvestmentKrw.value / 1e6 : null;
  const be = m.breakEvenDays.status === 'ok' ? m.breakEvenDays.value : null;
  const beText = be === null ? '—' : formatNumber(be, lang, 1);
  const daily = state.cleaning.dailyIncrementalBenefitKrw;

  const renderTip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as { day: number; benefitMillionKrw: number };
    return (
      <div className="chart-tip">
        <div className="chart-tip__head">{x.day(p.day)}</div>
        <div className="chart-tip__row">
          <span className="chart-tip__swatch chart-tip__swatch--main" aria-hidden="true" />
          {x.cumSeries}: <strong className="num">{formatNumber(p.benefitMillionKrw, lang, 2)}</strong> {x.million}
        </div>
        <DataTypeBadges types={['mock', 'example']} />
      </div>
    );
  };

  return (
    <Card span={2} title={x.cumTitle} subtitle={x.cumSub} badges={<DataTypeBadges types={['mock', 'example']} />}>
      {data.length === 0 ? (
        <p className="chart-empty">{x.cumEmpty}</p>
      ) : (
        <div className="chart-box" role="img" aria-label={`${x.cumTitle} — ${x.breakEven(beText)}`}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 22, left: 4 }}>
              <defs>
                <linearGradient id="cum-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--c-chart-main)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--c-chart-main)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--c-chart-grid)" vertical={false} />
              <XAxis
                dataKey="day"
                type="number"
                domain={[0, s.daysAfter]}
                ticks={[0, 10, 20, 30, 40, 50, 60]}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--c-line-strong)' }}
                label={{ value: x.cumX, position: 'insideBottom', offset: -12, fill: 'var(--c-ink-2)', fontSize: 12 }}
              />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => formatNumber(v, lang, 0)}
                label={{ value: x.cumY, angle: -90, position: 'insideLeft', offset: 12, dy: 60, fill: 'var(--c-ink-2)', fontSize: 12 }}
              />
              <Tooltip content={renderTip} cursor={{ stroke: 'var(--c-line-strong)', strokeDasharray: '3 3' }} />
              {costM !== null && (
                <ReferenceLine
                  y={costM}
                  stroke="var(--c-ink-2)"
                  strokeDasharray="5 4"
                  label={{ value: x.costLine(formatNumber(costM, lang, 1)), position: 'insideBottomRight', fill: 'var(--c-ink-2)', fontSize: 11 }}
                />
              )}
              {be !== null && be <= s.daysAfter && (
                <ReferenceLine
                  x={be}
                  stroke="var(--c-accent)"
                  strokeDasharray="4 3"
                  label={{ value: x.breakEven(beText), position: 'insideTopLeft', fill: 'var(--c-accent-ink)', fontSize: 11, fontWeight: 600 }}
                />
              )}
              <Area type="linear" dataKey="benefitMillionKrw" name={x.cumSeries} stroke="var(--c-chart-main)" strokeWidth={2.5} fill="url(#cum-fill)" dot={false} isAnimationActive={false} />
              {be !== null && be <= s.daysAfter && costM !== null && <ReferenceDot x={be} y={costM} r={6} fill="var(--c-accent)" stroke="var(--c-surface)" strokeWidth={2} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {be !== null && be > s.daysAfter && <p className="note note--warn">{x.beyond(beText)}</p>}
      <p className="note">{x.cumNote(daily === null ? '—' : formatNumber(daily, lang, 0))}</p>
    </Card>
  );
}
