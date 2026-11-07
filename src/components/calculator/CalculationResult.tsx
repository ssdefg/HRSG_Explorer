import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { KIT_CALC_DATA } from '@/lib/kit';
import { kitClass } from '@/lib/calc_adapter';
import type { CalculatorState } from '@/context/Workspace';
import type { MetricId } from '@/lib/calculatorModel';
import { SECTION_IDS } from '@/data/tabs';
import { MetricStatusTag, fmtMetric } from './metricText';

const K = KIT_CALC_DATA.constants;

const TXT = {
  ko: {
    bpTitle: '출력 손실 (키트 계산식 · 예시 계산)',
    ecoTitle: '세정 경제성 (키트 공법 비교 · 예시 계산)',
    excess: '초과 압력 (GT 배압·HRSG 차압 중 큰 값)',
    gtLoss: 'GT 손실',
    stLoss: 'ST 손실 (스택 온도 초과)',
    totalLoss: '발전 출력 손실',
    monthlyLoss: '월간 발전 손실액',
    recovered: '세정 예상 회수 출력',
    shutdownLoss: `정지 손실 (마진 ${K.outage_margin_ratio * 100} %)`,
    investment: '총투자 (세정 비용 + 간접 비용 + 정지 손실)',
    net: '첫 달 순편익 (월간 편익 − 총투자)',
    monthly: '월간 추가 편익',
    payback: '투자 회수기간',
    breakeven: '손익분기 일수 (회수기간 × 월간 가동시간 ÷ 24)',
    months: '개월',
    days: '일',
    notPayback: '회수 불가',
    method: (name: string) => `기준 공법: ${name} — 회수기간이 가장 짧은 공법 (가정 기준, 추천 아님)`,
    noMethod: '산출 가능한 공법이 없습니다.',
    basisTitle: '단계별 산식 및 계산 근거',
    separate:
      '회수 출력은 공법 회수율만큼 세 지표(GT 배압·HRSG 차압·스택 온도)의 설계 초과분이 줄어든 뒤의 손실 감소분입니다. 회수율이 없는 공법만 목표 회수 출력을 씁니다.',
    noDouble: '초과 압력은 GT 배압과 HRSG 차압 중 더 큰 초과분 하나만 씁니다(이중 계산 방지). 일회성 비용은 총투자에만 넣습니다.',
    source: '계산식·상수: hrsg_calc_kit_team1 (common-0.2) — src/lib/calc_adapter.ts 를 거쳐 계산',
  },
  en: {
    bpTitle: 'Power loss (kit formulas · example calc)',
    ecoTitle: 'Cleaning economics (kit method comparison · example calc)',
    excess: 'Excess pressure (max of GT BP / HRSG ΔP)',
    gtLoss: 'GT loss',
    stLoss: 'ST loss (stack temperature excess)',
    totalLoss: 'Power output loss',
    monthlyLoss: 'Monthly generation loss',
    recovered: 'Expected recovered output',
    shutdownLoss: `Outage loss (margin ${K.outage_margin_ratio * 100} %)`,
    investment: 'Total investment (cleaning + indirect + outage loss)',
    net: 'First-month net (monthly benefit − investment)',
    monthly: 'Monthly added benefit',
    payback: 'Payback',
    breakeven: 'Break-even days (payback × monthly hours ÷ 24)',
    months: 'months',
    days: 'd',
    notPayback: 'No payback',
    method: (name: string) => `Basis method: ${name} — shortest payback (assumption, not a recommendation)`,
    noMethod: 'No method can be computed.',
    basisTitle: 'Step-by-step formulas & calculation basis',
    separate:
      'Recovered output is the loss reduction after each indicator excess (GT BP, HRSG ΔP, stack) shrinks by the method recovery ratio. Only methods without a ratio use the target recovered output.',
    noDouble: 'Only the larger of the GT BP and HRSG ΔP excesses is used (no double counting). One-off costs go into total investment only.',
    source: 'Formulas & constants: hrsg_calc_kit_team1 (common-0.2), via src/lib/calc_adapter.ts',
  },
};

interface Row {
  id: MetricId;
  label: string;
  formula: string;
  digits: number;
  unit: string;
}

