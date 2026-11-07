import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveCalculator } from '@/lib/calculatorModel';
import {
  STORE_KEY,
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
import { computeProgress, computeReadiness, statusNeedsValue } from '@/lib/checklistStats';
import { validateProgress } from '@/lib/checklist_adapter';
import { kitLossAtBp } from '@/lib/calc_adapter';
import { activeAlarms } from '@/lib/alarms';
import { buildAnswer, type AnswerContext } from '@/components/qa/answers';
import type { CalculatorState, ChecklistState, MeasurementState, AnalysisSnapshot } from '@/context/Workspace';
import { QA_FALLBACK_TEXT, QA_PRESETS } from '@/data/qaPresets';
import { CHECKLIST_ITEMS, REQUIRED_ITEM_IDS } from '@/data/checklistItems';
import { HRSG_CLASSES } from '@/data/calculatorInputs';
import { buildRequestEmail } from '@/lib/emailDraft';
import type { KitProgress } from '@/lib/kit';
import { MASK, findUnsupportedNumbers, maskSensitive } from '@/lib/privacy';
import { assessConditionDeviation } from '@/lib/conditions';
import { buildActualPerformanceGap, buildCalcSummaryKpi, buildMethodPaybacks, buildStepProgress } from '@/lib/dashboardModel';

const calcWith = (patch: Partial<Record<string, string>>, mode: 'demo' | 'user' = 'demo'): CalcCaseState => {
  const c = defaultCalc();
  return { ...c, mode, raw: { ...c.raw, ...patch } as CalcCaseState['raw'] };
};
const won = (v: number | null) => `${new Intl.NumberFormat('ko-KR').format(v ?? 0)} 원`;

/* ---- 계산기 파생 모델 (키트 경유) --------------------------------------------------- */
test('DEMO · 사용자 입력 모드 모두 키트 계산식 — 같은 입력이면 같은 결과', () => {
  const demo = deriveCalculator(defaultCalc());
  const user = deriveCalculator({ ...defaultCalc(), mode: 'user' });
  assert.equal(demo.metrics.monthlyLossKrw.status, 'ok');
  assert.equal(user.metrics.powerLossMw.value, demo.metrics.powerLossMw.value);
  assert.equal(demo.model, 'F-Class GT (Mock)');
});

test('잘못된 입력 — 핵심 입력은 키트 결과 전체, 공법 입력은 그 공법만 「산출 불가」', () => {
  const empty = deriveCalculator(calcWith({ smp: '' }));
  assert.equal(empty.errors.smp, 'empty');
  assert.equal(empty.metrics.monthlyIncrementalBenefitKrw.status, 'invalid');
  const neg = deriveCalculator(calcWith({ cleaningCostKrw: '-5' }));
  assert.equal(neg.errors.cleaningCostKrw, 'negative');
  assert.equal(neg.metrics.powerLossMw.status, 'ok');
  assert.equal(neg.kit.methods.find((m) => m.id === 'dryice')!.available, false);
  const comma = deriveCalculator(calcWith({ cleaningCostKrw: '300,000,000' }));
  assert.equal(comma.values.cleaningCostKrw, 300_000_000);
  // 선택 입력(설계 핀치값)은 비워도 오류가 아니다
  assert.equal(deriveCalculator(defaultCalc()).errors.designPinch, null);
});

test('입력이 바뀌면 inputsKey도 바뀐다 (스냅샷 최신 여부 판별)', () => {
  assert.notEqual(deriveCalculator(defaultCalc()).inputsKey, deriveCalculator(calcWith({ currentBp: '321' })).inputsKey);
  assert.equal(deriveCalculator(defaultCalc()).inputsKey, deriveCalculator(defaultCalc()).inputsKey);
});

test('GT 등급 ↔ 키트 등급 매핑 (F/H/E)', () => {
  assert.deepEqual(
    HRSG_CLASSES.map((h) => [h.label, h.demoCapacityMw, h.demoModel]),
    [
      ['F-Class', 270, 'F-Class GT (Mock)'],
      ['H-Class', 400, 'H-Class GT (Mock)'],
      ['E-Class', 170, 'E-Class GT (Mock)'],
    ],
  );
  const h = deriveCalculator({ ...calcWith({ capacityMw: '400' }), hrsgClass: 'H' });
  assert.equal(h.kit.run.inp.equipment.gt_class, 'H');
  assert.equal(h.kit.run.errors.length, 0);
});

/* ---- 케이스 저장 구조 ---------------------------------------------------------- */
test('케이스 복제는 깊은 복사 — 한쪽 변경이 다른 쪽에 영향 없음', () => {
  let s = defaultStore('A');
  const a = s.cases[0].id;
  s = duplicateCase(s, a, 'B');
  const b = s.currentCaseId;
  assert.notEqual(a, b);
  s = updateCaseIn(s, b, (c) => ({ ...c, calc: { ...c.calc, raw: { ...c.calc.raw, currentBp: '999' } } }));
  s = updateCaseIn(s, b, (c) => ({ ...c, checklist: { ...c.checklist, progress: { ...c.checklist.progress, 'A-01': { reviewed: true } } } }));
  const A = s.cases.find((c) => c.id === a)!;
  const B = s.cases.find((c) => c.id === b)!;
  assert.equal(A.calc.raw.currentBp, '305.9');
  assert.equal(B.calc.raw.currentBp, '999');
  assert.equal(A.checklist.progress['A-01'], undefined);
  assert.equal(B.checklist.progress['A-01']?.reviewed, true);
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
    assert.equal(back.store.cases[0].calc.raw.currentBp, '305.9');
    assert.equal(back.migrated, false);
    assert.deepEqual(back.store.cases[0].checklist.progress, {});
  }
  assert.deepEqual(parseStore(null), { kind: 'empty' });
  assert.deepEqual(parseStore('{bad'), { kind: 'invalid', reason: 'json' });
  assert.deepEqual(parseStore(JSON.stringify({ version: 99, cases: [] })), { kind: 'invalid', reason: 'newer-version' });
  // 버전 2 데이터: 사용자가 직접 바꾼 입력만 옮기고 나머지는 새(키트) 기본값. 예전 J 등급은 기본 등급으로
  const v2 = parseStore(
    JSON.stringify({
      version: 2,
      currentCaseId: 'y',
      cases: [{ id: 'y', name: 'v2', calc: { hrsgClass: 'J', raw: { currentBp: '320', smp: '150' }, edited: { smp: true } } }],
    }),
  );
  assert.equal(v2.kind, 'ok');
  if (v2.kind === 'ok') {
    const c = v2.store.cases[0];
    assert.equal(c.calc.raw.currentBp, '305.9');
    assert.equal(c.calc.raw.smp, '150');
    assert.equal(c.calc.hrsgClass, 'F');
    assert.equal(c.calc.stale, false);
    assert.deepEqual(c.conditions, { beforeLoadPct: '', afterLoadPct: '', beforeAmbientC: '', afterAmbientC: '' });
  }
});

