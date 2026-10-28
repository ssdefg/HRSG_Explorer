import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcAdditionalRevenueKrw,
  calcEffectiveHours,
  calcNetBenefitKrw,
  calcPaybackMonths,
  computeCleaningEconomics,
} from '@/lib/calc';
import { deriveCalculator } from '@/lib/calculatorModel';
import {
  addCase,
  defaultCalc,
  defaultStore,
  deleteCase,
  duplicateCase,
  parseStore,
  renameCase,
  serializeStore,
  updateCaseIn,
  type CalcCaseState,
} from '@/lib/caseStore';
import { computeProgress, computeReadiness } from '@/lib/checklistStats';
import { activeAlarms } from '@/lib/alarms';
import { buildAnswer, type AnswerContext } from '@/components/qa/answers';
import type { CalculatorState, ChecklistState, MeasurementState, AnalysisSnapshot } from '@/context/Workspace';
import { QA_FALLBACK_TEXT, QA_PRESETS } from '@/data/qaPresets';
import { CHECKLIST_ITEMS, REQUIRED_ITEM_IDS } from '@/data/checklistItems';
import { HRSG_CLASSES } from '@/data/calculatorInputs';
import { buildRequestEmail } from '@/lib/emailDraft';
import type { ReceiptStatus } from '@/types';

const calcWith = (patch: Partial<Record<string, string>>, mode: 'demo' | 'user' = 'demo'): CalcCaseState => {
  const c = defaultCalc();
  return { ...c, mode, raw: { ...c.raw, ...patch } as CalcCaseState['raw'] };
};

/* ---- 경제성 표준식 ------------------------------------------------------------ */
test('경제성 기본값: 추가 매출·순편익·회수·손익분기 (MW→kW 1000 포함)', () => {
  const r = computeCleaningEconomics({
    recoveredPowerMw: 1.1,
    operatingHours: 720,
    shutdownDays: 0,
    smp: 140,
    cleaningCostKrw: 30_000_000,
    additionalCostKrw: 0,
    outputMw: 135,
  });
  assert.equal(r.additionalRevenueKrw, 110_880_000); // 1.1 × 1000 × 720 × 140
  assert.equal(r.shutdownLossKrw, 0);
  assert.equal(r.initialInvestmentKrw, 30_000_000);
  assert.equal(r.netBenefitKrw, 80_880_000);
  assert.equal(r.monthlyIncrementalBenefitKrw, 110_880_000);
  assert.equal(Math.round(r.paybackMonths! * 1000) / 1000, 0.271);
  assert.equal(Math.round(r.breakEvenDays! * 100) / 100, 8.12); // 30,000,000 ÷ (110,880,000 ÷ 30)
  assert.equal(calcAdditionalRevenueKrw(1, 1, 1), 1000);
});

test('정지일수: 유효 가동시간에서 제외 + 정지 손실 1회 차감 (이중 반영 없음)', () => {
  const r = computeCleaningEconomics({
    recoveredPowerMw: 1.1,
    operatingHours: 720,
    shutdownDays: 2,
    smp: 140,
    cleaningCostKrw: 30_000_000,
    additionalCostKrw: 5_000_000,
    outputMw: 135,
  });
  assert.equal(r.effectiveHours, 672);
  assert.equal(r.additionalRevenueKrw, Math.round(1.1 * 1000 * 672 * 140));
  assert.equal(r.shutdownLossKrw, 135 * 1000 * 48 * 140);
  assert.equal(r.initialInvestmentKrw, 30_000_000 + 907_200_000 + 5_000_000);
  // 순편익 = 매출 − 세정비 − 정지손실 − 추가비용 (각 1회)
  assert.equal(r.netBenefitKrw, r.additionalRevenueKrw! - 30_000_000 - 907_200_000 - 5_000_000);
  // 회수 기간 분모(정상 월 편익)에는 일회성 비용을 다시 빼지 않는다
  assert.equal(r.paybackMonths, Math.round((r.initialInvestmentKrw! / r.monthlyIncrementalBenefitKrw!) * 1e6) / 1e6);
});

