import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VALIDATION_SCENARIO, buildScenarioSeries } from '@/data/validationScenario';
import { CHECKLIST_ITEMS } from '@/data/checklistItems';
import { QA_PRESETS } from '@/data/qaPresets';
import { matchQuestion } from '@/lib/qaMatch';
import { buildRequestEmail, emailBodyToHtml } from '@/lib/emailDraft';
import { KIT_CALC_DATA, KIT_CHECKLIST_DATA } from '@/lib/kit';
import { INPUT_DEF } from '@/data/calculatorInputs';

test('세정 공법은 키트 데이터 4개 (회수율 포함) — 앱에 별도 공법 데이터 없음', () => {
  assert.deepEqual(
    KIT_CALC_DATA.methods.map((m) => [m.id, m.recovery_ratio]),
    [
      ['mechanical', 0.45],
      ['water', 0.6],
      ['dryice', 0.7],
      ['chemical', 0.85],
    ],
  );
});

test('세정 전후 가상 시나리오가 명세와 같다', () => {
  const s = VALIDATION_SCENARIO;
  assert.deepEqual(s.backPressure, { before: 350, after: 255 });
  assert.deepEqual(s.exhaustTemp, { before: 115, after: 104 });
  // 회수 출력·세정 비용은 시나리오가 아니라 계산기 입력(키트 기본값)에서 온다
  assert.equal(INPUT_DEF.recoveredPowerMw.defaultValue, KIT_CALC_DATA.economics.target_recovery_mw);
  assert.equal(INPUT_DEF.cleaningCostKrw.defaultValue, 300_000_000);
  assert.ok(!('dailyNetBenefitKrw' in s) && !('cleaningCostKrw' in s));
});

test('시계열: 세정 전 30일 + 후 60일, 세정일(0) 비움, 결정적', () => {
  const a = buildScenarioSeries();
  assert.equal(a.length, 90);
  assert.equal(a.some((p) => p.day === 0), false);
  assert.deepEqual([a[0].day, a[a.length - 1].day], [-30, 60]);
  assert.deepEqual(buildScenarioSeries(), a);
  assert.ok(a.every((p) => Number.isFinite(p.backPressure) && Number.isFinite(p.exhaustTemp)));
});

test('체크리스트는 키트 49개 항목 (A 6 · B 13 · C 9 · D 3 · E 18, 필수 16), id 중복 없음', () => {
  const count = (c: string) => CHECKLIST_ITEMS.filter((i) => i.category === c).length;
  assert.deepEqual([count('A'), count('B'), count('C'), count('D'), count('E')], [6, 13, 9, 3, 18]);
  assert.equal(CHECKLIST_ITEMS.length, KIT_CHECKLIST_DATA.items.length);
  assert.equal(CHECKLIST_ITEMS.filter((i) => i.required).length, 16);
  assert.equal(new Set(CHECKLIST_ITEMS.map((i) => i.id)).size, CHECKLIST_ITEMS.length);
  // 문서 항목 (키트 README: B-09 측정값 「문서」)
  assert.equal(CHECKLIST_ITEMS.find((i) => i.id === 'B-09')?.kind, 'document');
  // 「핀치」 검색 5건 (키트 filterItems 와 같은 대상: ID·항목명·이유)
  assert.equal(CHECKLIST_ITEMS.filter((i) => `${i.id} ${i.name.ko} ${i.reason.ko}`.includes('핀치')).length, 5);
});