test('체크리스트 이전: 버전 4 이하 status·reviewed·notes·meta → 키트 progress (알 수 없는 값은 버림)', () => {
  const v4 = parseStore(
    JSON.stringify({
      version: 4,
      currentCaseId: 'x',
      cases: [
        {
          id: 'x',
          name: 'old',
          checklist: {
            status: { 'A-01': 'received', 'A-02': 'needsVerification', 'A-03': 'bogus', 'Z-99': 'received' },
            reviewed: { 'A-01': true },
            notes: { 'A-02': '메모' },
            meta: { 'A-01': { value: '270', unit: 'MW', location: 'GT', condition: '', measuredAt: '' } },
            clientName: '시연',
          },
        },
      ],
    }),
  );
  assert.equal(v4.kind, 'ok');
  if (v4.kind === 'ok') {
    const cl = v4.store.cases[0].checklist;
    assert.deepEqual(cl.progress, {
      'A-01': { supply: 'received', reviewed: true, value: '270' },
      'A-02': { supply: 'verify_needed', note: '메모' },
    });
    assert.equal(cl.ext['A-01'].location, 'GT');
    assert.equal(cl.clientName, '시연');
    assert.ok(validateProgress(cl.progress).ok);
  }
});

test('저장 키는 가이드 §1.3 의 hrsg_explorer_v1_cases', () => {
  assert.equal(STORE_KEY, 'hrsg_explorer_v1_cases');
});