test('회수 불가·산출 불가 경계', () => {
  assert.equal(calcPaybackMonths(30_000_000, 0), null);
  assert.equal(calcPaybackMonths(30_000_000, -1), null);
  assert.equal(calcEffectiveHours(720, 31), null); // 정지시간 744h > 720h
  assert.equal(calcNetBenefitKrw(null, 1, 0, 0), null);
});

/* ---- 계산기 파생 모델: 모드 게이팅 · 무효화 ----------------------------------- */
test('DEMO 기본값은 105,840,000원, 사용자 입력 모드는 배압 손실 모델을 보류', () => {
  const demo = deriveCalculator(defaultCalc());
  assert.equal(demo.metrics.monthlyLossKrw.value, 105_840_000);
  assert.equal(demo.metrics.monthlyLossKrw.status, 'ok');
  assert.equal(demo.model, 'DEMO-GT-150');
  const user = deriveCalculator({ ...defaultCalc(), mode: 'user' });
  assert.equal(user.metrics.powerLossMw.status, 'model');
  assert.equal(user.metrics.monthlyLossKrw.value, null);
  assert.equal(user.metrics.deltaBp.value, 70); // 산술값은 계산
  assert.equal(user.metrics.netBenefitKrw.status, 'ok');
});

test('잘못된 입력은 의존 결과만 무효화 — 이전 값을 남기지 않는다', () => {
  const bad = deriveCalculator(calcWith({ currentBp: 'abc' }));
  assert.equal(bad.valid, false);
  assert.deepEqual(bad.errorIds, ['currentBp']);
  assert.equal(bad.metrics.deltaBp.status, 'invalid');
  assert.equal(bad.metrics.monthlyLossKrw.value, null);
  assert.equal(bad.metrics.netBenefitKrw.status, 'ok'); // 배압과 무관한 경제성은 유지
  const empty = deriveCalculator(calcWith({ smp: '' }));
  assert.equal(empty.errors.smp, 'empty');
  assert.equal(empty.metrics.additionalRevenueKrw.status, 'invalid');
  const neg = deriveCalculator(calcWith({ cleaningCostKrw: '-5' }));
  assert.equal(neg.errors.cleaningCostKrw, 'min');
  const comma = deriveCalculator(calcWith({ cleaningCostKrw: '30,000,000' }));
  assert.equal(comma.values.cleaningCostKrw, 30_000_000);
  // 선택 입력(설계 핀치값)은 비워도 오류가 아니다
  assert.equal(deriveCalculator(defaultCalc()).errors.designPinch, null);
});

test('입력이 바뀌면 inputsKey도 바뀐다 (스냅샷 최신 여부 판별)', () => {
  assert.notEqual(deriveCalculator(defaultCalc()).inputsKey, deriveCalculator(calcWith({ currentBp: '321' })).inputsKey);
  assert.equal(deriveCalculator(defaultCalc()).inputsKey, deriveCalculator(defaultCalc()).inputsKey);
});

test('설비 유형 ↔ 가상 모델 매핑', () => {
  assert.deepEqual(
    HRSG_CLASSES.map((h) => [h.label, h.demoCapacityMw, h.demoModel]),
    [
      ['F-class', 150, 'DEMO-GT-150'],
      ['J-class', 270, 'DEMO-GT-270'],
    ],
  );
});

/* ---- 케이스 저장 구조 ---------------------------------------------------------- */
test('케이스 복제는 깊은 복사 — 한쪽 변경이 다른 쪽에 영향 없음', () => {
  let s = defaultStore('A');
  const a = s.cases[0].id;
  s = duplicateCase(s, a, 'B');
  const b = s.currentCaseId;
  assert.notEqual(a, b);
  s = updateCaseIn(s, b, (c) => ({ ...c, calc: { ...c.calc, raw: { ...c.calc.raw, currentBp: '999' } } }));
  s = updateCaseIn(s, b, (c) => ({ ...c, checklist: { ...c.checklist, reviewed: { ...c.checklist.reviewed, 'a-gt-load': true } } }));
  const A = s.cases.find((c) => c.id === a)!;
  const B = s.cases.find((c) => c.id === b)!;
  assert.equal(A.calc.raw.currentBp, '320');
  assert.equal(B.calc.raw.currentBp, '999');
  assert.equal(A.checklist.reviewed['a-gt-load'], false);
  assert.equal(B.checklist.reviewed['a-gt-load'], true);
});

