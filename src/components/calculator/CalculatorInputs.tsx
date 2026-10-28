import { Card, DataTypeBadges, SegmentedToggle } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import type { CalculatorState } from '@/context/Workspace';
import type { InputErrorReason } from '@/lib/calculatorModel';
import {
  HRSG_CLASSES,
  INPUT_GROUPS,
  INPUT_GROUP_LABEL,
  NUMERIC_INPUTS,
  hrsgClassDef,
  type HrsgClass,
  type NumericInputDef,
} from '@/data/calculatorInputs';
import { fmtMetric } from './metricText';

const TXT = {
  ko: {
    required: '필수 입력입니다.',
    optionalEmpty: '미입력 (선택)',
    srcDemo: 'DEMO 기본값',
    srcEdited: '수정됨 · 가상값',
    srcUser: '사용자 입력',
    model: '가상 가스터빈 모델',
    modelNote: '가상 모델명 — 실제 제조사·발전소 설비 사양이 아님',
    effective: '세정 후 유효 가동시간 (파생값)',
    effectiveNote: '월간 가동시간 − 정지일수 × 24 h · 별도 입력란을 두지 않음',
  },
  en: {
    required: 'Required.',
    optionalEmpty: 'Not entered (optional)',
    srcDemo: 'DEMO default',
    srcEdited: 'Edited · mock value',
    srcUser: 'User input',
    model: 'Mock gas turbine model',
    modelNote: 'Mock model name — not a real manufacturer or plant specification',
    effective: 'Effective operating hours after cleaning (derived)',
    effectiveNote: 'Monthly hours − shutdown days × 24 h · no separate input',
  },
};

export function CalculatorInputs({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const x = TXT[lang];
  const cls = hrsgClassDef(state.hrsgClass);
  const errorCount = state.errorIds.length;

  const errorText = (d: NumericInputDef, reason: InputErrorReason): string => {
    const fmt = (n: number) => formatNumber(n, lang, d.digits);
    switch (reason) {
      case 'empty':
        return x.required;
      case 'nan':
        return c.errNan;
      case 'min':
        return d.min === 0 ? c.errNegative : c.errMin(fmt(d.min));
      case 'max':
        return c.errMax(fmt(d.max));
    }
  };

  const sourceTag = (d: NumericInputDef) => {
    if (d.optional && (state.raw[d.id] ?? '').trim() === '') return <span className="src-tag src-tag--empty">{x.optionalEmpty}</span>;
    if (!state.edited[d.id]) return <span className="src-tag">{x.srcDemo}</span>;
    return state.mode === 'user' ? <span className="src-tag src-tag--user">{x.srcUser}</span> : <span className="src-tag">{x.srcEdited}</span>;
  };

  return (
    <Card
      className="calc-inputs"
      title={c.inputsTitle}
      subtitle={c.inputsSubtitle}
      badges={<DataTypeBadges types={state.mode === 'user' ? ['userInput', 'mock'] : ['mock']} />}
    >
      <form className="calc-form" onSubmit={(e) => e.preventDefault()} noValidate>
        {errorCount > 0 && (
          <p className="calc-form__summary" role="alert">
            {c.errorSummary(errorCount)}
          </p>
        )}

        {INPUT_GROUPS.map((g) => (
          <fieldset key={g} className="calc-form__group">
            <legend className="calc-form__legend">{INPUT_GROUP_LABEL[g][lang]}</legend>

            {g === 'equipment' && (
              <div className="field">
                <span className="field__label" id="hrsg-class-label">
                  {c.hrsgClass}
                </span>
                <SegmentedToggle<HrsgClass>
                  className="seg--light"
                  label={c.hrsgClass}
                  value={state.hrsgClass}
                  onChange={state.setHrsgClass}
                  options={HRSG_CLASSES.map((h) => ({ value: h.value, label: `${h.label} / ${h.demoCapacityMw} MW` }))}
                />
                <span className="field__hint">{c.classCapacityNote(cls.demoCapacityMw)}</span>
                <span className="model-line">
                  {x.model}: <strong data-testid="gt-model">{cls.demoModel}</strong> <DataTypeBadges types={['mock']} />
                </span>
                <span className="field__hint">{x.modelNote}</span>
              </div>
            )}

            {NUMERIC_INPUTS.filter((d) => d.group === g).map((d) => {
              const err = state.errors[d.id];
              const id = `in-${d.id}`;
              const hintId = `${id}-hint`;
              return (
                <div key={d.id} className={`field${err ? ' field--error' : ''}`}>
                  <div className="field__label-row">
                    <label className="field__label" htmlFor={id}>
                      {d.label[lang]}
                    </label>
                    {sourceTag(d)}
                  </div>
                  <div className="field__control">
                    <input
                      id={id}
                      className="field__input num"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={state.raw[d.id] ?? ''}
                      placeholder={d.optional ? x.optionalEmpty : undefined}
                      onChange={(e) => state.setRaw(d.id, e.target.value)}
                      aria-invalid={err ? true : undefined}
                      aria-required={d.optional ? undefined : true}
                      aria-describedby={hintId}
                    />
                    <span className="field__unit">{pick(d.unit, lang)}</span>
                  </div>
                  <span id={hintId} className={err ? 'field__error' : 'field__hint'}>
                    {err
                      ? errorText(d, err)
                      : `${c.range(formatNumber(d.min, lang, d.digits), formatNumber(d.max, lang, d.digits))}${d.hint ? ` · ${d.hint[lang]}` : ''}`}
                  </span>
                </div>
              );
            })}

            {g === 'economics' && (
              <div className="field field--derived">
                <span className="field__label">{x.effective}</span>
                <div className="field__control field__control--readonly" aria-live="polite">
                  <output className="field__input num" data-testid="effective-hours">
                    {fmtMetric(state.metrics.effectiveHours, lang)}
                  </output>
                  <span className="field__unit">h</span>
                </div>
                <span className="field__hint">{x.effectiveNote}</span>
              </div>
            )}
          </fieldset>
        ))}

        <button type="button" className="btn btn--ghost" onClick={state.reset}>
          {c.reset}
        </button>
      </form>
    </Card>
  );
}
