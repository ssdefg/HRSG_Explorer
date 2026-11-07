/**
 * 계산기 어댑터 — 앱 화면의 입력값 ↔ 키트(hrsg_calc_kit_team1) 입력 inp · 결과.
 *
 * 계산식·상수·기본값의 단일 기준은 키트다. 이 파일은 이름·단위만 바꾸고 계산식을 두지 않는다.
 * 키트 README 「팀 1 화면 연결표」를 따른다:
 *   capacityMw → equipment.rated_gt_mw          loadPct → equipment.load_pct
 *   currentBp (mmH₂O) → equipment.gt_bp_mmh2o    referenceBp (mmH₂O) → equipment.base_gt_bp_mmh2o
 *   diffPressure (mbar) → equipment.hrsg_dp_mbar
 *   exhaustTemp → equipment.stack_c              referenceStackTemp → equipment.base_stack_c
 *   operatingHours → economics.monthly_hours     smp → economics.price_krw_per_kwh
 *   recoveredPowerMw → economics.target_recovery_mw (공법 회수율·회수 출력이 모두 없을 때만 키트가 사용)
 *   cleaningCostKrw · shutdownDays · additionalCostKrw → methods[dryice].cost_krw · outage_days · indirect_krw
 *   drumPressure (bar(g)) · evapOutletGasTemp · econOutletWaterTemp · designPinch · designApproach → sections.HP
 * 화면에 입력란이 없는 값(ST 정격, 배기 온도·유량, 외기 온도, HP 스팀, 연간 운전 시간, 나머지 공법 3개)은 키트 데이터 값을 그대로 쓴다.
 */
import { KIT_CALC_DATA as D, kitCalc, type KitInput, type KitPinchSection, type KitResult } from '@/lib/kit';

/** 화면의 세정비용·정지일수·간접 비용 입력이 연결되는 키트 공법 */
export const ADAPTED_METHOD_ID = 'dryice';

/** 어댑터가 받는 화면 값 (기준 단위: 압력 mmH₂O, 차압 mbar, 온도 °C, 드럼 bar(g)) — 오류인 입력은 null */
export interface AdapterValues {
  capacityMw: number | null;
  loadPct: number | null;
  currentBp: number | null;
  referenceBp: number | null;
  diffPressure: number | null;
  operatingHours: number | null;
  exhaustTemp: number | null;
  referenceStackTemp: number | null;
  drumPressure: number | null;
  econOutletWaterTemp: number | null;
  evapOutletGasTemp: number | null;
  designPinch: number | null;
  designApproach: number | null;
  smp: number | null;
  recoveredPowerMw: number | null;
  cleaningCostKrw: number | null;
  shutdownDays: number | null;
  additionalCostKrw: number | null;
}