test('케이스 추가·이름 변경·삭제 규칙 (마지막 케이스는 삭제 불가)', () => {
  let s = defaultStore('A');
  assert.equal(deleteCase(s, s.cases[0].id), s);
  s = addCase(s, 'B');
  const b = s.currentCaseId;
  s = renameCase(s, b, '  새 이름  ');
  assert.equal(s.cases.find((c) => c.id === b)!.name, '새 이름');
  assert.equal(renameCase(s, b, '   '), s);
  s = deleteCase(s, b);
  assert.equal(s.cases.length, 1);
  assert.equal(s.currentCaseId, s.cases[0].id);
});

test('localStorage 직렬화 왕복 · 손상 데이터 · 미래 버전 · 구버전 보정', () => {
  const s = defaultStore('A');
  const back = parseStore(serializeStore(s));
  assert.equal(back.kind, 'ok');
  if (back.kind === 'ok') {
    assert.equal(back.store.cases[0].calc.raw.currentBp, '320');
    assert.equal(back.migrated, false);
  }
  assert.deepEqual(parseStore(null), { kind: 'empty' });
  assert.deepEqual(parseStore('{bad'), { kind: 'invalid', reason: 'json' });
  assert.deepEqual(parseStore(JSON.stringify({ version: 99, cases: [] })), { kind: 'invalid', reason: 'newer-version' });
  const legacy = parseStore(JSON.stringify({ cases: [{ id: 'x', name: 'old', checklist: { status: { 'a-gt-load': 'bogus' } } }] }));
  assert.equal(legacy.kind, 'ok');
  if (legacy.kind === 'ok') {
    assert.equal(legacy.migrated, true);
    const c = legacy.store.cases[0];
    assert.equal(Object.keys(c.checklist.status).length, 22);
    assert.equal(c.checklist.status['a-gt-load'], 'noMeasured'); // 알 수 없는 값은 버림
    assert.equal(c.calc.raw.smp, '140'); // 누락 입력은 기본값
  }
});

/* ---- 체크리스트 통계 ------------------------------------------------------------- */
test('수령률과 검토율은 독립 · 검증 필요는 수령으로 집계 · 필수 충족은 수령 완료만', () => {
  const status = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, 'noMeasured' as ReceiptStatus]));
  const reviewed = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, false]));
  status['a-gt-load'] = 'received';
  status['a-exh-flow'] = 'needsVerification';
  reviewed['c-maint'] = true;
  const p = computeProgress(reviewed, status);
  assert.equal(p.receivedCount, 2);
  assert.equal(p.reviewedCount, 1);
  assert.equal(computeProgress(reviewed, status, 'A').receivedCount, 2);
  assert.equal(computeProgress(reviewed, status, 'C').reviewedCount, 1);
  const all = Object.fromEntries(REQUIRED_ITEM_IDS.map((id) => [id, 'received' as ReceiptStatus]));
  const r1 = computeReadiness(reviewed, { ...status, ...all });
  assert.equal(r1.requiredMet, true);
  assert.equal(r1.evaluable, false); // 검토 전
  const r2 = computeReadiness({ ...reviewed, ...Object.fromEntries(REQUIRED_ITEM_IDS.map((id) => [id, true])) }, { ...status, ...all });
  assert.equal(r2.evaluable, true);
  assert.equal(computeReadiness(reviewed, { ...status, ...all, 'b-bp-dp': 'needsVerification' }).requiredMet, false);
});

test('DEMO 경보 규칙 — 정의된 규칙만 집계', () => {
  assert.equal(activeAlarms({ currentBp: 320, scenario: 'alarm' }).length, 1);
  assert.equal(activeAlarms({ currentBp: 255, scenario: 'normal' }).length, 0);
  assert.equal(activeAlarms({ currentBp: 360, scenario: 'trip' }).length, 2);
  assert.equal(activeAlarms({ currentBp: null, scenario: 'custom' }).length, 0);
});

