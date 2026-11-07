import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendToActive,
  appendToConversation,
  defaultCalc,
  defaultStore,
  deleteConversation,
  parseStore,
  serializeStore,
  type QaCaseState,
} from '@/lib/caseStore';
import { deriveCalculator } from '@/lib/calculatorModel';
import { computeProgress, computeReadiness } from '@/lib/checklistStats';
import {
  CONTEXT_LIMITS,
  buildBeforeAfterContext,
  buildCalculatorContext,
  buildChecklistContext,
  buildDashboardContext,
  clampContext,
  contextToText,
} from '@/lib/aiContext';
import { contextPayload } from '@/lib/ragClient';
import { findUnsupportedNumbers, maskSensitive } from '@/lib/privacy';
import { parseBlocks } from '@/components/assistant/Markdown';
import { citedRanks } from '@/components/assistant/SourceCards';
import { ASK_DRAFT, ASSISTANT_SUGGESTIONS } from '@/data/assistantPrompts';
import { CHECKLIST_ITEMS } from '@/data/checklistItems';
import type { KitProgress } from '@/lib/kit';

const empty: QaCaseState = { conversations: [], activeId: null };
const q = (text: string) => (n: number, at: string) => [{ id: n, at, kind: 'question' as const, text }];

/* ---- 대화 관리 ---------------------------------------------------------------- */
test('[대화] 첫 질문은 미리 정한 id 로 새 대화를 만들고 제목을 붙인다', () => {
  const s = appendToActive(empty, q('배압이 오르면 출력이 왜 떨어져?'), new Date('2026-11-05T00:00:00Z'), 'conv-a');
  assert.equal(s.activeId, 'conv-a');
  assert.equal(s.conversations.length, 1);
  assert.equal(s.conversations[0].title, '배압이 오르면 출력이 왜 떨어져?');
  // 같은 대화에 이어서 질문
  const s2 = appendToActive(s, q('세정 공법은?'), new Date(), 'unused');
  assert.equal(s2.conversations.length, 1);
  assert.equal(s2.conversations[0].messages.length, 2);
  assert.deepEqual(s2.conversations[0].messages.map((m) => m.id), [1, 2]);
});

test('[대화] 답변은 질문한 대화에 들어간다 — 그 사이 새 대화로 바꿔도 섞이지 않는다', () => {
  let s = appendToActive(empty, q('A 질문'), new Date(), 'conv-a');
  s = { ...s, activeId: null }; // 새 대화 버튼
  s = appendToActive(s, q('B 질문'), new Date(), 'conv-b');
  s = appendToConversation(s, 'conv-a', (n, at) => [{ id: n, at, kind: 'error', reason: 'server', question: 'A 질문' }]);
  const a = s.conversations.find((c) => c.id === 'conv-a')!;
  const b = s.conversations.find((c) => c.id === 'conv-b')!;
  assert.equal(a.messages.length, 2);
  assert.equal(b.messages.length, 1);
  assert.equal(s.activeId, 'conv-b');
  // 삭제된 대화에 늦게 온 답변은 버린다
  const d = deleteConversation(s, 'conv-a');
  assert.equal(appendToConversation(d, 'conv-a', q('x')), d);
  assert.equal(deleteConversation(s, 'conv-b').activeId, null);
});

test('[대화] 케이스마다 대화 목록이 따로 저장되고 직렬화 왕복된다', () => {
  let store = defaultStore('A');
  store = {
    ...store,
    cases: store.cases.map((c) => ({ ...c, qa: appendToActive(c.qa, q('저장 확인'), new Date(), 'conv-x') })),
  };
  const back = parseStore(serializeStore(store));
  assert.equal(back.kind, 'ok');
  if (back.kind === 'ok') {
    assert.equal(back.store.cases[0].qa.activeId, 'conv-x');
    assert.equal(back.store.cases[0].qa.conversations[0].messages[0].kind, 'question');
  }
});

test('[대화] 버전 3 의 단일 대화(messages)는 대화 목록의 첫 대화로 옮겨진다', () => {
  const v3 = parseStore(
    JSON.stringify({
      version: 3,
      currentCaseId: 'c1',
      cases: [
        {
          id: 'c1',
          name: 'old',
          qa: {
            messages: [
              { id: 1, at: '2026-11-01T00:00:00Z', kind: 'question', text: '예전 질문' },
              { id: 2, at: '2026-11-01T00:00:01Z', kind: 'fallback' },
            ],
          },
        },
      ],
    }),
  );
  assert.equal(v3.kind, 'ok');
  if (v3.kind === 'ok') {
    const qa = v3.store.cases[0].qa;
    assert.equal(qa.conversations.length, 1);
    assert.equal(qa.conversations[0].id, 'conv-legacy-c1');
    assert.equal(qa.conversations[0].title, '예전 질문');
    assert.equal(qa.conversations[0].messages.length, 2);
    assert.equal(qa.activeId, 'conv-legacy-c1');
  }
});

/* ---- 화면 데이터 스냅샷 -------------------------------------------------------- */
function checklistState() {
  const progress: KitProgress = { 'A-02': { supply: 'verify_needed', value: '305' } };
  const status = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, progress[i.id]?.supply ?? 'not_entered']));
  return { status, summary: computeProgress(progress), readiness: computeReadiness(progress) };
}
const calcIn = () => ({ calc: deriveCalculator(defaultCalc()), mode: 'demo' as const, scenario: 'alarm' as const, stale: false });

