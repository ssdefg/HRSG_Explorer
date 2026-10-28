import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lang, ReceiptStatus } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import {
  STORE_KEY,
  addCase,
  deleteCase,
  defaultCalc,
  defaultStore,
  duplicateCase,
  newId,
  parseStore,
  renameCase,
  selectCase,
  serializeStore,
  updateCaseIn,
  type AnalysisSnapshot,
  type CaseData,
  type ChecklistMeta,
  type MeasuredEntry,
  type QaMessage,
  type StoreData,
} from '@/lib/caseStore';
import { deriveCalculator, type DerivedCalculator } from '@/lib/calculatorModel';
import { computeProgress, computeReadiness, type ProgressStats, type Readiness } from '@/lib/checklistStats';
import { DEMO_SCENARIOS, hrsgClassDef, type HrsgClass, type NumericInputId, type ScenarioId, type ScenarioSelection } from '@/data/calculatorInputs';
import type { ChecklistCategory } from '@/data/checklistItems';
import { QA_PRESETS, type QaPresetId } from '@/data/qaPresets';
import { matchQuestion } from '@/lib/qaMatch';
import { askRag } from '@/lib/ragClient';
import type { EvaluationMode } from '@/lib/calc';

export type { MeasuredEntry, QaMessage, AnalysisSnapshot } from '@/lib/caseStore';

/**
 * 케이스 기반 작업 상태 — 모든 화면이 같은 원본 데이터를 참조한다.
 * 이 브라우저의 localStorage에만 자동 저장된다 (서버 저장·사용자 간 공유 아님).
 */

/* ---- 저장 ---------------------------------------------------------------- */
export type SaveStatus = 'idle' | 'saved' | 'quota' | 'unavailable' | 'error';
export type LoadNotice = null | 'invalid' | 'migrated' | 'unavailable';

function readInitial(firstCaseName: string): { store: StoreData; notice: LoadNotice } {
  let text: string | null = null;
  try {
    text = window.localStorage.getItem(STORE_KEY);
  } catch {
    return { store: defaultStore(firstCaseName), notice: 'unavailable' };
  }
  const r = parseStore(text);
  if (r.kind === 'ok') return { store: r.store, notice: r.migrated ? 'migrated' : null };
  if (r.kind === 'invalid') {
    // 손상된 원문은 덮어쓰기 전에 보관한다
    try {
      window.localStorage.setItem(`${STORE_KEY}.corrupt`, text ?? '');
    } catch {
      /* 보관 실패는 무시 */
    }
    return { store: defaultStore(firstCaseName), notice: 'invalid' };
  }
  return { store: defaultStore(firstCaseName), notice: null };
}

function writeStore(store: StoreData): SaveStatus {
  try {
    window.localStorage.setItem(STORE_KEY, serializeStore(store));
    return 'saved';
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
    if (name === 'SecurityError') return 'unavailable';
    return 'error';
  }
}

/* ---- Context 정의 ---------------------------------------------------------- */
interface StoreCtxValue {
  store: StoreData;
  current: CaseData;
  setStore: (fn: (s: StoreData) => StoreData) => void;
  updateCurrent: (fn: (c: CaseData) => CaseData) => void;
  updateCase: (caseId: string, fn: (c: CaseData) => CaseData) => void;
  saveStatus: SaveStatus;
  loadNotice: LoadNotice;
  dismissLoadNotice: () => void;
}
const StoreCtx = createContext<StoreCtxValue | null>(null);
function useStore(): StoreCtxValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('Workspace hooks must be used within WorkspaceProvider');
  return v;
}

/* ---- 토스트 ---------------------------------------------------------------- */
export interface Toast {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}
interface ToastCtxValue {
  toasts: Toast[];
  push: (text: string, kind?: Toast['kind']) => void;
  dismiss: (id: number) => void;
}
const ToastCtx = createContext<ToastCtxValue | null>(null);
export function useToast(): ToastCtxValue {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast must be used within WorkspaceProvider');
  return v;
}

/* ---- 일시 상태 (저장하지 않음): 체크리스트 포커스, AI 입력 초안 ------------- */
interface TransientCtxValue {
  focusItemId: string | null;
  setFocusItemId: (id: string | null) => void;
  qaDraft: string;
  setQaDraft: (s: string) => void;
  qaAttachment: string | null;
  setQaAttachment: (id: string | null) => void;
  qaPending: boolean;
  setQaPending: (b: boolean) => void;
}
const TransientCtx = createContext<TransientCtxValue | null>(null);
function useTransient(): TransientCtxValue {
  const v = useContext(TransientCtx);
  if (!v) throw new Error('Workspace hooks must be used within WorkspaceProvider');
  return v;
}