/* ---- AI 답변 인용 규칙 ------------------------------------------------------------ */
function ctxFrom(calc: CalcCaseState, lang: 'ko' | 'en' = 'ko', snapshot?: AnalysisSnapshot): AnswerContext {
  const d = deriveCalculator(calc);
  const status = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, 'noMeasured' as ReceiptStatus]));
  const reviewed = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, false]));
  const checklist = { status, reviewed, summary: computeProgress(reviewed, status), readiness: computeReadiness(reviewed, status) } as unknown as ChecklistState;
  const state = { ...d, mode: calc.mode, scenario: calc.scenario, hrsgClass: calc.hrsgClass, raw: calc.raw, edited: calc.edited } as unknown as CalculatorState;
  return { lang, calc: state, checklist, measurements: { entries: [] } as unknown as MeasurementState, snapshot };
}

test('모든 추천 답변: 구조 6요소 · 검증된 출처 미등록 · 체크리스트 항목 id 유효', () => {
  for (const p of QA_PRESETS) {
    for (const lang of ['ko', 'en'] as const) {
      const a = buildAnswer(p.id, ctxFrom(defaultCalc(), lang));
      assert.ok(a.summary.length > 0, p.id);
      assert.ok(a.sources.includes('unregistered'), p.id);
      assert.ok(a.links.length > 0, p.id);
      for (const n of a.needs) assert.ok(CHECKLIST_ITEMS.some((i) => i.id === n.itemId), `${p.id}:${n.itemId}`);
    }
  }
});

test('AI 수치 인용: 유효 결과만 · 무효 입력이면 숫자 없음 · 사용자 모드는 모델 미연동', () => {
  const ok = buildAnswer('bpImpact', ctxFrom(defaultCalc()));
  assert.ok(ok.facts.some((f) => f.value === '105,840,000 원'));
  const bad = buildAnswer('bpImpact', ctxFrom(calcWith({ currentBp: 'x' })));
  const monthly = bad.facts.find((f) => f.label.includes('월간'))!;
  assert.equal(monthly.value, '—');
  assert.equal(monthly.status, '산출 불가');
  const user = buildAnswer('bpImpact', ctxFrom({ ...defaultCalc(), mode: 'user' }));
  assert.equal(user.facts.find((f) => f.label.includes('월간'))!.status, '모델 미연동 · 평가 보류');
});

test('결과 스냅샷 해설: 입력이 바뀐 뒤에는 스냅샷 수치를 인용하지 않는다', () => {
  const d = deriveCalculator(defaultCalc());
  const snap: AnalysisSnapshot = {
    id: 's1', seq: 1, createdAt: new Date('2026-10-20T00:00:00Z').toISOString(), mode: 'demo', scenario: 'alarm', hrsgClass: 'F',
    model: d.model, inputsKey: d.inputsKey, inputs: d.values,
    bp: { deltaBp: 70, powerLossMw: 1.05, monthlyLossKrw: 105_840_000, level: 'danger' }, cleaning: d.cleaning,
  };
  const fresh = buildAnswer('resultSummary', ctxFrom(defaultCalc(), 'ko', snap));
  assert.ok(fresh.facts.some((f) => f.value === '105,840,000 원'));
  assert.equal(fresh.factsNotice, undefined);
  const stale = buildAnswer('resultSummary', ctxFrom(calcWith({ currentBp: '300' }), 'ko', snap));
  assert.equal(stale.facts.length, 0);
  assert.ok(stale.factsNotice?.includes('인용하지 않습니다'));
});

test('미등록 질문 안내 문구 · 이메일 초안 고객사·단위·조건', () => {
  assert.equal(QA_FALLBACK_TEXT.ko, '확인 가능한 공학 데이터 범위를 벗어났습니다. 추천 질문을 이용하시거나 계산기 화면을 확인해 주세요.');
  const items = CHECKLIST_ITEMS.filter((i) => i.id === 'b-bp-dp');
  const e = buildRequestEmail(items, 'ko', { clientName: '시연발전소', meta: { 'b-bp-dp': { unit: 'mmH₂O', condition: '정격 부하 1시간 평균' } } });
  assert.ok(e.subject.includes('시연발전소'));
  assert.ok(e.body.includes('필요 단위: mmH₂O') && e.body.includes('측정 조건: 정격 부하 1시간 평균'));
  assert.ok(buildRequestEmail(items, 'ko').subject.includes('[고객사/발전소명]'));
});