/** 키트 계산의 각 단계를 실제 대입값과 함께 보여준다 — 검증 가능성 확보 */
export function CalculationResult({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const x = TXT[lang];
  const { values: v, metrics: m } = state;
  const n = (val: number | null | undefined, d = 0) => (val === null || val === undefined ? '—' : formatNumber(val, lang, d));
  const won = c.won;
  const r = state.kit.result;
  const ind = r?.indicators;
  const best = state.kit.methods.find((row) => row.id === state.kit.bestPaybackId);
  const stRated = kitClass(state.hrsgClass).rated_st_mw;
  const pricePerMwh = v.smp === null ? null : v.smp * 1000;
  const priceU = lang === 'ko' ? '원/MWh' : 'KRW/MWh';

  const bpRows: Row[] = [
    {
      id: 'deltaBp',
      label: x.excess,
      formula: `max(0, ${n(ind?.hrsg_dp_mbar.value, 1)} − ${n(ind?.hrsg_dp_mbar.design, 1)}, ${n(ind?.gt_bp_mbar.value, 2)} − ${n(ind?.gt_bp_mbar.design, 2)}) mbar = ${n(r?.excess_pressure.mbar, 2)} mbar`,
      digits: 1,
      unit: 'mmH₂O',
    },
    {
      id: 'gtLossMw',
      label: x.gtLoss,
      formula: `${n(v.capacityMw, 0)} MW × ${K.gt_loss_pct_per_mbar} %/mbar × ${n(r?.excess_pressure.mbar, 2)} mbar × ${n(v.loadPct, 0)} %`,
      digits: 3,
      unit: 'MW',
    },
    {
      id: 'stLossMw',
      label: x.stLoss,
      formula: `${n(stRated, 0)} MW × ${K.st_loss_pct_per_c} %/°C × ${n(r?.excess_stack_c, 1)} °C × ${n(v.loadPct, 0)} %`,
      digits: 3,
      unit: 'MW',
    },
    { id: 'powerLossMw', label: x.totalLoss, formula: `${fmtMetric(m.gtLossMw, lang, 3)} + ${fmtMetric(m.stLossMw, lang, 3)}`, digits: 2, unit: 'MW' },
    {
      id: 'monthlyLossKrw',
      label: x.monthlyLoss,
      formula: `${fmtMetric(m.powerLossMw, lang, 3)} MW × ${n(v.operatingHours)} h × ${n(pricePerMwh)} ${priceU}`,
      digits: 0,
      unit: won,
    },
  ];

  const ecoRows: Row[] = [
    {
      id: 'recoveredMw',
      label: x.recovered,
      formula:
        best?.recovery_basis === 'ratio'
          ? `${lang === 'ko' ? '현재 손실 − 회수율' : 'loss now − loss after ratio'} ${n((best.recovery_ratio ?? 0) * 100, 0)} % ${lang === 'ko' ? '적용 후 손실' : ''}`
          : best?.recovery_basis === 'target'
            ? `${lang === 'ko' ? '목표 회수 출력' : 'target recovered'} ${n(v.recoveredPowerMw, 2)} MW`
            : '—',
      digits: 2,
      unit: 'MW',
    },
    {
      id: 'shutdownLossKrw',
      label: x.shutdownLoss,
      formula: `(${n(v.capacityMw, 0)} + ${n(stRated, 0)}) MW × ${n(v.loadPct, 0)} % × ${n(best?.outage_days)} × 24 h × ${n(pricePerMwh)} ${priceU} × ${K.outage_margin_ratio}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'initialInvestmentKrw',
      label: x.investment,
      formula: `${n(best?.cost_krw)} + ${n(best?.indirect_krw)} + ${fmtMetric(m.shutdownLossKrw, lang)}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'monthlyIncrementalBenefitKrw',
      label: x.monthly,
      formula: `${fmtMetric(m.recoveredMw, lang, 3)} MW × ${n(v.operatingHours)} h × ${n(pricePerMwh)} ${priceU}`,
      digits: 0,
      unit: won,
    },
    {
      id: 'netBenefitKrw',
      label: x.net,
      formula: `${fmtMetric(m.monthlyIncrementalBenefitKrw, lang)} − ${fmtMetric(m.initialInvestmentKrw, lang)}`,
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
      formula: `${fmtMetric(m.paybackMonths, lang, 2)} × ${n(v.operatingHours)} h ÷ 24`,
      digits: 1,
      unit: x.days,
    },
  ];

  // 결과 값 목록 (라벨 + 값) — 대입 산식은 아래 접힘 영역(renderFormulas)에 둔다
  const renderRows = (rows: Row[]) => (
    <ol className="calc-steps">
      {rows.map((row) => {
        const metric = m[row.id];
        return (
          <li key={row.id} className="calc-steps__row" data-metric={row.id}>
            <span className="calc-steps__label">{row.label}</span>
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

  const renderFormulas = (rows: Row[]) => (
    <ol className="calc-steps calc-steps--formulas">
      {rows.map((row) => (
        <li key={row.id} className="calc-steps__row">
          <span className="calc-steps__label">{row.label}</span>
          <code className="calc-steps__formula">{row.formula}</code>
        </li>
      ))}
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

      <h4 className="calc-subhead">{x.ecoTitle}</h4>
      <p className="note" data-testid="basis-method">
        {best ? x.method(best.name) : x.noMethod}
      </p>
      {renderRows(ecoRows)}

      {/* 계산 근거 — 대입 산식과 유의사항 (기본 접힘) */}
      <details className="fold">
        <summary className="fold__summary">{x.basisTitle}</summary>
        <div className="fold__body">
          <h4 className="calc-subhead">{x.bpTitle}</h4>
          {renderFormulas(bpRows)}
          <p className="note">{c.coeffNote}</p>
          <h4 className="calc-subhead">{x.ecoTitle}</h4>
          {renderFormulas(ecoRows)}
          <p className="note">{x.separate}</p>
          <p className="note">{x.noDouble}</p>
          <p className="note">{x.source}</p>
        </div>
      </details>

      <p className="note note--example">
        <DataTypeBadges types={['example']} /> {c.exampleNote}
      </p>
    </Card>
  );
}
