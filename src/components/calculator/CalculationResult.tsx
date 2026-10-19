import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import { POWER_LOSS_COEFF_MW_PER_MMH2O } from '@/lib/calc';
import type { CalculatorState } from '@/lib/useCalculatorState';

/** 계산 엔진의 각 단계를 실제 대입값과 함께 보여준다 — 검증 가능성 확보 */
export function CalculationResult({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const { values: v, result: r } = state;
  const n = (x: number | null, d = 0) => (x === null ? '—' : formatNumber(x, lang, d));

  const rows = [
    {
      key: 'delta',
      label: c.stepDelta,
      formula: `max(0, ${n(v.currentBp)} − ${n(v.referenceBp)})`,
      value: r.deltaBp === null ? null : n(r.deltaBp, 0),
      unit: 'mmH₂O',
    },
    {
      key: 'power',
      label: c.stepPower,
      formula: `${n(r.deltaBp)} × ${POWER_LOSS_COEFF_MW_PER_MMH2O}`,
      value: r.powerLossMw === null ? null : n(r.powerLossMw, 2),
      unit: 'MW',
    },
    {
      key: 'monthly',
      label: c.stepMonthly,
      formula: `${n(r.powerLossMw, 2)} × 1,000 × ${n(v.operatingHours)} h × ${n(v.smp)} ${lang === 'ko' ? '원/kWh' : 'KRW/kWh'}`,
      value: r.monthlyLossKrw === null ? null : n(r.monthlyLossKrw, 0),
      unit: c.won,
    },
  ];

  return (
    <Card title={c.resultTitle} subtitle={c.resultSubtitle} badges={<DataTypeBadges types={['example']} />}>
      <ol className="calc-steps">
        {rows.map((row) => (
          <li key={row.key} className="calc-steps__row">
            <span className="calc-steps__label">{row.label}</span>
            <code className="calc-steps__formula">{row.formula}</code>
            <span className="calc-steps__value">
              {row.value === null ? (
                <span className="calc-steps__pending">{c.stepPending}</span>
              ) : (
                <>
                  <strong className="num">{row.value}</strong> <span className="calc-steps__unit">{row.unit}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="note note--example">
        <DataTypeBadges types={['example']} /> {c.exampleNote}
      </p>
      <p className="note">{c.coeffNote}</p>
    </Card>
  );
}
