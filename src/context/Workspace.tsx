import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lang, ReceiptStatus, VerifyStatus } from '@/types';
import type { KitProgress, KitProgressEntry } from '@/lib/kit';
import { useAppSettings } from '@/context/AppSettings';
import {
  LEGACY_STORE_KEY,
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
  type Conversation,
  type OperatingConditions,
  type QaMessage,
  type StoreData,
  appendToActive,
  appendToConversation,
  deleteConversation as deleteConversationIn,
} from '@/lib/caseStore';
import type { ContextSnapshot } from '@/lib/aiContext';
import { readStored, writeStored } from '@/lib/storage';

const CHAT_MODE_KEY = 'hrsg.chatMode';
import { deriveCalculator, type DerivedCalculator } from '@/lib/calculatorModel';
import { computeProgress, computeReadiness, statusNeedsValue, type ProgressStats, type Readiness } from '@/lib/checklistStats';
import {
  scenarioValues,
  INPUT_DEF,
  hrsgClassDef,
  unitDef,
  type HrsgClass,
  type NumericInputId,
  type ScenarioId,
  type ScenarioSelection,
} from '@/data/calculatorInputs';
import { parseNumericInput } from '@/lib/number';
import { kitDefaultValues } from '@/lib/calc_adapter';
import { maskSensitive } from '@/lib/privacy';
import { CHECKLIST_CATEGORIES, CHECKLIST_ITEMS, type ChecklistCategory } from '@/data/checklistItems';
import { askRag, RagUnavailableError, type RagResult } from '@/lib/ragClient';
import { askGeminiDirect, hasDirectKey } from '@/lib/geminiDirect';
import { currentHealthStatus } from '@/lib/useHealth';
import type { EvaluationMode } from '@/lib/calc';

export type { MeasuredEntry, QaMessage, AnalysisSnapshot, OperatingConditions, Conversation } from '@/lib/caseStore';

/**
 * 케이스 기반 작업 상태 — 모든 화면이 같은 원본 데이터를 참조한다.
 * 이 브라우저의 localStorage에만 자동 저장된다 (서버 저장·사용자 간 공유 아님).
 */

/* ---- 저장 ---------------------------------------------------------------- */
/** pending: 변경 후 저장 대기 (디바운스 중) */
export type SaveStatus = 'idle' | 'pending' | 'saved' | 'quota' | 'unavailable' | 'error';
export type LoadNotice = null | 'invalid' | 'migrated' | 'unavailable';

