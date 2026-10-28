import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { POWER_LOSS_COEFF_MW_PER_MMH2O } from '@/lib/calc';
import type { CalculatorState } from '@/context/Workspace';
import type { MetricId } from '@/lib/calculatorModel';
import { SECTION_IDS } from '@/data/tabs';
import { MetricStatusTag, fmtMetric } from './metricText';

const TXT = {
  ko: {
    bpTitle: '배압 기반 발전 손실 (예시 계산)',
    ecoTitle: '세정 경제성 (평가 기간 1개월 · 예시 계산)',
    effectiveHours: '세정 후 유효 가동시간',
    revenue: '추가 발전 매출',
    shutdownLoss: '정지 손실',
    investment: '초기 투자 (세정 비용 + 정지 손실 + 추가 비용)',
    net: '세정 순편익 (첫 1개월)',
    monthly: '월간 순증분 편익 (정상 월)',
    payback: '단순 회수 기간',
    breakeven: '손익분기 (경과일)',
    months: '개월',
    days: '일',
    notPayback: '회수 불가',
    separate:
      '배압 기반 손실 추정치와 회수 출력은 서로 다른 값입니다. 회수 출력은 입력 가정값이며 배압 손실 계산 결과를 그대로 쓰지 않습니다.',
    noDouble:
      '정지 시간은 유효 가동시간에서 빠지고(회수 출력 없음), 정지 손실은 기저 운전 출력의 기회비용으로 한 번만 차감합니다. 일회성 비용은 초기 투자에만 넣고 월간 편익에서 다시 빼지 않습니다.',
  },
  en: {
    bpTitle: 'Back-pressure-based power loss (example calc)',
    ecoTitle: 'Cleaning economics (1-month evaluation · example calc)',
    effectiveHours: 'Effective operating hours after cleaning',
    revenue: 'Additional generation revenue',
    shutdownLoss: 'Shutdown loss',
    investment: 'Initial investment (cleaning + shutdown loss + additional)',
    net: 'Net cleaning benefit (first month)',
    monthly: 'Monthly incremental benefit (steady month)',
    payback: 'Simple payback',
    breakeven: 'Break-even (days elapsed)',
    months: 'months',
    days: 'd',
    notPayback: 'No payback',
    separate:
      'BP-based loss estimate and recovered output are different values. Recovered output is an input assumption, not the BP loss result.',
    noDouble:
      'Shutdown time is removed from effective hours (no recovered output) and the shutdown loss is the base-output opportunity cost, deducted once. One-off costs go into initial investment only, not again from monthly benefit.',
  },
};

interface Row {
  id: MetricId;
  label: string;
  formula: string;
  digits: number;
  unit: string;
}

/** 중앙 계산 엔진의 각 단계를 실제 대입값과 함께 보여준다 — 검증 가능성 확보 */
export function CalculationResult({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const x = TXT[lang];
  const { values: v, metrics: m } = state;
  const n = (val: number | null, d = 0) => (val === null ? '—' : formatNumber(val, lang, d));
  const won = c.won;
  const smpU = lang === 'ko' ? '원/kWh' : 'KRW/kWh';

  const bpRows: Row[] = [
    { id: 'deltaBp', label: c.stepDelta, formula: `max(0, ${n(v.currentBp)} − ${n(v.referenceBp)})`, digits: 0, unit: 'mmH₂O' },
    { id: 'powerLossMw', label: c.stepPower, formula: `${fmtMetric(m.deltaBp, lang)} × ${POWER_LOSS_COEFF_MW_PER_MMH2O}`, digits: 2, unit: 'MW' },
    {
      id: 'monthlyLossKrw',
      label: c.stepMonthly,
      formula: `${fmtMetric(m.powerLossMw, lang, 2)} × 1,000 × ${n(v.operatingHours)} h × ${n(v.smp)} ${smpU}`,
      digits: 0,
      unit: won,
    },
  ];

  const ecoRows: Row[] = [
    { id: 'effectiveHours', label: x.effectiveHours, formula: `${n(v.operatingHours)} h − ${n(v.shutdownDays, 1)} × 24 h`, digits: 0, unit: 'h' },
    {
      id: 'additionalRevenueKrw',
      label: x.revenue,
      formula: `${n(v.recoveredPowerMw, 2)} MW × 1,000 × ${fmtMetric(m.effectiveHours, lang)} h × ${n(v.smp)} ${smpU}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'shutdownLossKrw',
      label: x.shutdownLoss,
      formula: `${n(state.bp.outputMw, 1)} MW × 1,000 × ${n(v.shutdownDays, 1)} × 24 h × ${n(v.smp)} ${smpU}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'initialInvestmentKrw',
      label: x.investment,
      formula: `${n(v.cleaningCostKrw)} + ${fmtMetric(m.shutdownLossKrw, lang)} + ${n(v.additionalCostKrw)}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'netBenefitKrw',
      label: x.net,
      formula: `${fmtMetric(m.additionalRevenueKrw, lang)} − ${n(v.cleaningCostKrw)} − ${fmtMetric(m.shutdownLossKrw, lang)} − ${n(v.additionalCostKrw)}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'monthlyIncrementalBenefitKrw',
      label: x.monthly,
      formula: `${n(v.recoveredPowerMw, 2)} MW × 1,000 × ${n(v.operatingHours)} h × ${n(v.smp)} ${smpU}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'paybackMonths',
      label: x.payback,
      formula: `${fmtMetric(m.initialInvestmentKrw, lang)} ÷ ${fmtMetric(m.monthlyIncrementalBenefitKrw, lang)}`,
      digits: 2,
      unit: x.months,
    },
    {
      id: 'breakEvenDays',
      label: x.breakeven,
      formula: `${n(v.shutdownDays, 1)} + ${fmtMetric(m.initialInvestmentKrw, lang)} ÷ (${fmtMetric(m.monthlyIncrementalBenefitKrw, lang)} ÷ 30)`,
      digits: 1,
      unit: x.days,
    },
  ];

  const renderRows = (rows: Row[]) => (
    <ol className="calc-steps">
      {rows.map((row) => {
        const metric = m[row.id];
        return (
          <li key={row.id} className="calc-steps__row" data-metric={row.id}>
            <span className="calc-steps__label">{row.label}</span>
            <code className="calc-steps__formula">{row.formula}</code>
            <span className="calc-steps__value">
              {metric.status === 'ok' && metric.value !== null ? (
                <>
                  <strong className="num">{formatNumber(metric.value, lang, row.digits)}</strong>{' '}
                  <span className="calc-steps__unit">{row.unit}</span>
                </>
              ) : (
                <>
                  <strong className="num">—</strong>{' '}
                  {row.id === 'paybackMonths' && metric.status === 'invalid' && state.metrics.initialInvestmentKrw.status === 'ok' ? (
                    <span className="metric-tag metric-tag--invalid">{x.notPayback}</span>
                  ) : (
                    <MetricStatusTag state={state} id={row.id} lang={lang} />
                  )}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <Card
      id={SECTION_IDS.economics}
      title={c.resultTitle}
      subtitle={c.resultSubtitle}
      badges={<DataTypeBadges types={['example']} />}
    >
      <h4 className="calc-subhead">{x.bpTitle}</h4>
      {renderRows(bpRows)}
      <p className="note">{c.coeffNote}</p>

      <h4 className="calc-subhead">{x.ecoTitle}</h4>
      {renderRows(ecoRows)}
      <p className="note">{x.separate}</p>
      <p className="note">{x.noDouble}</p>

      <p className="note note--example">
        <DataTypeBadges types={['example']} /> {c.exampleNote}
      </p>
    </Card>
  );
}
