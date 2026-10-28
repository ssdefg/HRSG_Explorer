import { useSyncExternalStore } from 'react';
import type { DataType, Lang } from '@/types';

/* ---------------------------------------------------------------------------
 * AI 질문·답변 기록 저장소
 *  - UI와 분리된 저장 계층. 화면은 useQaHistory()와 qaHistory.* 만 사용한다.
 *  - 실제 저장은 QaHistoryRepository가 맡는다. 지금은 localStorage 구현을 쓰고,
 *    서버 DB로 바꿀 때는 같은 인터페이스의 구현을 setQaHistoryRepository()로 끼운다.
 *  - 답변은 기록 시점에 화면에 표시된 내용 그대로(텍스트) 저장한다.
 *    이후 계산 입력이 바뀌어도 기록된 답변은 바뀌지 않는다.
 * ------------------------------------------------------------------------- */

export interface QaHistoryFact {
  label: string;
  value: string;
  status?: string;
  types: DataType[];
}

export interface QaHistoryBlock {
  title: string;
  caption?: string;
  notice?: string;
  lines?: string[];
  facts?: QaHistoryFact[];
}

export interface QaHistoryAnswer {
  kind: 'answer' | 'fallback' | 'error' | 'rag';
  title: string;
  via?: string;
  blocks: QaHistoryBlock[];
}

export interface QaHistoryRecord {
  id: string;
  /** 대화 메시지와의 연결 키 — 같은 답변이 두 번 기록되지 않게 한다 */
  sourceKey: string;
  caseId: string;
  caseName: string;
  /** 기록 당시 화면 언어 */
  lang: Lang;
  question: string;
  askedAt: string;
  answeredAt: string;
  answer: QaHistoryAnswer;
}

export interface QaHistoryData {
  version: number;
  /** 이 시각 이후에 생성된 답변만 기록한다 (기능 도입 전 대화는 기록 대상 아님) */
  trackingSince: string;
  records: QaHistoryRecord[];
  /** 이미 기록한 답변의 키 — 개별 삭제 후 같은 답변이 다시 기록되지 않게 한다 */
  recordedKeys: string[];
}

/** 저장소 교체 지점 (localStorage → 서버 DB 등) */
export interface QaHistoryRepository {
  /** 저장된 데이터가 없으면 null */
  load(): QaHistoryData | null;
  save(data: QaHistoryData): void;
}

export const QA_HISTORY_KEY = 'hrsg.qaHistory';
export const QA_HISTORY_VERSION = 1;
export const QA_HISTORY_MAX = 200;
const MAX_KEYS = 1000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
/** 최신 질문이 먼저 */
const byNewest = (a: QaHistoryRecord, b: QaHistoryRecord) => (a.askedAt < b.askedAt ? 1 : a.askedAt > b.askedAt ? -1 : 0);

/** 저장된 JSON을 검증해 읽는다. 형식이 맞지 않는 기록은 버린다. */
export function parseQaHistory(raw: string | null): QaHistoryData | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || !Array.isArray(data.records)) return null;
  const records = data.records.filter(
    (r): r is QaHistoryRecord =>
      isObj(r) &&
      isStr(r.id) &&
      isStr(r.question) &&
      isStr(r.askedAt) &&
      isObj(r.answer) &&
      isStr((r.answer as Record<string, unknown>).title) &&
      Array.isArray((r.answer as Record<string, unknown>).blocks),
  );
  return {
    version: QA_HISTORY_VERSION,
    trackingSince: isStr(data.trackingSince) ? data.trackingSince : new Date(0).toISOString(),
    records: records.sort(byNewest),
    recordedKeys: Array.isArray(data.recordedKeys) ? data.recordedKeys.filter(isStr) : records.map((r) => r.sourceKey).filter(isStr),
  };
}

/** 기본 구현: 이 브라우저의 localStorage에만 저장 (서버·다른 사용자와 공유되지 않음) */
export const localStorageQaHistoryRepository: QaHistoryRepository = {
  load() {
    try {
      return parseQaHistory(window.localStorage.getItem(QA_HISTORY_KEY));
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      window.localStorage.setItem(QA_HISTORY_KEY, JSON.stringify(data));
    } catch {
      /* 저장 실패(용량 초과·프라이빗 모드)는 현재 세션 동작에 영향 없음 */
    }
  },
};

/* ---- 메모리 상태 + 구독 ---------------------------------------------------- */
let repo: QaHistoryRepository = localStorageQaHistoryRepository;
let state: QaHistoryData | null = null;
const listeners = new Set<() => void>();

function ensure(): QaHistoryData {
  if (!state) {
    state = repo.load() ?? { version: QA_HISTORY_VERSION, trackingSince: new Date().toISOString(), records: [], recordedKeys: [] };
    // 처음 생성된 경우 기준 시각을 바로 저장해, 새로고침 후에도 이전 대화가 소급 기록되지 않게 한다
    repo.save(state);
  }
  return state;
}

function commit(next: QaHistoryData): void {
  state = next;
  repo.save(next);
  listeners.forEach((l) => l());
}

export const qaHistory = {
  /** 최신순 기록 목록 */
  list(): QaHistoryRecord[] {
    return ensure().records;
  },
  trackingSince(): string {
    return ensure().trackingSince;
  },
  isRecorded(sourceKey: string): boolean {
    return ensure().recordedKeys.includes(sourceKey);
  },
  add(record: QaHistoryRecord): void {
    const cur = ensure();
    if (cur.recordedKeys.includes(record.sourceKey)) return;
    const records = [record, ...cur.records].sort(byNewest).slice(0, QA_HISTORY_MAX);
    const recordedKeys = [...cur.recordedKeys, record.sourceKey].slice(-MAX_KEYS);
    commit({ ...cur, records, recordedKeys });
  },
  remove(id: string): void {
    const cur = ensure();
    commit({ ...cur, records: cur.records.filter((r) => r.id !== id) });
  },
  clear(): void {
    const cur = ensure();
    commit({ ...cur, records: [] });
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/** 저장소 구현 교체 (테스트·향후 DB 연동용). 메모리 상태는 새 저장소에서 다시 읽는다. */
export function setQaHistoryRepository(next: QaHistoryRepository): void {
  repo = next;
  state = null;
  listeners.forEach((l) => l());
}

/** 화면용 훅 — 기록이 바뀌면 다시 그린다 */
export function useQaHistory(): QaHistoryRecord[] {
  return useSyncExternalStore(qaHistory.subscribe, qaHistory.list, qaHistory.list);
}

/** 대화 메시지 → 기록 연결 키 (대화 초기화 후 메시지 번호가 다시 1부터 시작해도 겹치지 않게 시각 포함) */
export function qaSourceKey(caseId: string, messageId: number, at: string): string {
  return `${caseId}:${messageId}:${at}`;
}