test('[화면 연결] 계산기 스냅샷 — 입력·결과·경제성·핀치·공법별 회수 기간', () => {
  const ctx = buildCalculatorContext(calcIn(), 'ko', new Date('2026-11-05T00:00:00Z'));
  assert.equal(ctx.page, 'calculator');
  assert.ok(ctx.items.length <= CONTEXT_LIMITS.items);
  const v = (label: string) => ctx.items.find((i) => i.label === label)?.value;
  // 키트 README 기대값 (어댑터 경유)
  assert.equal(v('현재 배압'), 305.9);
  assert.equal(Math.round((v('발전 출력 손실') as number) * 100) / 100, 1.89);
  assert.equal(v('손익분기 (BEP)'), 93.6);
  assert.equal(v('기준 공법 (회수기간 최단, 추천 아님)'), '드라이아이스 세정');
  assert.ok(ctx.items.some((i) => i.label === '회수 기간 · 고압수 세정' && i.value === 3.3));
  assert.ok(ctx.items.some((i) => i.label.startsWith('Pinch')));
});

test('[화면 연결] 재평가 전이면 스냅샷에 그 상태를 명시한다', () => {
  const ctx = buildDashboardContext({ ...calcIn(), stale: true }, checklistState(), 'ko');
  assert.ok(ctx.items.some((i) => i.label === '계산 상태' && String(i.value).includes('재평가 필요')));
});

test('[화면 연결] 체크리스트 스냅샷 — 누락·검증 필요 항목명만, 측정값·메모·고객사명은 넣지 않는다', () => {
  const ctx = buildChecklistContext(checklistState(), 'ko');
  assert.ok(ctx.items.some((i) => i.label.startsWith('누락 필수 항목 A-01') && i.value === 'GT 모델 및 정격 용량'));
  assert.ok(ctx.items.some((i) => i.label.startsWith('검증 필요 항목 A-02')));
  assert.ok(ctx.items.every((i) => !/memo|메모|고객사/.test(i.label)));
});

test('[화면 연결] 세정 전후 스냅샷 — 실측·운전 조건 편차 경고 포함', () => {
  const ctx = buildBeforeAfterContext(
    calcIn(),
    [
      { id: 1, day: -3, backPressure: 350, exhaustTemp: null },
      { id: 2, day: 5, backPressure: 260, exhaustTemp: null },
    ],
    { beforeLoadPct: '100', afterLoadPct: '90', beforeAmbientC: '', afterAmbientC: '' },
    'ko',
  );
  assert.ok(ctx.items.some((i) => i.label === '실측 최근 배압' && i.value === 260));
  assert.ok(ctx.items.some((i) => i.label === '운전 조건 편차 경고'));
});

test('[보안] 서버로 보내는 페이로드는 라벨·값·단위만 — 한도로 잘린다', () => {
  const long = clampContext(Array.from({ length: 60 }, (_, i) => ({ label: 'x'.repeat(100), value: 'y'.repeat(100), unit: `u${i}` })));
  assert.equal(long.length, CONTEXT_LIMITS.items);
  assert.equal(long[0].label.length, CONTEXT_LIMITS.label);
  assert.equal((long[0].value as string).length, CONTEXT_LIMITS.text);
  const ctx = buildDashboardContext(calcIn(), checklistState(), 'ko');
  const p = contextPayload(ctx);
  assert.deepEqual(Object.keys(p).sort(), ['items', 'page', 'title']);
  assert.ok(p.items.every((i) => Object.keys(i).sort().join() === 'label,unit,value'));
  assert.equal(maskSensitive('경보 서인천발전소 010-1234-5678'), '경보 [마스킹] [마스킹]');
});

test('[환각 가드] 첨부한 화면 수치는 출처 외 수치로 보지 않는다', () => {
  const ctx = buildCalculatorContext(calcIn(), 'ko');
  const loss = ctx.items.find((i) => i.label === '월간 발전 손실액')!.value as number;
  const answer = `앱 계산값 기준 월간 손실은 ${new Intl.NumberFormat('ko-KR').format(loss)}원이고 문헌상 핀치는 8~15 °C입니다 [1].`;
  const passages = ['pinch point typically 8 to 15 K'];
  assert.deepEqual(findUnsupportedNumbers(answer, passages), [String(loss)]);
  assert.deepEqual(findUnsupportedNumbers(answer, [...passages, contextToText(ctx)]), []);
});

/* ---- 렌더링 보조 ---------------------------------------------------------------- */
test('[마크다운] 문단·목록·번호 목록·제목을 나눈다', () => {
  const b = parseBlocks('### 요약\n첫 줄\n둘째 줄\n\n- 가\n- 나\n\n1. 하나\n2. 둘');
  assert.deepEqual(
    b.map((x) => x.kind),
    ['h', 'p', 'ul', 'ol'],
  );
  assert.deepEqual((b[1] as { lines: string[] }).lines, ['첫 줄', '둘째 줄']);
  assert.deepEqual((b[2] as { items: string[] }).items, ['가', '나']);
});

test('[근거] 답변 속 [n] 인용 검증', () => {
  assert.deepEqual([...citedRanks('배압 상승 [1][3], 그리고 [3].')].sort(), [1, 3]);
  assert.equal(citedRanks(null).size, 0);
});

test('[추천 질문] 화면마다 6개 · 첨부 질문 초안 존재', () => {
  for (const tab of ['dashboard', 'calculator', 'checklist', 'validation'] as const) {
    assert.equal(ASSISTANT_SUGGESTIONS[tab].length, 6);
    assert.ok(ASK_DRAFT[tab].ko.includes('첨부'));
  }
  assert.notDeepEqual(ASSISTANT_SUGGESTIONS.dashboard, ASSISTANT_SUGGESTIONS.checklist);
});
