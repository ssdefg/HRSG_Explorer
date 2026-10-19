import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ReceiptStatus, ReviewStatus } from '@/types';
import { useCalculatorState, type CalculatorState } from '@/lib/useCalculatorState';
import { calcRatioPct } from '@/lib/calc';
import { CHECKLIST_ITEMS } from '@/data/checklistItems';
import { REVIEW_CATEGORIES } from '@/data/reviewItems';
import { QA_PRESETS, type QaAnswerId } from '@/data/qaPresets';
import { matchQuestion } from '@/lib/qaMatch';

/**
 * 탭 간에 공유되는 작업 상태.
 * 백엔드·영구 저장소가 없으므로 모든 상태는 현재 브라우저 탭의 메모리에만 있고,
 * 새로고침하면 초기화되며 다른 사용자와 공유되지 않는다.
 */

/* ---- 계산기 ---------------------------------------------------------------- */
const CalculatorCtx = createContext<CalculatorState | null>(null);

export function useCalculator(): CalculatorState {
  const v = useContext(CalculatorCtx);
  if (!v) throw new Error('useCalculator must be used within WorkspaceProvider');
  return v;
}

/* ---- 데이터 요청 체크리스트 -------------------------------------------------- */
export interface ChecklistState {
  /** 검토 여부 — 체크박스. 수령 상태와 무관하다. */
  reviewed: Record<string, boolean>;
  /** 수령 상태 — 기본 '실측 데이터 미입력' */
  status: Record<string, ReceiptStatus>;
  notes: Record<string, string>;
  setReviewed: (id: string, v: boolean) => void;
  setStatus: (id: string, s: ReceiptStatus) => void;
  setNote: (id: string, note: string) => void;
  summary: {
    total: number;
    reviewedCount: number;
    reviewPct: number;
    receivedCount: number;
    receivedPct: number;
    byStatus: Record<ReceiptStatus, number>;
  };
}

const ChecklistCtx = createContext<ChecklistState | null>(null);

export function useChecklist(): ChecklistState {
  const v = useContext(ChecklistCtx);
  if (!v) throw new Error('useChecklist must be used within WorkspaceProvider');
  return v;
}

function useChecklistState(): ChecklistState {
  const [reviewed, setReviewedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, false])),
  );
  const [status, setStatusMap] = useState<Record<string, ReceiptStatus>>(() =>
    Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, 'noMeasured' as ReceiptStatus])),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  const setReviewed = useCallback((id: string, v: boolean) => setReviewedMap((p) => ({ ...p, [id]: v })), []);
  const setStatus = useCallback((id: string, s: ReceiptStatus) => setStatusMap((p) => ({ ...p, [id]: s })), []);
  const setNote = useCallback((id: string, note: string) => setNotes((p) => ({ ...p, [id]: note })), []);

  const summary = useMemo(() => {
    const total = CHECKLIST_ITEMS.length;
    const reviewedCount = CHECKLIST_ITEMS.filter((i) => reviewed[i.id]).length;
    const byStatus: Record<ReceiptStatus, number> = { noMeasured: 0, requestNeeded: 0, received: 0, needsVerification: 0 };
    for (const i of CHECKLIST_ITEMS) byStatus[status[i.id]] += 1;
    return {
      total,
      reviewedCount,
      reviewPct: calcRatioPct(reviewedCount, total),
      receivedCount: byStatus.received,
      receivedPct: calcRatioPct(byStatus.received, total),
      byStatus,
    };
  }, [reviewed, status]);

  return useMemo(
    () => ({ reviewed, status, notes, setReviewed, setStatus, setNote, summary }),
    [reviewed, status, notes, setReviewed, setStatus, setNote, summary],
  );
}

/* ---- 팀 내부 검토 ------------------------------------------------------------ */
export interface ReviewState {
  statuses: Record<string, ReviewStatus>;
  setStatus: (id: string, s: ReviewStatus) => void;
  reset: () => void;
}

const ReviewCtx = createContext<ReviewState | null>(null);

export function useReview(): ReviewState {
  const v = useContext(ReviewCtx);
  if (!v) throw new Error('useReview must be used within WorkspaceProvider');
  return v;
}

const initialReview = () =>
  Object.fromEntries(REVIEW_CATEGORIES.flatMap((c) => c.items.map((i) => [i.id, 'todo' as ReviewStatus])));