/* ---- 체크리스트 통계 (키트 kpis) ------------------------------------------------------ */
test('[키트 기대값] 체크리스트 처음 상태 · A-01 수령 완료 · 해당 없음 분모 제외 · 필수 충족', () => {
  const empty: KitProgress = {};
  const p0 = computeProgress(empty);
  assert.deepEqual([p0.receivedPct, p0.receivedCount, p0.total], [0, 0, 49]);
  assert.equal(p0.byStatus.not_entered, 49);
  assert.equal(REQUIRED_ITEM_IDS.length, 16);
  assert.equal(computeReadiness(empty).missingIds.length, 16);

  const one: KitProgress = { 'A-01': { supply: 'received', value: '270' } };
  const p1 = computeProgress(one);
  assert.deepEqual([p1.receivedPct, p1.receivedCount, p1.total], [2, 1, 49]); // 「수령률 2% (1/49)」

  const na: KitProgress = { 'E-02': { supply: 'na' } };
  assert.equal(computeProgress(na).total, 48);

  const allReq: KitProgress = Object.fromEntries(REQUIRED_ITEM_IDS.map((id) => [id, { supply: 'verify_needed', value: 'x' }]));
  const r1 = computeReadiness(allReq);
  assert.equal(r1.requiredMet, true); // 검증 필요도 수령으로 본다 (키트 isSatisfied)
  assert.equal(r1.evaluable, false); // 검토 전 (앱 기준)
  const reviewedAll = Object.fromEntries(REQUIRED_ITEM_IDS.map((id) => [id, { supply: 'received' as const, value: 'x', reviewed: true }]));
  assert.equal(computeReadiness(reviewedAll).evaluable, true);
  // 검증 실패는 필수 충족이 아니다
  assert.equal(computeReadiness({ ...allReq, 'A-01': { supply: 'received', value: 'x', verify: 'failed' } }).requiredMet, false);
  assert.equal(computeProgress(allReq, 'A').receivedCount, 5);
});

test('[키트] 화면 글자를 그대로 저장한 상태는 validateProgress 오류', () => {
  const bad = validateProgress({ 'A-01': { supply: '수령 완료' as never } });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors[0].includes('"received"'));
});

test('DEMO 경보 규칙 — 키트 GT 배압 구간 기준', () => {
  const bands = deriveCalculator(defaultCalc()).bands!;
  assert.equal(activeAlarms({ currentBp: bands.caution, scenario: 'alarm', bands }).length, 1);
  assert.equal(activeAlarms({ currentBp: 300, scenario: 'normal', bands }).length, 0);
  assert.equal(activeAlarms({ currentBp: bands.danger, scenario: 'trip', bands }).length, 2);
  assert.equal(activeAlarms({ currentBp: null, scenario: 'custom', bands: null }).length, 0);
});

/* ---- AI 답변 인용 규칙 (이전 버전 답변 표시) ------------------------------------------- */
function ctxFrom(calc: CalcCaseState, lang: 'ko' | 'en' = 'ko', snapshot?: AnalysisSnapshot): AnswerContext {
  const d = deriveCalculator(calc);
  const progress: KitProgress = {};
  const status = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, 'not_entered']));
  const reviewed = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, false]));
  const checklist = { progress, status, reviewed, summary: computeProgress(progress), readiness: computeReadiness(progress) } as unknown as ChecklistState;
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

test('AI 수치 인용: 유효 결과만 · 무효 입력이면 숫자 없음', () => {
  const expected = won(deriveCalculator(defaultCalc()).metrics.monthlyLossKrw.value);
  const ok = buildAnswer('bpImpact', ctxFrom(defaultCalc()));
  assert.ok(ok.facts.some((f) => f.value === expected), expected);
  const bad = buildAnswer('bpImpact', ctxFrom(calcWith({ currentBp: 'x' })));
  const monthly = bad.facts.find((f) => f.label.includes('월간'))!;
  assert.equal(monthly.value, '—');
  assert.equal(monthly.status, '산출 불가');
});