/* ---- Provider ---------------------------------------------------------------- */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { lang } = useAppSettings();
  const initial = useRef<{ store: StoreData; notice: LoadNotice }>();
  if (!initial.current) initial.current = readInitial(lang === 'ko' ? '케이스 1 (DEMO)' : 'Case 1 (DEMO)');

  const [store, setStoreState] = useState<StoreData>(initial.current.store);
  const [loadNotice, setLoadNotice] = useState<LoadNotice>(initial.current.notice);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // 변경 후 250ms 뒤 저장 (입력 중 과도한 쓰기 방지)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = window.setTimeout(() => setSaveStatus(writeStore(store)), 250);
    return () => window.clearTimeout(t);
  }, [store]);

  const setStore = useCallback((fn: (s: StoreData) => StoreData) => setStoreState(fn), []);
  const current = store.cases.find((c) => c.id === store.currentCaseId) ?? store.cases[0];
  const updateCase = useCallback((caseId: string, fn: (c: CaseData) => CaseData) => setStoreState((s) => updateCaseIn(s, caseId, fn)), []);
  const updateCurrent = useCallback(
    (fn: (c: CaseData) => CaseData) => setStoreState((s) => updateCaseIn(s, s.currentCaseId, fn)),
    [],
  );

  const storeValue = useMemo<StoreCtxValue>(
    () => ({ store, current, setStore, updateCurrent, updateCase, saveStatus, loadNotice, dismissLoadNotice: () => setLoadNotice(null) }),
    [store, current, setStore, updateCurrent, updateCase, saveStatus, loadNotice],
  );

  // 토스트
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (text: string, kind: Toast['kind'] = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((p) => [...p.slice(-2), { id, text, kind }]);
      window.setTimeout(() => dismiss(id), 3500);
    },
    [dismiss],
  );
  const toastValue = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  // 일시 상태 — 케이스가 바뀌면 초기화
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const [qaDraft, setQaDraft] = useState('');
  const [qaAttachment, setQaAttachment] = useState<string | null>(null);
  const [qaPending, setQaPending] = useState(false);
  useEffect(() => {
    setQaDraft('');
    setQaAttachment(null);
    setFocusItemId(null);
  }, [store.currentCaseId]);
  const transientValue = useMemo(
    () => ({ focusItemId, setFocusItemId, qaDraft, setQaDraft, qaAttachment, setQaAttachment, qaPending, setQaPending }),
    [focusItemId, qaDraft, qaAttachment, qaPending],
  );

  return (
    <StoreCtx.Provider value={storeValue}>
      <ToastCtx.Provider value={toastValue}>
        <TransientCtx.Provider value={transientValue}>{children}</TransientCtx.Provider>
      </ToastCtx.Provider>
    </StoreCtx.Provider>
  );
}

/* ---- 케이스 관리 -------------------------------------------------------------- */
export interface CasesState {
  cases: CaseData[];
  current: CaseData;
  select: (id: string) => void;
  create: (name: string) => void;
  rename: (id: string, name: string) => void;
  duplicate: (id: string, name: string) => void;
  remove: (id: string) => boolean;
  saveStatus: SaveStatus;
  loadNotice: LoadNotice;
  dismissLoadNotice: () => void;
}

export function useCases(): CasesState {
  const { store, current, setStore, saveStatus, loadNotice, dismissLoadNotice } = useStore();
  return {
    cases: store.cases,
    current,
    select: (id) => setStore((s) => selectCase(s, id)),
    create: (name) => setStore((s) => addCase(s, name)),
    rename: (id, name) => setStore((s) => renameCase(s, id, name)),
    duplicate: (id, name) => setStore((s) => duplicateCase(s, id, name)),
    remove: (id) => {
      if (store.cases.length <= 1) return false;
      setStore((s) => deleteCase(s, id));
      return true;
    },
    saveStatus,
    loadNotice,
    dismissLoadNotice,
  };
}

