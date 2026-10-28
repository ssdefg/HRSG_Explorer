import type { Kpi, Localized } from '@/types';
import { KpiCard } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { STRINGS_CALC } from '@/i18n/calculatorStrings';
import { formatNumber } from '@/lib/format';
import type { CalculatorState } from '@/context/Workspace';
import type { MetricId } from '@/lib/calculatorModel';
import { LEVEL_STATUS, levelLabel } from './level';
import { METRIC_STATUS_TEXT, invalidReason } from './metricText';

/** 값이 없으면 NaN → KpiCard가 '—'로 표시 (이전 결과를 보여주지 않음) */
const orNaN = (v: number | null) => (v === null ? Number.NaN : v);

/** KPI 4종 — 중앙 계산 엔진의 같은 결과(state.metrics)를 쓰므로 게이지·차트·대시보드와 값이 일치한다. */
export function CalculatorKpis({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const { values, metrics } = state;
  const ko = STRINGS_CALC.ko;
  const en = STRINGS_CALC.en;
  const refText = values.referenceBp === null ? '—' : formatNumber(values.referenceBp, lang, 0);

  /** 산출 불가·모델 미연동이면 상태와 사유를, 아니면 기본 설명을 */
  const noteFor = (id: MetricId, ok: Localized): Localized => {
    const st = metrics[id].status;
    if (st === 'ok') return ok;
    return {
      ko: `${METRIC_STATUS_TEXT.ko[st]} — ${invalidReason(state, id, 'ko')}`,
      en: `${METRIC_STATUS_TEXT.en[st]} — ${invalidReason(state, id, 'en')}`,
    };
  };

  const kpis: Kpi[] = [
    {
      id: 'current-bp',
      label: { ko: ko.kpiCurrentBp, en: en.kpiCurrentBp },
      value: orNaN(values.currentBp),
      unit: 'mmH₂O',
      digits: 0,
      status: state.level ? LEVEL_STATUS[state.level] : undefined,
      statusLabel: state.level ? { ko: levelLabel(state.level, ko), en: levelLabel(state.level, en) } : undefined,
      note:
        values.currentBp === null
          ? { ko: `${METRIC_STATUS_TEXT.ko.invalid} — ${ko.invalidInput}`, en: `${METRIC_STATUS_TEXT.en.invalid} — ${en.invalidInput}` }
          : { ko: ko.kpiCurrentBpNote, en: en.kpiCurrentBpNote },
      dataTypes: [state.mode === 'user' && state.edited.currentBp ? 'userInput' : 'mock', 'unconfirmed'],
    },
    {
      id: 'delta-bp',
      label: { ko: ko.kpiDeltaBp, en: en.kpiDeltaBp },
      value: orNaN(metrics.deltaBp.value),
      unit: 'mmH₂O',
      digits: 0,
      note: noteFor('deltaBp', { ko: ko.kpiDeltaBpNote(refText), en: en.kpiDeltaBpNote(refText) }),
      dataTypes: ['example'],
    },
    {
      id: 'power-loss',
      label: { ko: ko.kpiPowerLoss, en: en.kpiPowerLoss },
      value: orNaN(metrics.powerLossMw.value),
      unit: 'MW',
      digits: 2,
      note: noteFor('powerLossMw', { ko: ko.kpiPowerLossNote, en: en.kpiPowerLossNote }),
      dataTypes: metrics.powerLossMw.status === 'model' ? ['planned'] : ['example'],
    },
    {
      id: 'monthly-loss',
      label: { ko: ko.kpiMonthlyLoss, en: en.kpiMonthlyLoss },
      value: orNaN(metrics.monthlyLossKrw.value),
      unit: { ko: ko.won, en: en.won },
      digits: 0,
      note: noteFor('monthlyLossKrw', { ko: ko.exampleNote, en: en.exampleNote }),
      dataTypes: metrics.monthlyLossKrw.status === 'model' ? ['planned'] : ['example'],
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