test('결과 스냅샷 해설: 입력이 바뀐 뒤에는 스냅샷 수치를 인용하지 않는다', () => {
  const d = deriveCalculator(defaultCalc());
  const snap: AnalysisSnapshot = {
    id: 's1', seq: 1, createdAt: new Date('2026-10-20T00:00:00Z').toISOString(), mode: 'demo', scenario: 'alarm', hrsgClass: 'F',
    model: d.model, inputsKey: d.inputsKey, inputs: d.values,
    bp: { deltaBp: d.metrics.deltaBp.value, powerLossMw: d.metrics.powerLossMw.value, monthlyLossKrw: d.metrics.monthlyLossKrw.value, level: d.level },
    cleaning: d.cleaning,
  };
  const fresh = buildAnswer('resultSummary', ctxFrom(defaultCalc(), 'ko', snap));
  assert.ok(fresh.facts.some((f) => f.value === won(d.metrics.monthlyLossKrw.value)));
  assert.equal(fresh.factsNotice, undefined);
  const stale = buildAnswer('resultSummary', ctxFrom(calcWith({ currentBp: '300' }), 'ko', snap));
  assert.equal(stale.facts.length, 0);
  assert.ok(stale.factsNotice?.includes('인용하지 않습니다'));
});

test('미등록 질문 안내 문구 · 이메일 초안 고객사·단위·조건 · D/E 카테고리 포함', () => {
  assert.equal(QA_FALLBACK_TEXT.ko, '확인 가능한 공학 데이터 범위를 벗어났습니다. 추천 질문을 이용하시거나 계산기 화면을 확인해 주세요.');
  const items = CHECKLIST_ITEMS.filter((i) => ['A-02', 'D-01', 'E-01'].includes(i.id));
  const e = buildRequestEmail(items, 'ko', { clientName: '시연발전소', meta: { 'A-02': { unit: 'mmH₂O', condition: '정격 부하 1시간 평균' } } });
  assert.ok(e.subject.includes('시연발전소'));
  const row = e.body.split('\n').find((l) => l.includes('| A-02 |'))!;
  assert.ok(row.includes('mmH₂O') && row.includes('정격 부하 1시간 평균'));
  assert.ok(e.body.includes('| D-01 |') && e.body.includes('| E-01 |'));
  assert.ok(buildRequestEmail(items, 'ko').subject.includes('[고객사/발전소명]'));
});

/* ---- 검수 항목 ------------------------------------------------------------------------ */
test('[체크리스트] 실측값 없이 수령 완료·검증 필요로 바꿀 수 없다 (가드레일)', () => {
  assert.equal(statusNeedsValue('received'), true);
  assert.equal(statusNeedsValue('verify_needed'), true);
  assert.equal(statusNeedsValue('requested'), false);
  assert.equal(statusNeedsValue('not_entered'), false);
  assert.equal(statusNeedsValue('na'), false);
});

test('[계산기] 현재 배압 < 기준 배압이면 경고 · GT 배압 초과분 0 (HRSG 차압 초과분은 그대로)', () => {
  const d = deriveCalculator(calcWith({ currentBp: '200' }));
  assert.equal(d.warnings.bpBelowBaseline, true);
  assert.equal(Math.round(d.metrics.deltaBp.value! * 10) / 10, 51.0); // 차압 30 − 설계 25 mbar
  assert.equal(d.valid, true);
  assert.equal(deriveCalculator(defaultCalc()).warnings.bpBelowBaseline, false);
});