/* ---- 계산기 ---------------------------------------------------------------- */
export interface CalculatorState extends DerivedCalculator {
  caseId: string;
  mode: EvaluationMode;
  scenario: ScenarioSelection;
  hrsgClass: HrsgClass;
  raw: Record<NumericInputId, string>;
  edited: Partial<Record<NumericInputId, boolean>>;
  setMode: (m: EvaluationMode) => void;
  applyScenario: (id: ScenarioId) => void;
  setHrsgClass: (c: HrsgClass) => void;
  setRaw: (id: NumericInputId, value: string) => void;
  reset: () => void;
}

export function useCalculator(): CalculatorState {
  const { current, updateCurrent } = useStore();
  const calc = current.calc;
  const derived = useMemo(() => deriveCalculator(calc), [calc]);

  const setRaw = useCallback(
    (id: NumericInputId, value: string) =>
      updateCurrent((c) => ({
        ...c,
        calc: {
          ...c.calc,
          raw: { ...c.calc.raw, [id]: value },
          edited: { ...c.calc.edited, [id]: true },
          // 수동 입력은 시나리오를 '사용자 지정'으로 전환한다 (자동 판별 상태와는 별개 필드)
          scenario: c.calc.mode === 'demo' && (id === 'currentBp' || id === 'diffPressure') ? 'custom' : c.calc.scenario,
        },
      })),
    [updateCurrent],
  );

  const applyScenario = useCallback(
    (id: ScenarioId) =>
      updateCurrent((c) => {
        const vals = DEMO_SCENARIOS[id].values;
        const raw = { ...c.calc.raw };
        const edited = { ...c.calc.edited };
        for (const [k, v] of Object.entries(vals)) {
          raw[k as NumericInputId] = String(v);
          delete edited[k as NumericInputId];
        }
        return { ...c, calc: { ...c.calc, scenario: id, raw, edited } };
      }),
    [updateCurrent],
  );

  const setHrsgClass = useCallback(
    (cls: HrsgClass) =>
      updateCurrent((c) => ({
        ...c,
        calc: {
          ...c.calc,
          hrsgClass: cls,
          raw: { ...c.calc.raw, capacityMw: String(hrsgClassDef(cls).demoCapacityMw) },
          edited: { ...c.calc.edited, capacityMw: false },
        },
      })),
    [updateCurrent],
  );

  const setMode = useCallback((m: EvaluationMode) => updateCurrent((c) => ({ ...c, calc: { ...c.calc, mode: m } })), [updateCurrent]);
  const reset = useCallback(() => updateCurrent((c) => ({ ...c, calc: { ...defaultCalc(), mode: c.calc.mode } })), [updateCurrent]);

  return {
    ...derived,
    caseId: current.id,
    mode: calc.mode,
    scenario: calc.scenario,
    hrsgClass: calc.hrsgClass,
    raw: calc.raw,
    edited: calc.edited,
    setMode,
    applyScenario,
    setHrsgClass,
    setRaw,
    reset,
  };
}

/* ---- 분석 이력 (계산 결과 스냅샷) ----------------------------------------------- */
export interface HistoryState {
  snapshots: AnalysisSnapshot[];
  /** 입력이 유효할 때만 생성한다. 무효이면 null (숫자를 전달하지 않음) */
  saveSnapshot: () => AnalysisSnapshot | null;
  getSnapshot: (id: string) => AnalysisSnapshot | undefined;
}

export function useHistory(): HistoryState {
  const { current, updateCurrent } = useStore();
  const derived = useMemo(() => deriveCalculator(current.calc), [current.calc]);
  const saveSnapshot = useCallback((): AnalysisSnapshot | null => {
    if (!derived.valid) return null;
    const seq = current.nextSnapshotSeq;
    const m = derived.metrics;
    const snap: AnalysisSnapshot = {
      id: newId('snap'),
      seq,
      createdAt: new Date().toISOString(),
      mode: current.calc.mode,
      scenario: current.calc.scenario,
      hrsgClass: current.calc.hrsgClass,
      model: derived.model,
      inputsKey: derived.inputsKey,
      inputs: { ...derived.values },
      bp: { deltaBp: m.deltaBp.value, powerLossMw: m.powerLossMw.value, monthlyLossKrw: m.monthlyLossKrw.value, level: derived.level },
      cleaning: { ...derived.cleaning },
    };
    updateCurrent((c) => ({ ...c, history: [snap, ...c.history].slice(0, 50), nextSnapshotSeq: c.nextSnapshotSeq + 1 }));
    return snap;
  }, [derived, current.nextSnapshotSeq, current.calc, updateCurrent]);
  return {
    snapshots: current.history,
    saveSnapshot,
    getSnapshot: (id) => current.history.find((h) => h.id === id),
  };
}

