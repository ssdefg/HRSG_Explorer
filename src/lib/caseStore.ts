/**
 * 로컬 케이스 저장 구조 — React와 무관한 순수 함수.
 * 각 케이스는 입력값·모드·시나리오·체크리스트·실측 스냅샷·AI 대화·분석 이력을 독립적으로 가진다.
 * localStorage(사용자 브라우저)에만 저장된다 — 서버 저장·사용자 간 동기화가 아니다.
 */
import type { ReceiptStatus } from '@/types';
import type { EvaluationMode, BackpressureLevel, CleaningEconomicsResult } from '@/lib/calc';
import {
  DEFAULT_HRSG_CLASS,
  DEFAULT_SCENARIO,
  NUMERIC_INPUTS,
  type HrsgClass,
  type NumericInputId,
  type ScenarioSelection,
} from '@/data/calculatorInputs';
import { CHECKLIST_DEFAULT_UNIT, CHECKLIST_ITEMS } from '@/data/checklistItems';
import type { QaAnswerId } from '@/data/qaPresets';
import type { RagResult } from '@/lib/ragClient';

export const STORE_VERSION = 2;
export const STORE_KEY = 'hrsg.workspace';

/* ---- 타입 ---------------------------------------------------------------- */
export interface CalcCaseState {
  mode: EvaluationMode;
  /** 사용자가 고른 시나리오 (배압 자동 판별 결과와 별개의 필드) */
  scenario: ScenarioSelection;
  hrsgClass: HrsgClass;
  raw: Record<NumericInputId, string>;
  /** 기본값에서 사용자가 직접 바꾼 입력 — 데이터 출처 표시에 사용 */
  edited: Partial<Record<NumericInputId, boolean>>;
}

export interface ChecklistMeta {
  value: string;
  unit: string;
  location: string;
  condition: string;
  /** datetime-local 문자열 */
  measuredAt: string;
}

export interface ChecklistCaseState {
  reviewed: Record<string, boolean>;
  status: Record<string, ReceiptStatus>;
  notes: Record<string, string>;
  meta: Record<string, ChecklistMeta>;
  /** 이메일 초안의 고객사/발전소명 */
  clientName: string;
}

export interface MeasuredEntry {
  id: number;
  /** 세정일 기준 경과일 */
  day: number;
  backPressure: number | null;
  exhaustTemp: number | null;
}

export type QaMessage =
  | { id: number; at: string; kind: 'question'; text: string; snapshotId?: string }
  | { id: number; at: string; kind: 'answer'; answerId: QaAnswerId; via: 'preset' | 'exact' | 'keyword' | 'snapshot'; snapshotId?: string }
  | { id: number; at: string; kind: 'fallback' }
  | { id: number; at: string; kind: 'error'; reason: 'snapshot-missing' }
  /** 참고문헌 RAG 서버(server/app.py)의 답변 — 응답을 받은 그대로 저장한다 */
  | ({ id: number; at: string; kind: 'rag' } & RagResult);

/** 계산 결과 스냅샷 — '이 결과 질문하기'·'분석 스냅샷 저장'으로 생성되는 분석 이력 */
export interface AnalysisSnapshot {
  id: string;
  seq: number;
  createdAt: string;
  mode: EvaluationMode;
  scenario: ScenarioSelection;
  hrsgClass: HrsgClass;
  model: string;
  /** 스냅샷 시점 입력값 키 — 현재 입력과 다르면 '이전 입력 기준' */
  inputsKey: string;
  inputs: Partial<Record<NumericInputId, number | null>>;
  bp: {
    deltaBp: number | null;
    powerLossMw: number | null;
    monthlyLossKrw: number | null;
    level: BackpressureLevel | null;
  };
  cleaning: CleaningEconomicsResult;
}

export interface CaseData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  calc: CalcCaseState;
  checklist: ChecklistCaseState;
  measurements: MeasuredEntry[];
  qa: { messages: QaMessage[] };
  history: AnalysisSnapshot[];
  nextSnapshotSeq: number;
}

export interface StoreData {
  version: number;
  currentCaseId: string;
  cases: CaseData[];
}

/* ---- 기본값 ---------------------------------------------------------------- */
export function defaultRaw(): Record<NumericInputId, string> {
  return Object.fromEntries(NUMERIC_INPUTS.map((d) => [d.id, d.defaultValue === null ? '' : String(d.defaultValue)])) as Record<
    NumericInputId,
    string
  >;
}

