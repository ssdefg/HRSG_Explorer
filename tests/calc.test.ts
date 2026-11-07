/**
 * 계산기 — 키트(hrsg_calc_kit_team1) 단일 기준 + 어댑터(calc_adapter) 검증.
 * 기대값은 키트 README 「기대값」 표. 앱과 같은 경로(deriveCalculator → calc_adapter → 키트 calculate)로 계산한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCumulativeBenefit, calcChange, calcRatioPct, classifyBackpressure, mean } from '@/lib/calc';
import { deriveCalculator, parseCalcInputs } from '@/lib/calculatorModel';
import { defaultCalc, defaultRaw, type CalcCaseState } from '@/lib/caseStore';
import { ADAPTED_METHOD_ID, kitDefaultValues, kitLossCurve, toKitInput } from '@/lib/calc_adapter';
import { KIT_CALC_DATA, kitCalc } from '@/lib/kit';
import { HRSG_CLASSES, INPUT_DEF, KPA_PER_MMH2O, scenarioValues, unitDef } from '@/data/calculatorInputs';
import { parseNumericInput } from '@/lib/number';

const r2 = (v: number | null | undefined, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const calcWith = (patch: Partial<Record<string, string>>, extra: Partial<CalcCaseState> = {}): CalcCaseState => {
  const c = defaultCalc();
  return { ...c, ...extra, raw: { ...c.raw, ...patch } as CalcCaseState['raw'] };
};

test('[키트 기대값] 기본값 KPI 10개 — 어댑터 경유', () => {
  const d = deriveCalculator(defaultCalc());
  const m = d.metrics;
  assert.equal(d.kit.run.errors.length, 0);
  assert.equal(d.kit.run.warnings.length, 0, d.kit.run.warnings.join('\n'));
  assert.equal(r2(d.values.currentBp, 1), 305.9);
  assert.equal(r2(m.deltaBp.value, 1), 51.0);
  assert.equal(r2(m.powerLossMw.value), 1.89);
  assert.equal(kitCalc.formatKrw(m.monthlyLossKrw.value), '2.04억 원');
  assert.equal(r2(m.recoveredMw.value), 1.32);
  assert.equal(kitCalc.formatKrw(m.initialInvestmentKrw.value), '4.46억 원');
  assert.equal(d.cleaning.methodName, '드라이아이스 세정');
  assert.equal(kitCalc.formatKrw(m.monthlyIncrementalBenefitKrw.value), '1.43억 원');
  assert.equal(kitCalc.formatKrw(m.netBenefitKrw.value), '-3.03억 원');
  assert.equal(r2(m.paybackMonths.value), 3.12);
  assert.equal(r2(m.breakEvenDays.value, 1), 93.6);
});

test('[키트 기대값] 경고 없음 · 게이지 · 세정 필요도 · 핀치', () => {
  const d = deriveCalculator(defaultCalc());
  const r = d.kit.result!;
  assert.deepEqual(r.warnings, []);
  assert.equal(r2(r.gauge.value.mmh2o, 1), 51.0);
  assert.equal(r2(r.gauge.max.mmh2o, 1), 203.9);
  assert.deepEqual(r.gauge.public_ref.map((p) => r2(p.mmh2o, 1)), [76.2, 101.6]);
  assert.equal(r2(d.metrics.cleaningScore.value, 1), 41.1);
  assert.equal(r2(r.index.pressure_part, 1), 33.3);
  assert.equal(r2(r.index.temp_part, 1), 7.8);
  assert.equal(r2(d.pinch.pinchC, 1), 8.0);
  assert.equal(r2(d.pinch.approachC, 1), 5.0);
  assert.equal(d.pinch.message, '설계 범위 안입니다.');
});

test('[키트 기대값] 배압-손실 곡선 · 공법 비교 순서', () => {
  const d = deriveCalculator(defaultCalc());
  const curve = kitLossCurve(d.kit.run);
  assert.equal(r2(curve[0].lossMw), 1.89);
  assert.equal(r2(curve[curve.length - 1].excess, 1), 203.9);
  assert.equal(r2(curve[curve.length - 1].lossMw), 5.13);
  const byPayback = d.kit.methods.filter((x) => x.available).sort((a, b) => a.payback_months! - b.payback_months!);
  assert.deepEqual(byPayback.map((x) => [x.id, r2(x.payback_months)]), [
    ['dryice', 3.12],
    ['water', 3.3],
    ['mechanical', 3.54],
    ['chemical', 4.27],
  ]);
  const byTotal = [...byPayback].sort((a, b) => a.total_investment_krw! - b.total_investment_krw!);
  assert.deepEqual(byTotal.map((x) => kitCalc.formatKrw(x.total_investment_krw)), ['3.25억 원', '4.04억 원', '4.46억 원', '7.42억 원']);
});

test('[키트 기대값] 공법 하나의 비용을 지우면 「산출 불가 — 입력 필요: 세정 비용」', () => {
  const d = deriveCalculator(calcWith({ cleaningCostKrw: '' }));
  const dry = d.kit.methods.find((x) => x.id === ADAPTED_METHOD_ID)!;
  assert.equal(dry.available, false);
  assert.equal(dry.message, '산출 불가 — 입력 필요: 세정 비용');
  // 나머지 공법으로 계속 계산 — 회수기간이 가장 짧은 공법이 고압수로 바뀐다
  assert.equal(d.cleaning.methodId, 'water');
  assert.equal(r2(d.metrics.paybackMonths.value), 3.3);
  assert.equal(d.metrics.powerLossMw.status, 'ok');
});

test('기본값은 키트 데이터에서 온다 (단일 기준)', () => {
  const k = kitDefaultValues();
  const F = KIT_CALC_DATA.gt_classes.find((g) => g.id === 'F')!;
  assert.equal(INPUT_DEF.capacityMw.defaultValue, F.rated_gt_mw);
  assert.equal(INPUT_DEF.diffPressure.defaultValue, KIT_CALC_DATA.default_case.hrsg_dp_mbar);
  assert.equal(INPUT_DEF.exhaustTemp.defaultValue, KIT_CALC_DATA.default_case.stack_c);
  assert.equal(INPUT_DEF.smp.defaultValue, KIT_CALC_DATA.economics.price_krw_per_kwh);
  assert.equal(INPUT_DEF.drumPressure.defaultValue, KIT_CALC_DATA.pinch.default_drum_barg.HP);
  assert.equal(INPUT_DEF.cleaningCostKrw.defaultValue, KIT_CALC_DATA.methods.find((m) => m.id === 'dryice')!.cost_krw);
  assert.equal(k.currentBp, 305.9);
  assert.deepEqual(HRSG_CLASSES.map((c) => [c.value, c.demoCapacityMw]), [
    ['F', 270],
    ['H', 400],
    ['E', 170],
  ]);
});

test('어댑터 입력: 키트 연결표의 키와 단위 (압력 단위는 키 이름으로)', () => {
  const inp = toKitInput(kitDefaultValues(), 'F');
  assert.deepEqual(Object.keys(inp.equipment).sort(), [
    'ambient_c', 'base_gt_bp_mmh2o', 'base_stack_c', 'exhaust_flow_kgs', 'gt_bp_mmh2o', 'gt_class', 'gt_exhaust_c', 'hrsg_dp_mbar',
    'load_pct', 'rated_gt_mw', 'stack_c',
  ]);
  assert.equal(inp.economics.price_krw_per_kwh, 150);
  assert.equal(inp.methods.length, 4);
  assert.equal(inp.sections.HP?.drum_barg, 125);
  assert.equal(inp.sections.IP, null);
  assert.deepEqual(kitCalc.validateInputs(inp, KIT_CALC_DATA), { ok: true, errors: [], warnings: [] });
});

test('핵심 입력이 잘못되면 키트 결과 전체가 「산출 불가」 — 이전 값을 남기지 않는다', () => {
  const d = deriveCalculator(calcWith({ currentBp: 'abc' }));
  assert.equal(d.valid, false);
  assert.deepEqual(d.errorIds, ['currentBp']);
  assert.ok(d.kit.run.errors.length > 0);
  assert.equal(d.kit.result, null);
  for (const id of ['deltaBp', 'powerLossMw', 'monthlyLossKrw', 'paybackMonths', 'cleaningScore'] as const) {
    assert.equal(d.metrics[id].status, 'invalid', id);
    assert.equal(d.metrics[id].value, null, id);
  }
});

test('핀치 입력이 잘못되면 HP 섹션만 「데이터 필요」', () => {
  const d = deriveCalculator(calcWith({ drumPressure: '' }));
  assert.equal(d.pinch.level, 'no_data');
  assert.equal(d.pinch.pinchC, null);
  assert.equal(d.metrics.powerLossMw.status, 'ok');
});

test('[계산기] 압력 단위 mmH₂O → kPa 환산 × 0.00980665 — 같은 키트 결과', () => {
  assert.equal(KPA_PER_MMH2O, 0.00980665);
  const kPa = unitDef('pressure', 'kPa');
  assert.ok(Math.abs(kPa.fromBase(100) - 0.980665) < 1e-12);
  const base = deriveCalculator(defaultCalc());
  const inKpa = deriveCalculator(calcWith({ currentBp: String(305.9 * KPA_PER_MMH2O) }, { units: { currentBp: 'kPa' } }));
  assert.ok(Math.abs(inKpa.values.currentBp! - 305.9) < 1e-6);
  assert.equal(r2(inKpa.metrics.powerLossMw.value, 6), r2(base.metrics.powerLossMw.value, 6));
});

test('GT 등급 판정 구간은 키트 지표(기준 배압으로 재조정)를 따른다', () => {
  const d = deriveCalculator(defaultCalc());
  const I = KIT_CALC_DATA.gt_classes[0].indicators.gt_bp_mbar;
  // 기준 배압 305.9 mmH₂O(≈29.999 mbar) 로 재조정 — 설계 30 mbar 와 0.002 mbar 이내
  assert.ok(Math.abs(d.bands!.caution - kitCalc.fromMbar(I.caution, 'mmh2o')) < 0.05);
  assert.ok(Math.abs(d.bands!.danger - kitCalc.fromMbar(I.danger, 'mmh2o')) < 0.05);
  assert.equal(classifyBackpressure(300, d.bands), 'normal');
  assert.equal(classifyBackpressure(d.bands!.caution, d.bands), 'caution');
  assert.equal(classifyBackpressure(d.bands!.danger + 1, d.bands), 'danger');
  assert.equal(classifyBackpressure(null, d.bands), null);
  // 종합 판정 = 세 지표 중 가장 나쁜 것 (기본값: HRSG 차압 30 mbar ≥ 주의 27.5)
  assert.equal(d.level, 'caution');
});

test('DEMO 시나리오는 키트 지표에서 만든다 — 정상=설계 · 경보=기본 상태 · 트립=위험 구간', () => {
  const lv = (id: 'normal' | 'alarm' | 'trip') => {
    const v = scenarioValues(id, 'F');
    return deriveCalculator(calcWith(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)])))).level;
  };
  assert.equal(lv('normal'), 'normal');
  assert.equal(lv('alarm'), 'caution');
  assert.equal(lv('trip'), 'danger');
  assert.equal(deriveCalculator(calcWith({ ...Object.fromEntries(Object.entries(scenarioValues('normal', 'F')).map(([k, x]) => [k, String(x)])) })).metrics.powerLossMw.value, 0);
});

test('보조 계산: 변화율 · 평균 · 비율 · 누적 편익', () => {
  assert.deepEqual(calcChange(320, 245), { abs: -75, pct: -23.4375 });
  assert.equal(mean([1, null, 3]), 2);
  assert.equal(mean([]), null);
  assert.equal(Math.round(calcRatioPct(5, 22)), 23);
  assert.equal(calcRatioPct(1, 0), 0);
  const cum = buildCumulativeBenefit(1_250_000, 60);
  assert.equal(cum.length, 61);
  assert.equal(cum[24].benefitMillionKrw, 30);
  assert.deepEqual(buildCumulativeBenefit(null, 60), []);
});

test('입력 파싱: 빈 값 · 숫자 아님 · 음수 · 정수 · 범위 초과', () => {
  const o = { min: 0, max: 1000 };
  assert.deepEqual(parseNumericInput('', o), { ok: false, reason: 'empty' });
  assert.deepEqual(parseNumericInput('abc', o), { ok: false, reason: 'nan' });
  assert.deepEqual(parseNumericInput('-5', o), { ok: false, reason: 'negative' });
  assert.deepEqual(parseNumericInput('-5', { min: -30 }), { ok: true, value: -5 });
  assert.deepEqual(parseNumericInput('1.5', { integer: true }), { ok: false, reason: 'integer' });
  assert.deepEqual(parseNumericInput('1e400', o), { ok: false, reason: 'nan' });
  assert.deepEqual(parseNumericInput('2000', o), { ok: false, reason: 'max' });
  assert.deepEqual(parseNumericInput(' 1,000 ', o), { ok: true, value: 1000 });
});

test('[폼 검증] 스택 온도 300 °C 초과는 안전 한계(트립 위험), 부하율 범위 밖은 오류', () => {
  const p = (patch: Record<string, string>) => parseCalcInputs({ ...defaultRaw(), ...patch }).errors;
  assert.equal(p({ exhaustTemp: '320' }).exhaustTemp, 'safety');
  assert.equal(p({ exhaustTemp: '260' }).exhaustTemp, 'max');
  assert.equal(p({ loadPct: '20' }).loadPct, 'min');
  assert.equal(p({ loadPct: '115' }).loadPct, 'max');
  assert.equal(p({ shutdownDays: '1.5' }).shutdownDays, 'integer');
  assert.equal(p({ smp: '-3' }).smp, 'negative');
});