/* ---- 데이터 요청 체크리스트 ----------------------------------------------------- */
export interface ChecklistState {
  reviewed: Record<string, boolean>;
  status: Record<string, ReceiptStatus>;
  notes: Record<string, string>;
  meta: Record<string, ChecklistMeta>;
  clientName: string;
  setReviewed: (id: string, v: boolean) => void;
  /** 검토 체크박스만 일괄 변경 — 수령 상태는 바꾸지 않는다 */
  setReviewedMany: (ids: string[], v: boolean) => void;
  setStatus: (id: string, s: ReceiptStatus) => void;
  setNote: (id: string, note: string) => void;
  setMeta: (id: string, patch: Partial<ChecklistMeta>) => void;
  setClientName: (s: string) => void;
  summary: ProgressStats;
  byCategory: Record<ChecklistCategory, ProgressStats>;
  readiness: Readiness;
  focusItemId: string | null;
  requestFocus: (id: string | null) => void;
}

export function useChecklist(): ChecklistState {
  const { current, updateCurrent } = useStore();
  const { focusItemId, setFocusItemId } = useTransient();
  const cl = current.checklist;
  const patch = useCallback(
    (fn: (c: CaseData['checklist']) => CaseData['checklist']) => updateCurrent((c) => ({ ...c, checklist: fn(c.checklist) })),
    [updateCurrent],
  );
  const summary = useMemo(() => computeProgress(cl.reviewed, cl.status), [cl.reviewed, cl.status]);
  const byCategory = useMemo(
    () => ({
      A: computeProgress(cl.reviewed, cl.status, 'A'),
      B: computeProgress(cl.reviewed, cl.status, 'B'),
      C: computeProgress(cl.reviewed, cl.status, 'C'),
    }),
    [cl.reviewed, cl.status],
  );
  const readiness = useMemo(() => computeReadiness(cl.reviewed, cl.status), [cl.reviewed, cl.status]);
  return {
    reviewed: cl.reviewed,
    status: cl.status,
    notes: cl.notes,
    meta: cl.meta,
    clientName: cl.clientName,
    setReviewed: (id, v) => patch((x) => ({ ...x, reviewed: { ...x.reviewed, [id]: v } })),
    setReviewedMany: (ids, v) => patch((x) => ({ ...x, reviewed: { ...x.reviewed, ...Object.fromEntries(ids.map((id) => [id, v])) } })),
    setStatus: (id, s) => patch((x) => ({ ...x, status: { ...x.status, [id]: s } })),
    setNote: (id, note) => patch((x) => ({ ...x, notes: { ...x.notes, [id]: note } })),
    setMeta: (id, p) => patch((x) => ({ ...x, meta: { ...x.meta, [id]: { ...x.meta[id], ...p } } })),
    setClientName: (s) => patch((x) => ({ ...x, clientName: s })),
    summary,
    byCategory,
    readiness,
    focusItemId,
    requestFocus: setFocusItemId,
  };
}

/* ---- 세정 전후 실측 스냅샷 -------------------------------------------------------- */
export interface MeasurementState {
  entries: MeasuredEntry[];
  add: (e: Omit<MeasuredEntry, 'id'>) => void;
  remove: (id: number) => void;
  clear: () => void;
}

export function useMeasurements(): MeasurementState {
  const { current, updateCurrent } = useStore();
  return {
    entries: current.measurements,
    add: (e) =>
      updateCurrent((c) => ({
        ...c,
        measurements: [...c.measurements, { ...e, id: Math.max(0, ...c.measurements.map((x) => x.id)) + 1 }].sort(
          (a, b) => a.day - b.day || a.id - b.id,
        ),
      })),
    remove: (id) => updateCurrent((c) => ({ ...c, measurements: c.measurements.filter((x) => x.id !== id) })),
    clear: () => updateCurrent((c) => ({ ...c, measurements: [] })),
  };
}