test('질문 매칭: 추천 질문은 정확히, 무관한 질문은 매칭하지 않음', () => {
  assert.equal(QA_PRESETS.length, 14);
  assert.deepEqual(
    ['thermo', 'economics', 'pinch', 'data'].map((c) => QA_PRESETS.filter((p) => p.category === c).length),
    [4, 3, 3, 4],
  );
  for (const p of QA_PRESETS) {
    assert.equal(matchQuestion(p.question.ko, QA_PRESETS)?.id, p.id);
    assert.equal(matchQuestion(p.question.en, QA_PRESETS)?.id, p.id);
  }
  assert.equal(matchQuestion('배압이 오르면 출력이 떨어지나요?', QA_PRESETS)?.id, 'bpImpact');
  const cases: [string, string][] = [
    ['pinch point가 뭐야', 'pinchDef'],
    ['어프로치 포인트 정의', 'approachDef'],
    ['핀치 검토에 필요한 설계 데이터', 'pinchData'],
    ['차압이 오르는 원인', 'dpCause'],
    ['스택 온도가 높으면 무슨 의미야', 'stackTemp'],
    ['파울링이 성능에 주는 영향', 'foulingImpact'],
    ['드라이아이스랑 고압수 차이', 'methodCompare'],
    ['공법별 비용 비교 기준', 'costBasis'],
    ['세정 판단에 필요한 경제성 데이터', 'econData'],
    ['세정 필요성 판단 필수 데이터', 'cleaningNeedData'],
    ['체크리스트 어떻게 활용해', 'checklistUse'],
    ['부족한 데이터 확인', 'missingData'],
    ['세정 전후 효과 검증 자료', 'validationData'],
  ];
  for (const [q, id] of cases) assert.equal(matchQuestion(q, QA_PRESETS)?.id, id, q);
  for (const q of ['오늘 점심 메뉴 추천해줘', '배압', '', 'What is the weather?']) {
    assert.equal(matchQuestion(q, QA_PRESETS), null, q);
  }
});

test('이메일 초안: 선택 항목만 포함, 실제 주소 없음, 필수 구성 포함', () => {
  const sel = CHECKLIST_ITEMS.filter((i) => ['A-01', 'A-02', 'C-05'].includes(i.id));
  for (const lang of ['ko', 'en'] as const) {
    const { body } = buildRequestEmail(sel, lang);
    assert.ok(sel.every((i) => body.includes(i.name[lang])));
    assert.ok(!body.includes(CHECKLIST_ITEMS.find((i) => i.id === 'A-03')!.name[lang]));
    assert.ok(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(body), 'no email address');
    assert.ok(body.includes(`${VALIDATION_SCENARIO.daysBefore}`) && body.includes(`${VALIDATION_SCENARIO.daysAfter}`));
  }
  const ko = buildRequestEmail(sel, 'ko').body;
  for (const part of ['안녕하십니까', '요청 자료 (3건)', '단위 및 기간', '자료 활용 목적', '감사합니다', '[수신자 성함/직함]']) {
    assert.ok(ko.includes(part), part);
  }
});

test('[체크리스트] 이메일 초안은 요청 항목을 마크다운 표로 넣고, HTML 표로도 변환된다', () => {
  const sel = CHECKLIST_ITEMS.filter((i) => ['A-02', 'B-02'].includes(i.id));
  const { body } = buildRequestEmail(sel, 'ko', { meta: { 'A-02': { unit: 'mmH₂O', condition: '정격 | 1시간' } } });
  const rows = body.split('\n').filter((l) => l.startsWith('|'));
  assert.equal(rows.length, 2 + sel.length); // 머리글 + 구분선 + 항목
  assert.ok(rows[2].includes('A-02') && rows[2].includes('mmH₂O'));
  assert.ok(rows[2].includes('정격 \\| 1시간'), 'pipe escaped');
  const html = emailBodyToHtml(body);
  assert.equal((html.match(/<tr>/g) ?? []).length, 1 + sel.length);
  assert.ok(html.includes('<td style="border:1px solid #cbd5e1;padding:4px 8px">정격 | 1시간</td>'));
});

test('키트 상수가 바뀌어도 안내 문구가 따라간다 (문자열 하드코딩 방지)', async () => {
  const { STRINGS_CALC } = await import('@/i18n/calculatorStrings');
  for (const lang of ['ko', 'en'] as const) {
    const s = STRINGS_CALC[lang];
    assert.ok(s.kpiPowerLossNote.includes(String(KIT_CALC_DATA.constants.gt_loss_pct_per_mbar)));
    assert.ok(s.kpiPowerLossNote.includes(String(KIT_CALC_DATA.constants.st_loss_pct_per_c)));
    assert.ok(s.gaugeThresholds(356.9, 418.1).includes('356.9'));
  }
});
