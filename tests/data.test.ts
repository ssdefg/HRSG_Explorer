import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOCK_CLEANING_METHODS } from '@/data/mockCleaning';
import { VALIDATION_SCENARIO, buildScenarioSeries } from '@/data/validationScenario';
import { CHECKLIST_ITEMS } from '@/data/checklistItems';
import { QA_PRESETS } from '@/data/qaPresets';
import { matchQuestion } from '@/lib/qaMatch';
import { buildRequestEmail } from '@/lib/emailDraft';
import { BP_THRESHOLDS, POWER_LOSS_COEFF_MW_PER_MMH2O } from '@/lib/calc';

test('세정 방식 가상 비용·월간 편익이 명세와 같다', () => {
  const byId = Object.fromEntries(MOCK_CLEANING_METHODS.map((m) => [m.id, [m.costKrw, m.monthlyBenefitKrw]]));
  assert.deepEqual(byId, {
    dryIce: [30_000_000, 38_000_000],
    highPressureWater: [18_000_000, 24_000_000],
    chemical: [25_000_000, 30_000_000],
  });
});

test('세정 전후 가상 시나리오가 명세와 같다', () => {
  const s = VALIDATION_SCENARIO;
  assert.deepEqual(s.backPressure, { before: 320, after: 245 });
  assert.deepEqual(s.exhaustTemp, { before: 135, after: 112 });
  assert.equal(s.powerChangeMw.after, 1.1);
  assert.equal(s.cleaningCostKrw, 30_000_000);
  assert.equal(s.dailyNetBenefitKrw, 1_250_000);
});

test('시계열: 세정 전 30일 + 후 60일, 세정일(0) 비움, 결정적', () => {
  const a = buildScenarioSeries();
  assert.equal(a.length, 90);
  assert.equal(a.some((p) => p.day === 0), false);
  assert.deepEqual([a[0].day, a[a.length - 1].day], [-30, 60]);
  assert.deepEqual(buildScenarioSeries(), a);
  assert.ok(a.every((p) => Number.isFinite(p.backPressure) && Number.isFinite(p.exhaustTemp)));
});

test('체크리스트 22개 항목 (A 5 · B 9 · C 8), id 중복 없음', () => {
  const count = (c: string) => CHECKLIST_ITEMS.filter((i) => i.category === c).length;
  assert.deepEqual([count('A'), count('B'), count('C')], [5, 9, 8]);
  assert.equal(new Set(CHECKLIST_ITEMS.map((i) => i.id)).size, CHECKLIST_ITEMS.length);
});

test('질문 매칭: 추천 질문은 정확히, 무관한 질문은 매칭하지 않음', () => {
  assert.equal(QA_PRESETS.length, 5);
  for (const p of QA_PRESETS) {
    assert.equal(matchQuestion(p.question.ko, QA_PRESETS)?.id, p.id);
    assert.equal(matchQuestion(p.question.en, QA_PRESETS)?.id, p.id);
  }
  assert.equal(matchQuestion('배압이 오르면 출력이 떨어지나요?', QA_PRESETS)?.id, 'bpImpact');
  assert.equal(matchQuestion('pinch point가 뭐야', QA_PRESETS)?.id, 'pinchApproach');
  for (const q of ['오늘 점심 메뉴 추천해줘', '배압', '', 'What is the weather?']) {
    assert.equal(matchQuestion(q, QA_PRESETS), null, q);
  }
});

test('이메일 초안: 선택 항목만 포함, 실제 주소 없음, 필수 구성 포함', () => {
  const sel = CHECKLIST_ITEMS.filter((i) => ['a-gt-load', 'b-bp-dp', 'c-cost'].includes(i.id));
  for (const lang of ['ko', 'en'] as const) {
    const { body } = buildRequestEmail(sel, lang);
    assert.ok(sel.every((i) => body.includes(i.name[lang])));
    assert.ok(!body.includes(CHECKLIST_ITEMS.find((i) => i.id === 'a-exh-flow')!.name[lang]));
    assert.ok(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body), 'no email address');
    assert.ok(body.includes(`${VALIDATION_SCENARIO.daysBefore}`) && body.includes(`${VALIDATION_SCENARIO.daysAfter}`));
  }
  const ko = buildRequestEmail(sel, 'ko').body;
  for (const part of ['안녕하십니까', '요청 자료 (3건)', '단위 및 기간', '자료 활용 목적', '감사합니다', '[수신자 성함/직함]']) {
    assert.ok(ko.includes(part), part);
  }
});

test('엔진 상수가 바뀌어도 안내 문구가 따라간다 (문자열 하드코딩 방지)', async () => {
  const { STRINGS_CALC } = await import('@/i18n/calculatorStrings');
  for (const lang of ['ko', 'en'] as const) {
    const s = STRINGS_CALC[lang];
    assert.ok(s.kpiPowerLossNote.includes(String(POWER_LOSS_COEFF_MW_PER_MMH2O)));
    assert.ok(s.gaugeThresholds.includes(String(BP_THRESHOLDS.caution)));
    assert.ok(s.gaugeThresholds.includes(String(BP_THRESHOLDS.danger)));
  }
});
