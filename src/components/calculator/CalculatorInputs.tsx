import { useRef } from 'react';
import { Card, DataTypeBadges, SegmentedToggle } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { formatNumber, pick } from '@/lib/format';
import { parseNumericInput } from '@/lib/number';
import { useToast, type CalculatorState } from '@/context/Workspace';
import type { InputErrorReason } from '@/lib/calculatorModel';
import {
  HRSG_CLASSES,
  INPUT_GROUPS,
  INPUT_GROUP_LABEL,
  LOAD_CLAMP,
  NUMERIC_INPUTS,
  UNIT_SYSTEMS,
  hrsgClassDef,
  unitDef,
  type HrsgClass,
  type NumericInputDef,
  type NumericInputId,
} from '@/data/calculatorInputs';

const TXT = {
  ko: {
    required: '필수 입력입니다.',
    optionalEmpty: '미입력 (선택)',
    srcDemo: 'DEMO 기본값',
    srcEdited: '수정됨 · 가상값',
    srcUser: '사용자 입력',
    model: '가상 가스터빈 모델',
    modelNote: '가상 모델명 — 실제 제조사·발전소 설비 사양이 아님',
    kitMethods: '세정비용·정지일수·간접 비용은 키트의 드라이아이스 세정에 연결됩니다. 기계식·고압수·화학 세정은 키트 데이터 값을 그대로 씁니다 (DEMO).',
    unit: '단위',
    negative: '음수는 입력할 수 없습니다.',
    restored: (label: string) => `${label}: 음수는 입력할 수 없습니다 — 직전 유효값으로 복원했습니다.`,
    loadRange: '운전 부하율 허용 범위를 초과했습니다.',
    loadClamped: (v: string) => `운전 부하율 허용 범위를 초과했습니다 — ${v} %로 보정했습니다.`,
    integer: '정수를 입력하세요.',
    bpBelow: '현재 배압은 기준 배압 이상이어야 합니다. 차압(초과분)은 0으로 연산합니다.',
    stackSafety: '스택 온도 안전 한계 초과 (트립 위험)',
  },
  en: {
    required: 'Required.',
    optionalEmpty: 'Not entered (optional)',
    srcDemo: 'DEMO default',
    srcEdited: 'Edited · mock value',
    srcUser: 'User input',
    model: 'Mock gas turbine model',
    modelNote: 'Mock model name — not a real manufacturer or plant specification',
    kitMethods: 'Cleaning cost, outage days and indirect cost feed the kit dry-ice method. Mechanical, water and chemical methods use kit data as-is (DEMO).',
    unit: 'Unit',
    negative: 'Negative values are not allowed.',
    restored: (label: string) => `${label}: negative values are not allowed — restored the last valid value.`,
    loadRange: 'Load factor is outside the allowed range.',
    loadClamped: (v: string) => `Load factor is outside the allowed range — clamped to ${v} %.`,
    integer: 'Enter a whole number.',
    bpBelow: 'Current back pressure must be at or above the baseline. Excess (ΔBP) is computed as 0.',
    stackSafety: 'Stack temperature above safety limit (trip risk)',
  },
};

export function CalculatorInputs({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const c = useCalcText();
  const x = TXT[lang];
  const toast = useToast();
  const cls = hrsgClassDef(state.hrsgClass);
  const errorCount = state.errorIds.length;
  // 입력란별 직전 유효 원문 — 음수 입력 시 복원용 (가이드 §3.1 폴백)
  const lastValid = useRef<Partial<Record<NumericInputId, string>>>({});
  for (const d of NUMERIC_INPUTS) if (state.errors[d.id] === null) lastValid.current[d.id] = state.raw[d.id];

  const unitOf = (d: NumericInputDef) => (d.unitKind ? unitDef(d.unitKind, state.units[d.id]) : null);
  /** 기준 단위 범위를 선택 단위로 표시 */
  const shown = (d: NumericInputDef, base: number) => {
    const u = unitOf(d);
    return formatNumber(u ? u.fromBase(base) : base, lang, d.digits);
  };

  const errorText = (d: NumericInputDef, reason: InputErrorReason): string => {
    if (d.id === 'loadPct' && (reason === 'min' || reason === 'max')) return x.loadRange;
    switch (reason) {
      case 'empty':
      case 'nan':
        return c.errNan;
      case 'negative':
        return x.negative;
      case 'integer':
        return x.integer;
      case 'safety':
        return x.stackSafety;
      case 'min':
        return c.errMin(shown(d, d.min));
      case 'max':
        return c.errMax(shown(d, d.max));
    }
  };

  /** 포커스를 벗어날 때의 폴백 — 음수는 직전 유효값 복원, 부하율은 30/110 %로 클램핑 */
  const onBlur = (d: NumericInputDef) => {
    const reason = state.errors[d.id];
    if (reason === 'negative') {
      state.setRaw(d.id, lastValid.current[d.id] ?? '0');
      toast.push(x.restored(d.label[lang]), 'error');
      return;
    }
    if (d.id === 'loadPct' && (reason === 'min' || reason === 'max')) {
      const r = parseNumericInput(state.raw[d.id] ?? '');
      if (!r.ok) return;
      const v = Math.min(LOAD_CLAMP.max, Math.max(LOAD_CLAMP.min, r.value));
      state.setRaw(d.id, String(v));
      toast.push(x.loadClamped(String(v)), 'error');
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
              const u = unitOf(d);
              const warn = !err && d.id === 'currentBp' && state.warnings.bpBelowBaseline;
              return (
                <div key={d.id} className={`field${err ? ' field--error' : warn ? ' field--warn' : ''}`}>
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
                      onBlur={() => onBlur(d)}
                      aria-invalid={err ? true : undefined}
                      aria-required={d.optional ? undefined : true}
                      aria-describedby={hintId}
                    />
                    {d.unitKind && u ? (
                      <select
                        className="field__unit field__unit--select"
                        aria-label={`${d.label[lang]} ${x.unit}`}
                        value={u.id}
                        onChange={(e) => state.setUnit(d.id, e.target.value)}
                        data-testid={`unit-${d.id}`}
                      >
                        {UNIT_SYSTEMS[d.unitKind].map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="field__unit">{pick(d.unit, lang)}</span>
                    )}
                  </div>
                  <span
                    id={hintId}
                    className={err ? 'field__error' : warn ? 'field__warn' : 'field__hint'}
                    role={err === 'safety' ? 'alert' : undefined}
                  >
                    {err
                      ? errorText(d, err)
                      : warn
                        ? x.bpBelow
                        : `${c.range(shown(d, d.min), shown(d, d.max))}${d.hint ? ` · ${d.hint[lang]}` : ''}`}
                  </span>
                </div>
              );
            })}

            {g === 'economics' && (
              <p className="field__hint" data-testid="kit-methods-note">
                {x.kitMethods}
              </p>
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