export function kitClass(id: string) {
  return D.gt_classes.find((g) => g.id === id) ?? D.gt_classes[0];
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * 키트 기본값(defaultInputs)을 화면 입력값으로 — 계산기 기본값·「기본값 초기화」가 키트와 같은 상태가 되게 한다.
 * 압력은 화면 단위(mmH₂O)로 소수 첫째 자리까지 (키트 README 기대값 305.9 mmH₂O 와 같은 표기).
 */
export function kitDefaultValues(classId = D.default_case.gt_class): AdapterValues {
  const inp = kitCalc.defaultInputs(D, { gt_class: classId });
  const cls = kitClass(classId);
  const eq = inp.equipment as Record<string, number>;
  const hp = inp.sections.HP;
  const dry = D.methods.find((m) => m.id === ADAPTED_METHOD_ID)!;
  return {
    capacityMw: cls.rated_gt_mw,
    loadPct: eq.load_pct,
    currentBp: round(kitCalc.fromMbar(eq.gt_bp_mbar, 'mmh2o'), 1),
    referenceBp: round(kitCalc.fromMbar(cls.indicators.gt_bp_mbar.design, 'mmh2o'), 1),
    diffPressure: eq.hrsg_dp_mbar,
    operatingHours: D.economics.monthly_hours,
    exhaustTemp: eq.stack_c,
    referenceStackTemp: cls.indicators.stack_c.design,
    drumPressure: hp?.drum_barg ?? null,
    econOutletWaterTemp: hp?.econ_outlet_water_c ?? null,
    evapOutletGasTemp: hp?.evap_outlet_gas_c ?? null,
    designPinch: null,
    designApproach: null,
    smp: D.economics.price_krw_per_kwh,
    recoveredPowerMw: D.economics.target_recovery_mw,
    cleaningCostKrw: dry.cost_krw,
    shutdownDays: dry.outage_days,
    additionalCostKrw: dry.indirect_krw,
  };
}

/** 화면 값 → 키트 inp. 오류인 입력은 null 로 넘겨 키트가 「산출 불가」·「데이터 필요」를 판정하게 한다. */
export function toKitInput(v: AdapterValues, gtClass: string): KitInput {
  const cls = kitClass(gtClass);
  return {
    equipment: {
      gt_class: cls.id,
      rated_gt_mw: v.capacityMw,
      load_pct: v.loadPct,
      gt_bp_mmh2o: v.currentBp,
      base_gt_bp_mmh2o: v.referenceBp,
      hrsg_dp_mbar: v.diffPressure,
      stack_c: v.exhaustTemp,
      base_stack_c: v.referenceStackTemp,
      gt_exhaust_c: cls.operation.gt_exhaust_c,
      exhaust_flow_kgs: cls.operation.exhaust_flow_kgs,
      ambient_c: cls.operation.ambient_c,
    },
    economics: {
      price_krw_per_kwh: v.smp,
      monthly_hours: v.operatingHours,
      annual_hours: D.economics.annual_hours,
      target_recovery_mw: v.recoveredPowerMw,
    },
    methods: D.methods.map((m) =>
      m.id === ADAPTED_METHOD_ID
        ? { ...m, cost_krw: v.cleaningCostKrw, outage_days: v.shutdownDays, indirect_krw: v.additionalCostKrw }
        : { ...m },
    ),
    sections: {
      HP: {
        drum_barg: v.drumPressure,
        evap_outlet_gas_c: v.evapOutletGasTemp,
        econ_outlet_water_c: v.econOutletWaterTemp,
        ...(v.designPinch !== null ? { pinch_design_c: v.designPinch } : {}),
        ...(v.designApproach !== null ? { approach_design_c: v.designApproach } : {}),
      },
      IP: null,
      LP: null,
    },
    hp_steam_tph: cls.hp_steam_tph,
  };
}

export interface KitRun {
  inp: KitInput;
  /** validateInputs 결과 — errors 가 있으면 result 는 null */
  errors: string[];
  warnings: string[];
  result: KitResult | null;
  pinch: KitPinchSection;
}

/** 키트 calculate + HP 핀치. 키트가 던지는 오류(입력 형식·범위)는 잡아서 errors 로 돌려준다. */
export function runKit(v: AdapterValues, gtClass: string): KitRun {
  const inp = toKitInput(v, gtClass);
  const check = kitCalc.validateInputs(inp, D);
  let result: KitResult | null = null;
  const errors = [...check.errors];
  if (check.ok) {
    try {
      result = kitCalc.calculate(inp, D);
    } catch (e) {
      errors.push(String((e as Error).message));
    }
  }
  let pinch: KitPinchSection;
  try {
    pinch = kitCalc.pinchSection('HP', inp.sections.HP, D);
  } catch (e) {
    // 증발기 출구 가스 온도 < 포화온도 · 드럼 압력 범위 밖 → 키트가 RangeError
    pinch = { label: 'HP', design: D.pinch.design.HP, level: 'no_data', current: null, message: String((e as Error).message) };
  }
  return { inp, errors, warnings: check.warnings, result, pinch };
}

/** GT 배압 판정 구간 (기준 배압으로 다시 맞춘 값, mmH₂O) — 게이지·차트·경보가 같은 값을 쓴다 */
export interface BpBands {
  design: number;
  caution: number;
  danger: number;
  min: number;
  max: number;
}

export function bpBands(run: KitRun): BpBands | null {
  const ind = run.result?.indicators.gt_bp_mbar;
  if (!ind) return null;
  const mm = (mbar: number) => kitCalc.fromMbar(mbar, 'mmh2o');
  return { design: mm(ind.design), caution: mm(ind.caution), danger: mm(ind.danger), min: mm(ind.min), max: mm(ind.max) };
}

/** 배압-손실 곡선 (키트 lossCurve, GT 배압만 변화) — x: 배압 mmH₂O, y: 손실 MW */
export function kitLossCurve(run: KitRun): { bp: number; excess: number; lossMw: number }[] {
  if (!run.result) return [];
  return kitCalc.lossCurve(run.inp, D, { param: 'gt_bp' }).points.map((p) => ({
    bp: p.value.mmh2o,
    excess: p.excess.mmh2o,
    lossMw: p.loss_mw,
  }));
}

/** 배압만 바꿨을 때의 출력 손실 [MW] — 실측 배압으로 회수 출력을 볼 때 (대시보드 실측 비교) */
export function kitLossAtBp(run: KitRun, gtBpMmh2o: number): number | null {
  if (!run.result) return null;
  const inp: KitInput = { ...run.inp, equipment: { ...run.inp.equipment, gt_bp_mmh2o: gtBpMmh2o } };
  try {
    return kitCalc.calculate(inp, D).loss.total_mw;
  } catch {
    return null;
  }
}

export const formatKrw = kitCalc.formatKrw;
