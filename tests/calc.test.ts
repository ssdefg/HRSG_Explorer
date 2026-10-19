import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BP_THRESHOLDS,
  POWER_LOSS_COEFF_MW_PER_MMH2O,
  buildCumulativeBenefit,
  buildLossSensitivity,
  calcBreakEvenDays,
  calcChange,
  calcDeltaBackpressure,
  calcMonthlyLossKrw,
  calcPowerLossMw,
  calcRatioPct,
  calcSimplePaybackMonths,
  classifyBackpressure,
  computeEconomics,
  mean,
} from '@/lib/calc';
import { INPUT_DEF } from '@/data/calculatorInputs';
import { parseNumericInput } from '@/lib/number';

const DEFAULTS = {
  currentBp: INPUT_DEF.currentBp.defaultValue,
  referenceBp: INPUT_DEF.referenceBp.defaultValue,
  operatingHours: INPUT_DEF.operatingHours.defaultValue,
  smp: INPUT_DEF.smp.defaultValue,
  capacityMw: INPUT_DEF.capacityMw.defaultValue,
  loadPct: INPUT_DEF.loadPct.defaultValue,
};

test('기본 입력값이 명세와 같다 (320 / 250 / 140 / 720)', () => {
  assert.deepEqual(
    [DEFAULTS.currentBp, DEFAULTS.referenceBp, DEFAULTS.smp, DEFAULTS.operatingHours],
    [320, 250, 140, 720],
  );
  assert.equal(POWER_LOSS_COEFF_MW_PER_MMH2O, 0.015);
});

test('기본값 검증: 70 mmH₂O · 1.05 MW · 105,840,000원', () => {
  const r = computeEconomics(DEFAULTS);
  assert.equal(r.deltaBp, 70);
  assert.equal(r.powerLossMw, 1.05);
  assert.equal(r.monthlyLossKrw, 105_840_000);
  assert.equal(new Intl.NumberFormat('ko-KR').format(r.monthlyLossKrw!), '105,840,000');
});

test('월간 손실 단위: MW × 1000 → kW, × h → kWh, × 원/kWh → 원 (추가 ÷1000 없음)', () => {
  assert.equal(calcMonthlyLossKrw(1, 1, 1), 1000);
  assert.equal(calcMonthlyLossKrw(1.05, 720, 140), 1.05 * 1000 * 720 * 140);
});

test('delta_bp = max(0, input − reference)', () => {
  assert.equal(calcDeltaBackpressure(200, 250), 0);
  assert.equal(calcDeltaBackpressure(250.5, 250), 0.5);
  assert.equal(calcPowerLossMw(0), 0);
});

test('비정상 입력은 null — NaN/Infinity가 결과로 나오지 않는다', () => {
  assert.equal(calcDeltaBackpressure(null, 250), null);
  assert.equal(calcMonthlyLossKrw(Number.NaN, 720, 140), null);
  assert.equal(calcMonthlyLossKrw(Infinity, 720, 140), null);
  assert.equal(calcMonthlyLossKrw(1, -1, 140), null);
  const r = computeEconomics({ ...DEFAULTS, smp: null });
  assert.equal(r.monthlyLossKrw, null);
  assert.equal(r.deltaBp, 70);
});

test('시연용 배압 상태 경계 (270 미만 정상 · 270~300 주의 · 300 초과 위험)', () => {
  assert.deepEqual(BP_THRESHOLDS, { caution: 270, danger: 300 });
  assert.equal(classifyBackpressure(269.9), 'normal');
  assert.equal(classifyBackpressure(270), 'caution');
  assert.equal(classifyBackpressure(300), 'caution');
  assert.equal(classifyBackpressure(300.1), 'danger');
  assert.equal(classifyBackpressure(null), null);
});

test('차트 민감도 곡선은 KPI와 같은 값을 낸다', () => {
  const pts = buildLossSensitivity(250, 720, 140, 200, 400, 5);
  assert.equal(pts.find((p) => p.bp === 320)?.monthlyLossMillionKrw, 105.84);
  assert.equal(pts.find((p) => p.bp === 240)?.monthlyLossMillionKrw, 0);
});

test('손익분기점 예시: 30,000,000 ÷ 1,250,000 = 24일', () => {
  assert.equal(calcBreakEvenDays(30_000_000, 1_250_000), 24);
  assert.equal(calcBreakEvenDays(30_000_000, 0), null);
  const cum = buildCumulativeBenefit(30_000_000, 1_250_000, 60);
  assert.equal(cum.length, 61);
  assert.equal(cum[0].netMillionKrw, -30);
  assert.equal(cum[24].netMillionKrw, 0);
  assert.equal(cum[60].netMillionKrw, 45);
});

test('단순 회수 기간 = 비용 ÷ 월간 편익 [개월]', () => {
  assert.equal(Math.round(calcSimplePaybackMonths(30e6, 38e6)! * 100) / 100, 0.79);
  assert.equal(calcSimplePaybackMonths(18e6, 24e6), 0.75);
  assert.equal(Math.round(calcSimplePaybackMonths(25e6, 30e6)! * 100) / 100, 0.83);
});

test('보조 계산: 변화율 · 평균 · 비율', () => {
  assert.deepEqual(calcChange(320, 245), { abs: -75, pct: -23.4375 });
  assert.equal(mean([1, null, 3]), 2);
  assert.equal(mean([]), null);
  assert.equal(Math.round(calcRatioPct(5, 22)), 23);
  assert.equal(calcRatioPct(1, 0), 0);
});

test('입력 파싱: 빈 값 · 숫자 아님 · 음수 · 범위 초과', () => {
  const o = { min: 0, max: 1000 };
  assert.deepEqual(parseNumericInput('', o), { ok: false, reason: 'empty' });
  assert.deepEqual(parseNumericInput('abc', o), { ok: false, reason: 'nan' });
  assert.deepEqual(parseNumericInput('-5', o), { ok: false, reason: 'min' });
  assert.deepEqual(parseNumericInput('1e400', o), { ok: false, reason: 'nan' });
  assert.deepEqual(parseNumericInput('2000', o), { ok: false, reason: 'max' });
  assert.deepEqual(parseNumericInput(' 1,000 ', o), { ok: true, value: 1000 });
});