function readInitial(firstCaseName: string): { store: StoreData; notice: LoadNotice } {
  let text: string | null = null;
  try {
    // 새 키가 비어 있으면 이전 버전 키에서 옮겨 온다 (원본은 지우지 않음)
    text = window.localStorage.getItem(STORE_KEY) ?? window.localStorage.getItem(LEGACY_STORE_KEY);
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

/* ---- 일시 상태 (저장하지 않음): 체크리스트 포커스, AI 어시스턴트 창·입력 초안 ------------- */
/** float: 오른쪽 하단 플로팅 창 · panel: 오른쪽 전체 높이 사이드 패널 */
export type ChatMode = 'float' | 'panel';

interface TransientCtxValue {
  focusItemId: string | null;
  setFocusItemId: (id: string | null) => void;
  qaDraft: string;
  setQaDraft: (s: string) => void;
  /** 다음 질문에 첨부할 화면 데이터 스냅샷 */
  qaAttachment: ContextSnapshot | null;
  setQaAttachment: (c: ContextSnapshot | null) => void;
  /** 답변을 기다리는 대화 id (null = 대기 없음) — 전송 중 중복 입력 방지 */
  qaPendingConv: string | null;
  setQaPendingConv: (id: string | null) => void;
  chatOpen: boolean;
  setChatOpen: (b: boolean) => void;
  chatMode: ChatMode;
  setChatMode: (m: ChatMode) => void;
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
    setSaveStatus('pending');
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
  const [qaAttachment, setQaAttachment] = useState<ContextSnapshot | null>(null);
  const [qaPendingConv, setQaPendingConv] = useState<string | null>(null);
  // 창 열림·모드는 페이지를 이동해도 유지된다 (Provider 가 App 최상위에 있음). 모드는 다음 방문에도 기억한다.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMode, setChatModeState] = useState<ChatMode>(() => readStored<ChatMode>(CHAT_MODE_KEY, ['float', 'panel'], 'float'));
  const setChatMode = useCallback((m: ChatMode) => {
    setChatModeState(m);
    writeStored(CHAT_MODE_KEY, m);
  }, []);
  useEffect(() => {
    setQaDraft('');
    setQaAttachment(null);
    setFocusItemId(null);
  }, [store.currentCaseId]);
  const transientValue = useMemo(
    () => ({
      focusItemId,
      setFocusItemId,
      qaDraft,
      setQaDraft,
      qaAttachment,
      setQaAttachment,
      qaPendingConv,
      setQaPendingConv,
      chatOpen,
      setChatOpen,
      chatMode,
      setChatMode,
    }),
    [focusItemId, qaDraft, qaAttachment, qaPendingConv, chatOpen, chatMode, setChatMode],
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
  units: Partial<Record<NumericInputId, string>>;
  /** 마지막 계산 실행 이후 입력이 바뀜 — 결과를 가리고 '재평가 필요' 표시 */
  stale: boolean;
  setMode: (m: EvaluationMode) => void;
  applyScenario: (id: ScenarioId) => void;
  setHrsgClass: (c: HrsgClass) => void;
  setRaw: (id: NumericInputId, value: string) => void;
  /** 단위를 바꾸면 같은 물리량이 되도록 입력란 원문을 환산한다 */
  setUnit: (id: NumericInputId, unitId: string) => void;
  /** 계산 실행 (재평가) — stale 해제 */
  commit: () => void;
  reset: () => void;
}

/** 시나리오 프리셋이 바꾸는 입력 — 직접 수정하면 '사용자 지정'으로 전환 */
const PRESET_FIELDS = new Set<NumericInputId>(['currentBp', 'diffPressure', 'exhaustTemp']);

/** 단위 환산 후 표시용 원문 — 유효 숫자 6자리 */
function formatConverted(v: number): string {
  return String(Number(v.toPrecision(6)));
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
          scenario: c.calc.mode === 'demo' && PRESET_FIELDS.has(id) ? 'custom' : c.calc.scenario,
          stale: c.calc.stale || c.calc.raw[id] !== value,
        },
      })),
    [updateCurrent],
  );

  const setUnit = useCallback(
    (id: NumericInputId, unitId: string) =>
      updateCurrent((c) => {
        const kind = INPUT_DEF[id].unitKind;
        if (!kind) return c;
        const from = unitDef(kind, c.calc.units[id]);
        const to = unitDef(kind, unitId);
        const r = parseNumericInput(c.calc.raw[id] ?? '');
        const raw = r.ok ? formatConverted(to.fromBase(from.toBase(r.value))) : c.calc.raw[id];
        return { ...c, calc: { ...c.calc, units: { ...c.calc.units, [id]: to.id }, raw: { ...c.calc.raw, [id]: raw } } };
      }),
    [updateCurrent],
  );

  const commit = useCallback(() => updateCurrent((c) => ({ ...c, calc: { ...c.calc, stale: false } })), [updateCurrent]);

  const applyScenario = useCallback(
    (id: ScenarioId) =>
      updateCurrent((c) => {
        const vals = scenarioValues(id, c.calc.hrsgClass);
        const raw = { ...c.calc.raw };
        const edited = { ...c.calc.edited };
        const units = { ...c.calc.units };
        for (const [k, v] of Object.entries(vals)) {
          raw[k as NumericInputId] = String(v);
          delete edited[k as NumericInputId];
          delete units[k as NumericInputId]; // 프리셋 값은 기준 단위
        }
        return { ...c, calc: { ...c.calc, scenario: id, raw, edited, units, stale: true } };
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
          // 등급을 바꾸면 정격 용량·기준(설계) 배압·기준 스택 온도를 그 등급의 키트 값으로 맞춘다
          raw: {
            ...c.calc.raw,
            capacityMw: String(hrsgClassDef(cls).demoCapacityMw),
            referenceBp: String(kitDefaultValues(cls).referenceBp),
            referenceStackTemp: String(kitDefaultValues(cls).referenceStackTemp),
          },
          edited: { ...c.calc.edited, capacityMw: false, referenceBp: false, referenceStackTemp: false },
          units: { ...c.calc.units, referenceBp: undefined, referenceStackTemp: undefined },
          stale: true,
        },
      })),
    [updateCurrent],
  );

  const setMode = useCallback(
    (m: EvaluationMode) => updateCurrent((c) => ({ ...c, calc: { ...c.calc, mode: m, stale: c.calc.stale || c.calc.mode !== m } })),
    [updateCurrent],
  );
  const reset = useCallback(() => updateCurrent((c) => ({ ...c, calc: { ...defaultCalc(), mode: c.calc.mode } })), [updateCurrent]);

  return {
    ...derived,
    caseId: current.id,
    mode: calc.mode,
    scenario: calc.scenario,
    hrsgClass: calc.hrsgClass,
    raw: calc.raw,
    edited: calc.edited,
    units: calc.units,
    stale: calc.stale,
    setMode,
    applyScenario,
    setHrsgClass,
    setRaw,
    setUnit,
    commit,
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

/* ---- 데이터 요청 체크리스트 (키트 progress 표준) ----------------------------------------- */
export interface ChecklistState {
  /** 키트 표준 진행 상태 그대로 — 키트 함수(kpis·emailDraft 등)에 넘길 때 사용 */
  progress: KitProgress;
  reviewed: Record<string, boolean>;
  /** 수급 상태 (키트 supply) */
  status: Record<string, ReceiptStatus>;
  /** 검증 상태 (키트 verify) */
  verify: Record<string, VerifyStatus>;
  notes: Record<string, string>;
  meta: Record<string, ChecklistMeta>;
  clientName: string;
  setReviewed: (id: string, v: boolean) => void;
  /** 검토 체크박스만 일괄 변경 — 수급 상태는 바꾸지 않는다 */
  setReviewedMany: (ids: string[], v: boolean) => void;
  /**
   * 수급 상태 변경. 실측값이 비어 있으면 '수령 완료'·'검증 필요'로 바꾸지 않고 false 를 돌려준다
   * (가이드 §2.4 가드레일 — 화면은 토스트로 알리고 이전 상태를 유지한다).
   */
  setStatus: (id: string, s: ReceiptStatus) => boolean;
  setVerify: (id: string, v: VerifyStatus) => void;
  setNote: (id: string, note: string) => void;
  setMeta: (id: string, patch: Partial<ChecklistMeta>) => void;
  setClientName: (s: string) => void;
  summary: ProgressStats;
  byCategory: Record<ChecklistCategory, ProgressStats>;
  readiness: Readiness;
  focusItemId: string | null;
  requestFocus: (id: string | null) => void;
}

/** 키트 progress 항목 하나를 고친다 — 기본값과 같은 필드는 지워 키트 처음 상태({})와 같은 모양을 유지 */
function patchEntry(progress: KitProgress, id: string, p: KitProgressEntry): KitProgress {
  const next: KitProgressEntry = { ...progress[id], ...p };
  if (next.supply === 'not_entered') delete next.supply;
  if (next.verify === 'unverified') delete next.verify;
  if (!next.reviewed) delete next.reviewed;
  if (!next.value) delete next.value;
  if (!next.note) delete next.note;
  const out = { ...progress };
  if (Object.keys(next).length) out[id] = next;
  else delete out[id];
  return out;
}

export function useChecklist(): ChecklistState {
  const { current, updateCurrent } = useStore();
  const { focusItemId, setFocusItemId } = useTransient();
  const cl = current.checklist;
  const prog = cl.progress;
  const patch = useCallback(
    (fn: (c: CaseData['checklist']) => CaseData['checklist']) => updateCurrent((c) => ({ ...c, checklist: fn(c.checklist) })),
    [updateCurrent],
  );
  const setEntry = useCallback(
    (id: string, p: KitProgressEntry) => patch((x) => ({ ...x, progress: patchEntry(x.progress, id, p) })),
    [patch],
  );
  // 화면용 보기 — 키트 progress 에서 만든다 (없는 필드는 키트 기본값)
  const views = useMemo(() => {
    const ids = CHECKLIST_ITEMS.map((i) => i.id);
    return {
      reviewed: Object.fromEntries(ids.map((id) => [id, prog[id]?.reviewed === true])),
      status: Object.fromEntries(ids.map((id) => [id, (prog[id]?.supply ?? 'not_entered') as ReceiptStatus])),
      verify: Object.fromEntries(ids.map((id) => [id, (prog[id]?.verify ?? 'unverified') as VerifyStatus])),
      notes: Object.fromEntries(ids.filter((id) => prog[id]?.note).map((id) => [id, prog[id].note as string])),
      meta: Object.fromEntries(ids.map((id) => [id, { ...cl.ext[id], value: prog[id]?.value ?? '' }])),
    };
  }, [prog, cl.ext]);
  const summary = useMemo(() => computeProgress(prog), [prog]);
  const byCategory = useMemo(
    () => Object.fromEntries(CHECKLIST_CATEGORIES.map((c) => [c, computeProgress(prog, c)])) as Record<ChecklistCategory, ProgressStats>,
    [prog],
  );
  const readiness = useMemo(() => computeReadiness(prog), [prog]);
  return {
    progress: prog,
    ...views,
    clientName: cl.clientName,
    setReviewed: (id, v) => setEntry(id, { reviewed: v }),
    setReviewedMany: (ids, v) => patch((x) => ({ ...x, progress: ids.reduce((acc, id) => patchEntry(acc, id, { reviewed: v }), x.progress) })),
    setStatus: (id, s) => {
      if (statusNeedsValue(s) && !(prog[id]?.value ?? '').trim()) return false;
      setEntry(id, { supply: s });
      return true;
    },
    setVerify: (id, v) => setEntry(id, { verify: v }),
    setNote: (id, note) => setEntry(id, { note }),
    setMeta: (id, p) =>
      patch((x) => {
        const { value, ...ext } = p;
        return {
          ...x,
          progress: value === undefined ? x.progress : patchEntry(x.progress, id, { value }),
          ext: Object.keys(ext).length ? { ...x.ext, [id]: { ...x.ext[id], ...ext } } : x.ext,
        };
      }),
    setClientName: (s) => patch((x) => ({ ...x, clientName: s })),
    summary,
    byCategory,
    readiness,
    focusItemId,
    requestFocus: setFocusItemId,
  };
}

/* ---- 세정 전후 운전 조건 ------------------------------------------------------------ */
export interface ConditionsState {
  conditions: OperatingConditions;
  setCondition: (key: keyof OperatingConditions, value: string) => void;
}

export function useConditions(): ConditionsState {
  const { current, updateCurrent } = useStore();
  return {
    conditions: current.conditions,
    setCondition: (key, value) => updateCurrent((c) => ({ ...c, conditions: { ...c.conditions, [key]: value } })),
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

/* ---- AI 어시스턴트 (케이스별 대화 목록) ------------------------------------------------ */
export interface QaState {
  conversations: Conversation[];
  activeId: string | null;
  /** 현재 열린 대화의 메시지 (없으면 빈 배열 — 다음 질문에서 새 대화를 만든다) */
  messages: QaMessage[];
  /** 현재 열린 대화가 답변을 기다리는 중 */
  pending: boolean;
  /** 어느 대화든 답변을 기다리는 중 — 중복 전송 방지 */
  busy: boolean;
  draft: string;
  setDraft: (s: string) => void;
  /** 다음 질문에 첨부할 화면 데이터 */
  attachment: ContextSnapshot | null;
  setAttachment: (c: ContextSnapshot | null) => void;
  /**
   * 질문 전송 — 질문·첨부 화면 데이터를 마스킹한 뒤 참고문헌 RAG 서버(/api/ask)에 보낸다.
   * 서버에 연결할 수 없으면 오류 메시지를 남긴다 (사전 작성 답변으로 대신하지 않음).
   */
  ask: (text: string, lang: Lang) => void;
  /** 서버 오류 메시지의 질문을 다시 보낸다 */
  retry: (errorMsgId: number, lang: Lang) => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  chatOpen: boolean;
  setChatOpen: (b: boolean) => void;
  chatMode: ChatMode;
  setChatMode: (m: ChatMode) => void;
  /** 어시스턴트 열기 — 화면 데이터 첨부·추천 질문 초안을 함께 넣을 수 있다 */
  openAssistant: (opts?: { context?: ContextSnapshot; draft?: string }) => void;
}

/** 첨부 화면 데이터의 문자열 값도 전송 전에 마스킹한다 (서버에서 한 번 더 마스킹) */
function maskContext(ctx: ContextSnapshot | undefined, names: string[]): ContextSnapshot | undefined {
  if (!ctx) return undefined;
  return {
    ...ctx,
    title: maskSensitive(ctx.title, names),
    items: ctx.items.map((i) => ({ ...i, label: maskSensitive(i.label, names), value: typeof i.value === 'string' ? maskSensitive(i.value, names) : i.value })),
  };
}

/**
 * RAG 서버(/api/ask)로 묻고, 서버가 없으면 브라우저에서 Gemini 로 직접 묻는다 (Standalone — 정적 사이트 단독 배포).
 * 헬스 체크가 이미 'direct' 면 서버 요청을 건너뛴다. 둘 다 안 되면 예외 → '연결 오류 · 다시 시도'.
 */
function answerQuestion(text: string, lang: Lang, context?: ContextSnapshot): Promise<RagResult> {
  if (currentHealthStatus() === 'direct') return askGeminiDirect(text, lang, context);
  return askRag(text, lang, context).catch((e) => {
    if (e instanceof RagUnavailableError && hasDirectKey()) return askGeminiDirect(text, lang, context);
    throw e;
  });
}

export function useQa(): QaState {
  const { current, updateCase } = useStore();
  const t = useTransient();
  const caseId = current.id;
  const qa = current.qa;
  const active = qa.conversations.find((c) => c.id === qa.activeId) ?? null;
  const clientName = current.checklist.clientName;
  const sensitiveNames = useMemo(() => (clientName.trim() ? [clientName.trim()] : []), [clientName]);

  /** 질문한 대화에 답변을 넣는다 — 그 사이 다른 대화로 바꾸거나 페이지를 이동해도 섞이지 않는다 */
  const send = useCallback(
    (convId: string, text: string, lang: Lang, context?: ContextSnapshot) => {
      t.setQaPendingConv(convId);
      answerQuestion(text, lang, context)
        .then((r) => updateCase(caseId, (c) => ({ ...c, qa: appendToConversation(c.qa, convId, (n, at) => [{ id: n, at, kind: 'rag', context, ...r }]) })))
        .catch(() =>
          updateCase(caseId, (c) => ({
            ...c,
            qa: appendToConversation(c.qa, convId, (n, at) => [{ id: n, at, kind: 'error', reason: 'server', question: text, context }]),
          })),
        )
        .finally(() => t.setQaPendingConv(null));
    },
    [caseId, updateCase, t],
  );

  const ask = useCallback(
    (raw: string, lang: Lang) => {
      if (t.qaPendingConv) return;
      // 전화번호·이메일·발전소 고유 명칭은 기록·전송 전에 마스킹한다 (가이드 §3.2)
      const text = maskSensitive(raw.trim(), sensitiveNames);
      if (!text) return;
      const context = maskContext(t.qaAttachment ?? undefined, sensitiveNames);
      // 새 대화 id 를 미리 정해 두고, 같은 id 로 질문과 답변을 넣는다
      const convId = current.qa.activeId ?? newId('conv');
      updateCase(caseId, (c) => ({ ...c, qa: appendToActive(c.qa, (n, at) => [{ id: n, at, kind: 'question', text, context }], new Date(), convId) }));
      t.setQaAttachment(null);
      t.setQaDraft('');
      send(convId, text, lang, context);
    },
    [t, sensitiveNames, current.qa.activeId, caseId, updateCase, send],
  );

  const retry = useCallback(
    (errorMsgId: number, lang: Lang) => {
      if (t.qaPendingConv || !active) return;
      const err = active.messages.find((m) => m.id === errorMsgId);
      if (!err || err.kind !== 'error' || !err.question) return;
      // 실패한 오류 메시지는 지우고 같은 질문을 다시 보낸다
      const convId = active.id;
      updateCase(caseId, (c) => ({
        ...c,
        qa: {
          ...c.qa,
          conversations: c.qa.conversations.map((cv) => (cv.id === convId ? { ...cv, messages: cv.messages.filter((m) => m.id !== errorMsgId) } : cv)),
        },
      }));
      send(convId, err.question, lang, err.context);
    },
    [t.qaPendingConv, active, caseId, updateCase, send],
  );

  const { setChatOpen, setQaAttachment, setQaDraft } = t;
  const openAssistant = useCallback(
    (opts: { context?: ContextSnapshot; draft?: string } = {}) => {
      if (opts.context) setQaAttachment(opts.context);
      if (opts.draft !== undefined) setQaDraft(opts.draft);
      setChatOpen(true);
    },
    [setChatOpen, setQaAttachment, setQaDraft],
  );

  return {
    conversations: qa.conversations,
    activeId: qa.activeId,
    messages: active?.messages ?? [],
    pending: t.qaPendingConv !== null && t.qaPendingConv === qa.activeId,
    busy: t.qaPendingConv !== null,
    draft: t.qaDraft,
    setDraft: t.setQaDraft,
    attachment: t.qaAttachment,
    setAttachment: t.setQaAttachment,
    ask,
    retry,
    newConversation: () => updateCase(caseId, (c) => ({ ...c, qa: { ...c.qa, activeId: null } })),
    selectConversation: (id) => updateCase(caseId, (c) => ({ ...c, qa: { ...c.qa, activeId: id } })),
    deleteConversation: (id) => updateCase(caseId, (c) => ({ ...c, qa: deleteConversationIn(c.qa, id) })),
    chatOpen: t.chatOpen,
    setChatOpen: t.setChatOpen,
    chatMode: t.chatMode,
    setChatMode: t.setChatMode,
    openAssistant,
  };
}
