import type { Kpi } from '@/types';
import { KpiCard } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { STRINGS_CALC } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import type { CalculatorState } from '@/lib/useCalculatorState';
import { LEVEL_STATUS, levelLabel } from './level';

/** 값이 없으면(입력 오류) NaN → KpiCard가 '—'로 표시 */
const orNaN = (v: number | null) => (v === null ? Number.NaN : v);

/** KPI 4종 — 모두 같은 계산 결과(state.result)에서 파생되어 게이지·차트와 값이 일치한다. */
export function CalculatorKpis({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const { values, result } = state;
  const ko = STRINGS_CALC.ko;
  const en = STRINGS_CALC.en;
  const invalid = { ko: ko.invalidInput, en: en.invalidInput };
  const refText = values.referenceBp === null ? '—' : formatNumber(values.referenceBp, lang, 0);

  const kpis: Kpi[] = [
    {
      id: 'current-bp',
      label: { ko: ko.kpiCurrentBp, en: en.kpiCurrentBp },
      value: orNaN(values.currentBp),
      unit: 'mmH₂O',
      digits: 0,
      status: result.level ? LEVEL_STATUS[result.level] : undefined,
      statusLabel: result.level ? { ko: levelLabel(result.level, ko), en: levelLabel(result.level, en) } : undefined,
      note: values.currentBp === null ? invalid : { ko: ko.kpiCurrentBpNote, en: en.kpiCurrentBpNote },
      dataTypes: ['mock', 'unconfirmed'],
    },
    {
      id: 'delta-bp',
      label: { ko: ko.kpiDeltaBp, en: en.kpiDeltaBp },
      value: orNaN(result.deltaBp),
      unit: 'mmH₂O',
      digits: 0,
      note: result.deltaBp === null ? invalid : { ko: ko.kpiDeltaBpNote(refText), en: en.kpiDeltaBpNote(refText) },
      dataTypes: ['mock'],
    },
    {
      id: 'power-loss',
      label: { ko: ko.kpiPowerLoss, en: en.kpiPowerLoss },
      value: orNaN(result.powerLossMw),
      unit: 'MW',
      digits: 2,
      note: result.powerLossMw === null ? invalid : { ko: ko.kpiPowerLossNote, en: en.kpiPowerLossNote },
      dataTypes: ['example'],
    },
    {
      id: 'monthly-loss',
      label: { ko: ko.kpiMonthlyLoss, en: en.kpiMonthlyLoss },
      value: orNaN(result.monthlyLossKrw),
      unit: { ko: ko.won, en: en.won },
      digits: 0,
      note: result.monthlyLossKrw === null ? invalid : { ko: ko.exampleNote, en: en.exampleNote },
      dataTypes: ['example'],
    },
  ];

  return (
    <div className="kpi-grid" aria-live="polite">
      {kpis.map((k) => (
        <KpiCard key={k.id} kpi={k} />
      ))}
    </div>
  );
}
