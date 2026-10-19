import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_HRSG_CLASS,
  HRSG_CLASSES,
  NUMERIC_INPUTS,
  type HrsgClass,
  type NumericInputId,
} from '@/data/calculatorInputs';
import { parseNumericInput, type ParseResult } from '@/lib/number';
import { computeEconomics, type EconomicsResult } from '@/lib/calc';

export type InputErrorReason = Extract<ParseResult, { ok: false }>['reason'];

type RawValues = Record<NumericInputId, string>;
export type ParsedValues = Record<NumericInputId, number | null>;
export type InputErrors = Record<NumericInputId, InputErrorReason | null>;

function defaultRaw(): RawValues {
  return Object.fromEntries(NUMERIC_INPUTS.map((d) => [d.id, String(d.defaultValue)])) as RawValues;
}

export interface CalculatorState {
  hrsgClass: HrsgClass;
  setHrsgClass: (c: HrsgClass) => void;
  raw: RawValues;
  setRaw: (id: NumericInputId, value: string) => void;
  values: ParsedValues;
  errors: InputErrors;
  errorCount: number;
  result: EconomicsResult;
  reset: () => void;
}

/**
 * 계산기 입력 상태 — 원문 문자열을 보관하고, 파싱·범위 검증 후 유효한 값만 계산 엔진에 넘긴다.
 * 잘못된 입력은 null로 처리되어 화면에 NaN·Infinity가 나타나지 않는다.
 */
export function useCalculatorState(): CalculatorState {
  const [hrsgClass, setClassState] = useState<HrsgClass>(DEFAULT_HRSG_CLASS);
  const [raw, setRawState] = useState<RawValues>(defaultRaw);

  const setRaw = useCallback((id: NumericInputId, value: string) => {
    setRawState((prev) => ({ ...prev, [id]: value }));
  }, []);

  /** 설비 유형 변경 시 시연용 용량(F 150 MW / J 270 MW)으로 채운다 — 이후 사용자가 수정 가능 */
  const setHrsgClass = useCallback((c: HrsgClass) => {
    setClassState(c);
    const cls = HRSG_CLASSES.find((x) => x.value === c);
    if (cls) setRawState((prev) => ({ ...prev, capacityMw: String(cls.demoCapacityMw) }));
  }, []);

  const reset = useCallback(() => {
    setClassState(DEFAULT_HRSG_CLASS);
    setRawState(defaultRaw());
  }, []);

  const { values, errors, errorCount } = useMemo(() => {
    const v = {} as ParsedValues;
    const e = {} as InputErrors;
    let n = 0;
    for (const d of NUMERIC_INPUTS) {
      const r = parseNumericInput(raw[d.id], { min: d.min, max: d.max });
      v[d.id] = r.ok ? r.value : null;
      e[d.id] = r.ok ? null : r.reason;
      if (!r.ok) n += 1;
    }
    return { values: v, errors: e, errorCount: n };
  }, [raw]);

  const result = useMemo(
    () =>
      computeEconomics({
        currentBp: values.currentBp,
        referenceBp: values.referenceBp,
        operatingHours: values.operatingHours,
        smp: values.smp,
        capacityMw: values.capacityMw,
        loadPct: values.loadPct,
      }),
    [values],
  );

  return { hrsgClass, setHrsgClass, raw, setRaw, values, errors, errorCount, result, reset };
}
