import { Card, DataTypeBadges, SegmentedToggle } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import type { CalculatorState, InputErrorReason } from '@/lib/useCalculatorState';
import {
  HRSG_CLASSES,
  INPUT_GROUP_LABEL,
  NUMERIC_INPUTS,
  type HrsgClass,
  type InputGroup,
  type NumericInputDef,
} from '@/data/calculatorInputs';

const GROUPS: InputGroup[] = ['unit', 'backpressure', 'economics', 'pinch'];

export function CalculatorInputs({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const cls = HRSG_CLASSES.find((x) => x.value === state.hrsgClass) ?? HRSG_CLASSES[0];

  const errorText = (d: NumericInputDef, reason: InputErrorReason): string => {
    const fmt = (n: number) => formatNumber(n, lang, d.digits);
    switch (reason) {
      case 'empty':
        return c.errEmpty;
      case 'nan':
        return c.errNan;
      case 'min':
        return d.min === 0 ? c.errNegative : c.errMin(fmt(d.min));
      case 'max':
        return c.errMax(fmt(d.max));
    }
  };

  return (
    <Card
      className="calc-inputs"
      title={c.inputsTitle}
      subtitle={c.inputsSubtitle}
      badges={<DataTypeBadges types={['mock']} />}
    >
      <form className="calc-form" onSubmit={(e) => e.preventDefault()} noValidate>
        {state.errorCount > 0 && (
          <p className="calc-form__summary" role="alert">
            {c.errorSummary(state.errorCount)}
          </p>
        )}

        {GROUPS.map((g) => (
          <fieldset key={g} className="calc-form__group">
            <legend className="calc-form__legend">{INPUT_GROUP_LABEL[g][lang]}</legend>

            {g === 'unit' && (
              <div className="field">
                <span className="field__label" id="hrsg-class-label">
                  {c.hrsgClass}
                </span>
                <SegmentedToggle<HrsgClass>
                  className="seg--light"
                  label={c.hrsgClass}
                  value={state.hrsgClass}
                  onChange={state.setHrsgClass}
                  options={HRSG_CLASSES.map((x) => ({ value: x.value, label: x.label }))}
                />
                <span className="field__hint">{c.classCapacityNote(cls.demoCapacityMw)}</span>
              </div>
            )}

            {NUMERIC_INPUTS.filter((d) => d.group === g).map((d) => {
              const err = state.errors[d.id];
              const id = `in-${d.id}`;
              const hintId = `${id}-hint`;
              return (
                <div key={d.id} className={`field${err ? ' field--error' : ''}`}>
                  <label className="field__label" htmlFor={id}>
                    {d.label[lang]}
                  </label>
                  <div className="field__control">
                    <input
                      id={id}
                      className="field__input num"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={state.raw[d.id]}
                      onChange={(e) => state.setRaw(d.id, e.target.value)}
                      aria-invalid={err ? true : undefined}
                      aria-describedby={hintId}
                    />
                    <span className="field__unit">{pick(d.unit, lang)}</span>
                  </div>
                  <span id={hintId} className={err ? 'field__error' : 'field__hint'}>
                    {err
                      ? errorText(d, err)
                      : c.range(formatNumber(d.min, lang, d.digits), formatNumber(d.max, lang, d.digits))}
                  </span>
                </div>
              );
            })}
          </fieldset>
        ))}

        <button type="button" className="btn btn--ghost" onClick={state.reset}>
          {c.reset}
        </button>
      </form>
    </Card>
  );
}
