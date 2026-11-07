import { Card, DataTypeBadges, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import type { CalculatorState } from '@/context/Workspace';
import { INPUT_DEF, type NumericInputId } from '@/data/calculatorInputs';
import { KIT_CALC_DATA } from '@/lib/kit';

const PINCH_INPUTS: NumericInputId[] = ['drumPressure', 'econOutletWaterTemp', 'evapOutletGasTemp', 'designPinch', 'designApproach'];

const TXT = {
  ko: {
    sub: 'IAPWS-IF97 포화온도 (키트 pinchSection) · 예시 계산',
    tsat: '드럼 압력 기준 포화온도 Tsat',
    pinch: 'Pinch = T_eva,gas,out − Tsat',
    approach: 'Approach = Tsat − T_eco,water,out',
    level: { normal: '정상', caution: '주의', danger: '위험', no_data: '데이터 필요' },
    criteria: (design: string, margin: number) => `설계값 ${design} °C · 허용 ±${margin} °C`,
    none: '데이터 필요 — 드럼 압력·온도 입력 확인',
    inputs: '분석 입력값',
  },
  en: {
    sub: 'IAPWS-IF97 saturation temperature (kit pinchSection) · example calc',
    tsat: 'Saturation temp. at drum pressure Tsat',
    pinch: 'Pinch = T_eva,gas,out − Tsat',
    approach: 'Approach = Tsat − T_eco,water,out',
    level: { normal: 'Normal', caution: 'Caution', danger: 'Danger', no_data: 'Data needed' },
    criteria: (design: string, margin: number) => `Design ${design} °C · tolerance ±${margin} °C`,
    none: 'Data needed — check drum pressure / temperatures',
    inputs: 'Analysis inputs',
  },
};

/** Pinch/Approach 분석 — 가이드 §2.3 식 5 (IAPWS-IF97 Region 4 포화선) */
export function PinchApproachPanel({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const x = TXT[lang];
  const { values, pinch } = state;
  const f1 = (v: number | null) => (v === null ? '—' : formatNumber(v, lang, 1));

  const rows: { key: string; label: string; value: number | null; design: number }[] = [
    { key: 'pinch', label: x.pinch, value: pinch.pinchC, design: pinch.design.pinch_c },
    { key: 'approach', label: x.approach, value: pinch.approachC, design: pinch.design.approach_c },
  ];
  const tone = pinch.level === 'no_data' ? null : pinch.level === 'danger' ? 'warning' : pinch.level;

  return (
    <Card title={c.pinchTitle} subtitle={x.sub} badges={<DataTypeBadges types={['example', 'mock']} />}>
      <ul className="kv-list">
        <li className="kv-list__row">
          <span className="kv-list__key">{x.tsat}</span>
          <span className="kv-list__val">
            <strong className="num" data-testid="tsat">{f1(pinch.tSatC)}</strong> <small>°C</small>
          </span>
          <span className="kv-list__meta">
            <DataTypeBadges types={['literature']} />
          </span>
        </li>
        {rows.map((r) => (
          <li key={r.key} className="kv-list__row" data-metric={r.key}>
            <span className="kv-list__key">{r.label}</span>
            <span className="kv-list__val">
              <strong className="num" data-testid={`${r.key}-value`}>{f1(r.value)}</strong> <small>°C</small>
            </span>
            <span className="kv-list__meta">
              {r.value === null || !tone ? (
                <DataTypeBadges types={['notComputable']} />
              ) : (
                <StatusBadge status={tone} label={x.level[pinch.level]} />
              )}
              <span className="kv-list__hint">{r.value === null ? x.none : x.criteria(f1(r.design), KIT_CALC_DATA.constants.pinch_margin_c)}</span>
            </span>
          </li>
        ))}
        <li className="kv-list__row">
          <span className="kv-list__key" data-testid="pinch-message">{pinch.message}</span>
        </li>
      </ul>

      <details className="fold">
        <summary className="fold__summary">{x.inputs}</summary>
        <ul className="kv-list">
          {PINCH_INPUTS.map((id) => {
            const d = INPUT_DEF[id];
            const v = values[id];
            return (
              <li key={id} className="kv-list__row">
                <span className="kv-list__key">{d.label[lang]}</span>
                <span className="kv-list__val">
                  <strong className="num">{v === null ? '—' : formatNumber(v, lang, d.digits)}</strong> <small>{pick(d.unit, lang)}</small>
                </span>
                <span className="kv-list__meta">
                  <DataTypeBadges types={d.optional ? ['unconfirmed'] : ['mock']} />
                </span>
              </li>
            );
          })}
        </ul>
      </details>

      <details className="fold">
        <summary className="fold__summary">{c.pinchNeeds}</summary>
        <div className="needs">
          <ul className="needs__list">
            {c.pinchNeedsList.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </details>
    </Card>
  );
}