function useReviewState(): ReviewState {
  const [statuses, setMap] = useState<Record<string, ReviewStatus>>(initialReview);
  const setStatus = useCallback((id: string, s: ReviewStatus) => setMap((p) => ({ ...p, [id]: s })), []);
  const reset = useCallback(() => setMap(initialReview()), []);
  return useMemo(() => ({ statuses, setStatus, reset }), [statuses, setStatus, reset]);
}

/* ---- 세정 전후 검증: 사용자 입력 측정값 --------------------------------------- */
export interface MeasuredEntry {
  id: number;
  /** 세정일 기준 경과일 */
  day: number;
  backPressure: number | null;
  exhaustTemp: number | null;
}

export interface MeasurementState {
  entries: MeasuredEntry[];
  add: (e: Omit<MeasuredEntry, 'id'>) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const MeasurementCtx = createContext<MeasurementState | null>(null);

export function useMeasurements(): MeasurementState {
  const v = useContext(MeasurementCtx);
  if (!v) throw new Error('useMeasurements must be used within WorkspaceProvider');
  return v;
}

function useMeasurementState(): MeasurementState {
  const [entries, setEntries] = useState<MeasuredEntry[]>([]);
  const add = useCallback(
    (e: Omit<MeasuredEntry, 'id'>) =>
      setEntries((p) => [...p, { ...e, id: Math.max(0, ...p.map((x) => x.id)) + 1 }].sort((a, b) => a.day - b.day || a.id - b.id)),
    [],
  );
  const remove = useCallback((id: number) => setEntries((p) => p.filter((x) => x.id !== id)), []);
  const clear = useCallback(() => setEntries([]), []);
  return useMemo(() => ({ entries, add, remove, clear }), [entries, add, remove, clear]);
}

/* ---- AI 질의응답 대화 이력 (시연용) ------------------------------------------- */
export type QaMessage =
  | { id: number; kind: 'question'; text: string }
  | { id: number; kind: 'answer'; answerId: QaAnswerId; via: 'preset' | 'exact' | 'keyword' }
  | { id: number; kind: 'fallback' };

export interface QaState {
  messages: QaMessage[];
  /** 추천 질문 선택 */
  askPreset: (id: QaAnswerId, questionText: string) => void;
  /** 직접 입력 — 준비된 답변과 매칭, 없으면 미연동 안내 */
  askFree: (text: string) => void;
  clear: () => void;
}

const QaCtx = createContext<QaState | null>(null);

export function useQa(): QaState {
  const v = useContext(QaCtx);
  if (!v) throw new Error('useQa must be used within WorkspaceProvider');
  return v;
}

function useQaState(): QaState {
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const push = useCallback((build: (nextId: number) => QaMessage[]) => {
    setMessages((p) => [...p, ...build(p.length + 1)]);
  }, []);
  const askPreset = useCallback(
    (answerId: QaAnswerId, text: string) =>
      push((n) => [
        { id: n, kind: 'question', text },
        { id: n + 1, kind: 'answer', answerId, via: 'preset' },
      ]),
    [push],
  );
  const askFree = useCallback(
    (text: string) => {
      const m = matchQuestion(text, QA_PRESETS);
      push((n) => [
        { id: n, kind: 'question', text },
        m ? { id: n + 1, kind: 'answer', answerId: m.id, via: m.via } : { id: n + 1, kind: 'fallback' },
      ]);
    },
    [push],
  );
  const clear = useCallback(() => setMessages([]), []);
  return useMemo(() => ({ messages, askPreset, askFree, clear }), [messages, askPreset, askFree, clear]);
}

/* ---- Provider ---------------------------------------------------------------- */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const calculator = useCalculatorState();
  const checklist = useChecklistState();
  const review = useReviewState();
  const measurements = useMeasurementState();
  const qa = useQaState();
  return (
    <CalculatorCtx.Provider value={calculator}>
      <ChecklistCtx.Provider value={checklist}>
        <ReviewCtx.Provider value={review}>
          <MeasurementCtx.Provider value={measurements}>
            <QaCtx.Provider value={qa}>{children}</QaCtx.Provider>
          </MeasurementCtx.Provider>
        </ReviewCtx.Provider>
      </ChecklistCtx.Provider>
    </CalculatorCtx.Provider>
  );
}
