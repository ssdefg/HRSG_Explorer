import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQaHistory,
  qaHistory,
  qaSourceKey,
  setQaHistoryRepository,
  QA_HISTORY_MAX,
  type QaHistoryData,
  type QaHistoryRecord,
  type QaHistoryRepository,
} from '@/lib/qaHistory';

/** localStorage 대신 쓰는 메모리 저장소 — 저장된 JSON 문자열을 그대로 보관해 새로고침을 흉내 낸다 */
function memoryRepo(initial: string | null = null): QaHistoryRepository & { raw: string | null } {
  return {
    raw: initial,
    load() {
      return parseQaHistory(this.raw);
    },
    save(data: QaHistoryData) {
      this.raw = JSON.stringify(data);
    },
  };
}

const rec = (n: number, askedAt: string, question = `질문 ${n}`): QaHistoryRecord => ({
  id: `r${n}`,
  sourceKey: qaSourceKey('case-1', n, askedAt),
  caseId: 'case-1',
  caseName: '기본 케이스',
  lang: 'ko',
  question,
  askedAt,
  answeredAt: askedAt,
  answer: { kind: 'answer', title: `답변 ${n}`, via: '추천 질문', blocks: [{ title: '1. 핵심 개념 및 요약', lines: [`요약 ${n}`] }] },
});

test('질문 기록 · 질문·답변·일시 저장, 최신순 정렬', () => {
  setQaHistoryRepository(memoryRepo());
  qaHistory.add(rec(1, '2026-10-20T01:00:00.000Z'));
  qaHistory.add(rec(3, '2026-10-20T03:00:00.000Z'));
  qaHistory.add(rec(2, '2026-10-20T02:00:00.000Z'));
  const list = qaHistory.list();
  assert.deepEqual(list.map((r) => r.id), ['r3', 'r2', 'r1']);
  assert.equal(list[0].question, '질문 3');
  assert.equal(list[0].answer.blocks[0].lines?.[0], '요약 3');
  assert.equal(list[0].askedAt, '2026-10-20T03:00:00.000Z');
});

test('질문 기록 · 같은 답변은 한 번만, 개별 삭제 후에도 다시 기록되지 않음', () => {
  setQaHistoryRepository(memoryRepo());
  const r = rec(1, '2026-10-20T01:00:00.000Z');
  qaHistory.add(r);
  qaHistory.add({ ...r, id: 'dup' });
  assert.equal(qaHistory.list().length, 1);
  qaHistory.remove('r1');
  assert.equal(qaHistory.list().length, 0);
  assert.equal(qaHistory.isRecorded(r.sourceKey), true);
  qaHistory.add({ ...r, id: 'again' });
  assert.equal(qaHistory.list().length, 0);
});

test('질문 기록 · 개별 삭제는 해당 기록만, 전체 삭제는 모두 제거', () => {
  setQaHistoryRepository(memoryRepo());
  qaHistory.add(rec(1, '2026-10-20T01:00:00.000Z'));
  qaHistory.add(rec(2, '2026-10-20T02:00:00.000Z'));
  qaHistory.add(rec(3, '2026-10-20T03:00:00.000Z'));
  qaHistory.remove('r2');
  assert.deepEqual(qaHistory.list().map((r) => r.id), ['r3', 'r1']);
  qaHistory.clear();
  assert.equal(qaHistory.list().length, 0);
});

test('질문 기록 · 저장소에서 다시 읽으면(새로고침) 그대로 복원', () => {
  const repo = memoryRepo();
  setQaHistoryRepository(repo);
  qaHistory.add(rec(1, '2026-10-20T01:00:00.000Z'));
  qaHistory.add(rec(2, '2026-10-20T02:00:00.000Z'));
  const since = qaHistory.trackingSince();
  // 같은 저장 데이터로 새 세션 시작
  setQaHistoryRepository(memoryRepo(repo.raw));
  assert.deepEqual(qaHistory.list().map((r) => r.id), ['r2', 'r1']);
  assert.equal(qaHistory.trackingSince(), since);
});

test('질문 기록 · 손상된 저장 데이터는 버리고, 형식이 틀린 기록만 제외', () => {
  assert.equal(parseQaHistory(null), null);
  assert.equal(parseQaHistory('{not json'), null);
  assert.equal(parseQaHistory('[]'), null);
  const good = rec(1, '2026-10-20T01:00:00.000Z');
  const parsed = parseQaHistory(JSON.stringify({ version: 1, trackingSince: '2026-10-01T00:00:00.000Z', records: [good, { id: 5 }, 'x'], recordedKeys: [good.sourceKey] }));
  assert.ok(parsed);
  assert.deepEqual(parsed.records.map((r) => r.id), ['r1']);
});

test('질문 기록 · 최대 보관 개수를 넘으면 오래된 기록부터 제외', () => {
  setQaHistoryRepository(memoryRepo());
  for (let i = 0; i < QA_HISTORY_MAX + 5; i += 1) {
    qaHistory.add(rec(i, new Date(Date.UTC(2026, 9, 20, 0, 0, i)).toISOString()));
  }
  const list = qaHistory.list();
  assert.equal(list.length, QA_HISTORY_MAX);
  assert.equal(list[0].id, `r${QA_HISTORY_MAX + 4}`);
});

test('질문 기록 · 연결 키는 대화 초기화 후 같은 메시지 번호와 겹치지 않음', () => {
  assert.notEqual(qaSourceKey('c', 1, '2026-10-20T01:00:00.000Z'), qaSourceKey('c', 1, '2026-10-20T02:00:00.000Z'));
});