/* ---- AI 질의응답 (케이스별 대화 기록) ------------------------------------------------ */
export interface QaState {
  messages: QaMessage[];
  pending: boolean;
  draft: string;
  setDraft: (s: string) => void;
  /** 질문에 첨부된 계산 결과 스냅샷 id */
  attachment: string | null;
  setAttachment: (id: string | null) => void;
  /**
   * 추천 질문 — 질문 문장을 그대로 참고문헌 RAG 서버에 질의한다 (직접 입력과 같은 경로).
   * RAG 서버에 연결할 수 없으면 해당 추천 질문의 사전 작성 답변을 보여 준다.
   */
  askPreset: (id: QaPresetId, questionText: string, lang: Lang) => void;
  /**
   * 직접 입력 — 첨부 스냅샷이 있으면 결과 해설, 아니면 참고문헌 RAG 서버에 질의.
   * RAG 서버에 연결할 수 없으면 준비된 질문과 매칭, 그것도 없으면 범위 밖 안내.
   */
  askFree: (text: string, lang: Lang) => void;
  clear: () => void;
}

const ANSWER_DELAY_MS = 350;

export function useQa(): QaState {
  const { current, updateCase } = useStore();
  const t = useTransient();
  const caseId = current.id;

  const pushTo = useCallback(
    (build: (nextId: number, at: string) => QaMessage[]) =>
      updateCase(caseId, (c) => {
        const next = Math.max(0, ...c.qa.messages.map((m) => m.id)) + 1;
        return { ...c, qa: { messages: [...c.qa.messages, ...build(next, new Date().toISOString())] } };
      }),
    [caseId, updateCase],
  );

  /** 준비된 답변을 찾는 동안 짧게 '검색 중' 상태를 보여준다 (실제 생성이 아님) */
  const answerLater = useCallback(
    (build: (nextId: number, at: string) => QaMessage[]) => {
      t.setQaPending(true);
      window.setTimeout(() => {
        pushTo(build);
        t.setQaPending(false);
      }, ANSWER_DELAY_MS);
    },
    [pushTo, t],
  );

  /** 참고문헌 RAG 서버에 질의하고, 서버에 연결할 수 없으면 fallback 메시지를 넣는다 */
  const answerWithRag = useCallback(
    (text: string, lang: Lang, fallback: (nextId: number, at: string) => QaMessage) => {
      t.setQaPending(true);
      askRag(text, lang)
        .then((r) => pushTo((n, at) => [{ id: n, at, kind: 'rag', ...r }]))
        .catch(() => pushTo((n, at) => [fallback(n, at)]))
        .finally(() => t.setQaPending(false));
    },
    [pushTo, t],
  );

  const askPreset = useCallback(
    (id: QaPresetId, text: string, lang: Lang) => {
      if (t.qaPending) return;
      pushTo((n, at) => [{ id: n, at, kind: 'question', text }]);
      t.setQaDraft('');
      answerWithRag(text, lang, (n, at) => ({ id: n, at, kind: 'answer', answerId: id, via: 'preset' }));
    },
    [pushTo, answerWithRag, t],
  );

  const askFree = useCallback(
    (text: string, lang: Lang) => {
      if (t.qaPending) return;
      const snapshotId = t.qaAttachment ?? undefined;
      pushTo((n, at) => [{ id: n, at, kind: 'question', text, snapshotId }]);
      t.setQaAttachment(null);
      t.setQaDraft('');
      if (snapshotId) {
        const exists = current.history.some((h) => h.id === snapshotId);
        answerLater((n, at) => [
          exists
            ? { id: n, at, kind: 'answer', answerId: 'resultSummary', via: 'snapshot', snapshotId }
            : { id: n, at, kind: 'error', reason: 'snapshot-missing' },
        ]);
        return;
      }
      // RAG 서버 미기동·네트워크 오류 → 기존 시연용 답변 매칭
      answerWithRag(text, lang, (n, at) => {
        const m = matchQuestion(text, QA_PRESETS);
        return m ? { id: n, at, kind: 'answer', answerId: m.id, via: m.via } : { id: n, at, kind: 'fallback' };
      });
    },
    [pushTo, answerLater, answerWithRag, t, current.history],
  );

  return {
    messages: current.qa.messages,
    pending: t.qaPending,
    draft: t.qaDraft,
    setDraft: t.setQaDraft,
    attachment: t.qaAttachment,
    setAttachment: t.setQaAttachment,
    askPreset,
    askFree,
    clear: () => updateCase(caseId, (c) => ({ ...c, qa: { messages: [] } })),
  };
}