export function defaultCalc(): CalcCaseState {
  return { mode: 'demo', scenario: DEFAULT_SCENARIO, hrsgClass: DEFAULT_HRSG_CLASS, raw: defaultRaw(), edited: {} };
}

export function defaultChecklist(): ChecklistCaseState {
  return {
    reviewed: Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, false])),
    status: Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, 'noMeasured' as ReceiptStatus])),
    notes: {},
    meta: Object.fromEntries(
      CHECKLIST_ITEMS.map((i) => [i.id, { value: '', unit: CHECKLIST_DEFAULT_UNIT[i.id] ?? '', location: '', condition: '', measuredAt: '' }]),
    ),
    clientName: '',
  };
}

let idCounter = 0;
export function newId(prefix: string, now = Date.now()): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}-${now.toString(36)}-${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createCase(name: string, now = new Date()): CaseData {
  const iso = now.toISOString();
  return {
    id: newId('case', now.getTime()),
    name,
    createdAt: iso,
    updatedAt: iso,
    calc: defaultCalc(),
    checklist: defaultChecklist(),
    measurements: [],
    qa: { messages: [] },
    history: [],
    nextSnapshotSeq: 1,
  };
}

export function defaultStore(firstCaseName: string, now = new Date()): StoreData {
  const c = createCase(firstCaseName, now);
  return { version: STORE_VERSION, currentCaseId: c.id, cases: [c] };
}

/* ---- 케이스 조작 (불변 갱신) ------------------------------------------------ */
export function updateCaseIn(store: StoreData, caseId: string, fn: (c: CaseData) => CaseData, now = new Date()): StoreData {
  return {
    ...store,
    cases: store.cases.map((c) => (c.id === caseId ? { ...fn(c), updatedAt: now.toISOString() } : c)),
  };
}

export function addCase(store: StoreData, name: string, now = new Date()): StoreData {
  const c = createCase(name, now);
  return { ...store, cases: [...store.cases, c], currentCaseId: c.id };
}

/** 깊은 복사로 복제 — 원본과 상태를 공유하지 않는다 */
export function duplicateCase(store: StoreData, caseId: string, name: string, now = new Date()): StoreData {
  const src = store.cases.find((c) => c.id === caseId);
  if (!src) return store;
  const copy: CaseData = {
    ...(JSON.parse(JSON.stringify(src)) as CaseData),
    id: newId('case', now.getTime()),
    name,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return { ...store, cases: [...store.cases, copy], currentCaseId: copy.id };
}

export function renameCase(store: StoreData, caseId: string, name: string): StoreData {
  const trimmed = name.trim();
  if (!trimmed) return store;
  return { ...store, cases: store.cases.map((c) => (c.id === caseId ? { ...c, name: trimmed.slice(0, 60) } : c)) };
}

/** 마지막 케이스는 삭제하지 않는다. 현재 케이스를 지우면 인접 케이스를 선택한다. */
export function deleteCase(store: StoreData, caseId: string): StoreData {
  if (store.cases.length <= 1) return store;
  const idx = store.cases.findIndex((c) => c.id === caseId);
  if (idx < 0) return store;
  const cases = store.cases.filter((c) => c.id !== caseId);
  const currentCaseId = store.currentCaseId === caseId ? cases[Math.max(0, idx - 1)].id : store.currentCaseId;
  return { ...store, cases, currentCaseId };
}

export function selectCase(store: StoreData, caseId: string): StoreData {
  return store.cases.some((c) => c.id === caseId) ? { ...store, currentCaseId: caseId } : store;
}

/* ---- 검증·마이그레이션 ------------------------------------------------------ */
export type LoadOutcome =
  | { kind: 'empty' }
  | { kind: 'ok'; store: StoreData; migrated: boolean }
  | { kind: 'invalid'; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);

const RECEIPT: ReceiptStatus[] = ['noMeasured', 'requestNeeded', 'received', 'needsVerification'];

/** 저장된 케이스 하나를 현재 구조로 보정한다 — 누락 필드는 기본값으로 채우고 알 수 없는 값은 버린다 */
function normalizeCase(raw: unknown, index: number): CaseData | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null;
  const base = createCase(str(raw.name, `Case ${index + 1}`));
  const calcRaw = isObj(raw.calc) ? raw.calc : {};
  const rawInputs = isObj(calcRaw.raw) ? calcRaw.raw : {};
  const calc: CalcCaseState = {
    mode: calcRaw.mode === 'user' ? 'user' : 'demo',
    scenario: ['normal', 'alarm', 'trip', 'custom'].includes(calcRaw.scenario as string)
      ? (calcRaw.scenario as ScenarioSelection)
      : DEFAULT_SCENARIO,
    hrsgClass: calcRaw.hrsgClass === 'J' ? 'J' : 'F',
    raw: Object.fromEntries(
      NUMERIC_INPUTS.map((d) => [d.id, typeof rawInputs[d.id] === 'string' ? (rawInputs[d.id] as string) : base.calc.raw[d.id]]),
    ) as Record<NumericInputId, string>,
    edited: isObj(calcRaw.edited)
      ? Object.fromEntries(Object.entries(calcRaw.edited).filter(([k, v]) => v === true && k in base.calc.raw))
      : {},
  };
  const cl = isObj(raw.checklist) ? raw.checklist : {};
  const clReviewed = isObj(cl.reviewed) ? cl.reviewed : {};
  const clStatus = isObj(cl.status) ? cl.status : {};
  const clNotes = isObj(cl.notes) ? cl.notes : {};
  const clMeta = isObj(cl.meta) ? cl.meta : {};
  const checklist: ChecklistCaseState = {
    reviewed: Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, clReviewed[i.id] === true])),
    status: Object.fromEntries(
      CHECKLIST_ITEMS.map((i) => [i.id, RECEIPT.includes(clStatus[i.id] as ReceiptStatus) ? (clStatus[i.id] as ReceiptStatus) : 'noMeasured']),
    ),
    notes: Object.fromEntries(Object.entries(clNotes).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    meta: Object.fromEntries(
      CHECKLIST_ITEMS.map((i) => {
        const m = isObj(clMeta[i.id]) ? (clMeta[i.id] as Record<string, unknown>) : {};
        const d = base.checklist.meta[i.id];
        return [
          i.id,
          { value: str(m.value, d.value), unit: str(m.unit, d.unit), location: str(m.location, ''), condition: str(m.condition, ''), measuredAt: str(m.measuredAt, '') },
        ];
      }),
    ),
    clientName: str(cl.clientName, ''),
  };
  const measurements = Array.isArray(raw.measurements)
    ? raw.measurements.filter(
        (m): m is MeasuredEntry =>
          isObj(m) && typeof m.id === 'number' && typeof m.day === 'number' &&
          (m.backPressure === null || typeof m.backPressure === 'number') &&
          (m.exhaustTemp === null || typeof m.exhaustTemp === 'number'),
      )
    : [];
  const qaRaw = isObj(raw.qa) ? raw.qa : {};
  const messages = Array.isArray(qaRaw.messages) ? (qaRaw.messages.filter((m) => isObj(m) && typeof m.id === 'number' && typeof m.kind === 'string') as QaMessage[]) : [];
  const history = Array.isArray(raw.history) ? (raw.history.filter((h) => isObj(h) && typeof h.id === 'string' && isObj(h.cleaning) && isObj(h.bp)) as AnalysisSnapshot[]) : [];
  return {
    id: raw.id,
    name: str(raw.name, base.name),
    createdAt: str(raw.createdAt, base.createdAt),
    updatedAt: str(raw.updatedAt, base.updatedAt),
    calc,
    checklist,
    measurements,
    qa: { messages },
    history,
    nextSnapshotSeq: typeof raw.nextSnapshotSeq === 'number' ? raw.nextSnapshotSeq : history.length + 1,
  };
}

/** localStorage 문자열 → 현재 버전 구조. 잘못된 형식은 'invalid'로 돌려준다(예외를 던지지 않음). */
export function parseStore(text: string | null): LoadOutcome {
  if (text === null || text === '') return { kind: 'empty' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'json' };
  }
  if (!isObj(data)) return { kind: 'invalid', reason: 'shape' };
  const version = typeof data.version === 'number' ? data.version : 0;
  if (version > STORE_VERSION) return { kind: 'invalid', reason: 'newer-version' };
  if (!Array.isArray(data.cases)) return { kind: 'invalid', reason: 'shape' };
  const cases = data.cases.map(normalizeCase).filter((c): c is CaseData => c !== null);
  if (cases.length === 0) return { kind: 'invalid', reason: 'no-cases' };
  const currentCaseId = typeof data.currentCaseId === 'string' && cases.some((c) => c.id === data.currentCaseId) ? data.currentCaseId : cases[0].id;
  return { kind: 'ok', store: { version: STORE_VERSION, currentCaseId, cases }, migrated: version !== STORE_VERSION };
}

export function serializeStore(store: StoreData): string {
  return JSON.stringify({ ...store, version: STORE_VERSION });
}
