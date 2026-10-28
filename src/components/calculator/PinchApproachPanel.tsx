import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import type { ParsedValues } from '@/lib/calculatorModel';
import { INPUT_DEF, type NumericInputId } from '@/data/calculatorInputs';

const PINCH_INPUTS: NumericInputId[] = ['drumPressure', 'econOutletWaterTemp', 'evapOutletGasTemp', 'designPinch', 'designApproach'];

/**
 * Pinch/Approach 분석 패널.
 * 계산 기준(포화온도 산정, 설계 기준값)이 확정되지 않았으므로 수치를 산출하지 않고 '분석 대기'를 표시한다.
 */
export function PinchApproachPanel({ values }: { values: ParsedValues }) {
  const { lang } = useAppSettings();
  const c = useCalcText();

  return (
    <Card title={c.pinchTitle} subtitle={c.pinchSubtitle} badges={<DataTypeBadges types={['unconfirmed', 'noMeasured']} />}>
      <div className="pending-state" role="status">
        <span className="pending-state__icon" aria-hidden="true">
          ⏸
        </span>
        <div>
          <p className="pending-state__title">{c.pinchWaiting}</p>
          <p className="pending-state__desc">{c.pinchWaitingDesc}</p>
        </div>
      </div>

      <ul className="kv-list">
        {PINCH_INPUTS.map((id) => {
          const d = INPUT_DEF[id];
          const v = values[id];
          return (
            <li key={id} className="kv-list__row">
              <span className="kv-list__key">{d.label[lang]}</span>
              <span className="kv-list__val">
                <strong className="num">{v === null ? '—' : formatNumber(v, lang, d.digits)}</strong>{' '}
                <small>{pick(d.unit, lang)}</small>
              </span>
              <span className="kv-list__meta">
                {v === null && d.optional ? (
                  <>
                    <DataTypeBadges types={['unconfirmed']} />
                    <span className="kv-list__hint">{lang === 'ko' ? '설계값 미입력 (선택 입력)' : 'Design value not entered (optional)'}</span>
                  </>
                ) : (
                  <>
                    <DataTypeBadges types={d.optional ? ['unconfirmed'] : ['mock']} />
                    <span className="kv-list__hint">{c.mockEntered}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="defs">
        <p className="defs__title">{c.pinchDefsTitle}</p>
        <p className="defs__item">{c.pinchDef}</p>
        <p className="defs__item">{c.approachDef}</p>
      </div>

      <div className="needs">
        <p className="needs__title">{c.pinchNeeds}</p>
        <ul className="needs__list">
          {c.pinchNeedsList.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