test('[보안] 전화번호·이메일·발전소 고유 명칭 마스킹', () => {
  const q = '서인천발전소 배압 문의 010-1234-5678, kim@plant.co.kr / 02-555-1234';
  const m = maskSensitive(q);
  assert.ok(!m.includes('010-1234-5678') && !m.includes('kim@plant.co.kr') && !m.includes('02-555-1234'));
  assert.ok(!m.includes('서인천발전소'));
  assert.ok(m.includes(MASK) && m.includes('배압 문의'));
  // 일반 명사·공학 수치는 그대로
  assert.equal(maskSensitive('복합화력발전소 HRSG 배압 350 mmH2O, 2026-11-04'), '복합화력발전소 HRSG 배압 350 mmH2O, 2026-11-04');
  assert.equal(maskSensitive('Riverside Power Plant pinch'), `${MASK} pinch`);
  assert.equal(maskSensitive('고객사 시연전력 확인', ['시연전력']), `고객사 ${MASK} 확인`);
});

test('[보안] 환각 가드 — 검색 문맥에 없는 수치를 찾는다', () => {
  const ctx = ['Pinch point is typically 8 to 15 °C.', 'Back pressure rose by 1,200 Pa.'];
  assert.deepEqual(findUnsupportedNumbers('핀치는 8~15 °C [1], 배압 1200 Pa 상승 [2].', ctx), []);
  assert.deepEqual(findUnsupportedNumbers('효율이 3.5% 떨어지고 출력이 42 MW 감소 [1].', ctx), ['3.5', '42']);
});

test('[세정전후] 부하율 편차 5 %p 또는 외기온도 편차 5 °C 초과 시 경고', () => {
  assert.equal(assessConditionDeviation({ beforeLoadPct: '100', afterLoadPct: '94', beforeAmbientC: '', afterAmbientC: '' }).exceeded, true);
  assert.equal(assessConditionDeviation({ beforeLoadPct: '100', afterLoadPct: '96', beforeAmbientC: '-3', afterAmbientC: '1' }).exceeded, false);
  assert.equal(assessConditionDeviation({ beforeLoadPct: '', afterLoadPct: '', beforeAmbientC: '-3', afterAmbientC: '3' }).exceeded, true);
  assert.equal(assessConditionDeviation({ beforeLoadPct: '', afterLoadPct: '', beforeAmbientC: '', afterAmbientC: '' }).loadDiff, null);
});

test('[대시보드] KPI·공법 회수 기간(키트)·실측 갭·4단계 진행률', () => {
  const d = deriveCalculator(defaultCalc());
  const k = buildCalcSummaryKpi(d);
  assert.equal(k.backPressure, 305.9);
  assert.equal(Math.round(k.lossMW! * 100) / 100, 1.89);
  assert.equal(Math.round(k.recoveryBenefitPct! * 100) / 100, Math.round((d.metrics.recoveredMw.value! / 270) * 10000) / 100);
  const methods = buildMethodPaybacks(d);
  assert.deepEqual(methods.map((m) => m.method.id), ['mechanical', 'water', 'dryice', 'chemical']);
  assert.equal(methods.find((m) => m.method.id === 'dryice')!.paybackMonths, d.kit.methods.find((m) => m.id === 'dryice')!.payback_months);
  // 실측 배압으로 키트 손실을 다시 계산 — 세정 전 평균 450 mmH₂O, 현재 270 mmH₂O
  const gap = buildActualPerformanceGap(
    [
      { id: 1, day: -5, backPressure: 450, exhaustTemp: 95 },
      { id: 2, day: 0, backPressure: 260, exhaustTemp: 90 },
      { id: 3, day: 30, backPressure: 270, exhaustTemp: null },
    ],
    d,
    20,
  );
  assert.equal(gap.d0BackPressure, 260);
  assert.equal(gap.currentBackPressure, 270);
  assert.equal(gap.currentStackTemp, 90);
  const expected = kitLossAtBp(d.kit.run, 450)! - kitLossAtBp(d.kit.run, 270)!;
  assert.equal(gap.actualRecoveryMW, Math.round(expected * 1e6) / 1e6);
  assert.ok(gap.actualRecoveryMW! > 0);
  assert.equal(gap.bepAchieved, true);
  assert.equal(buildActualPerformanceGap([], d, 20).d0BackPressure, null);
  const steps = buildStepProgress({ requiredMet: false, calcValid: true, calcStale: true, snapshots: 1, aiMessages: 0 });
  assert.deepEqual(steps, { data: false, simulation: false, analysis: true, ai: false });
});
