/**
 * 로컬 케이스 저장 구조 — React와 무관한 순수 함수.
 * 각 케이스는 입력값·모드·시나리오·체크리스트·실측 스냅샷·AI 대화·분석 이력을 독립적으로 가진다.
 * localStorage(사용자 브라우저)에만 저장된다 — 서버 저장·사용자 간 동기화가 아니다.
 */
import type { KitProgress, KitProgressEntry } from '@/lib/kit';
import { LEGACY_SUPPLY, isSupply, isVerify } from '@/lib/checklist_adapter';
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
import type { ContextSnapshot } from '@/lib/aiContext';

export const STORE_VERSION = 5;
/** 최종 구현 가이드 §1.3 의 저장 키 */
export const STORE_KEY = 'hrsg_explorer_v1_cases';
/** 버전 2 이하가 쓰던 키 — 새 키가 비어 있으면 여기서 읽어 옮긴다 */
export const LEGACY_STORE_KEY = 'hrsg.workspace';

/* ---- 타입 ---------------------------------------------------------------- */
export interface CalcCaseState {
  mode: EvaluationMode;
  /** 사용자가 고른 시나리오 (배압 자동 판별 결과와 별개의 필드) */
  scenario: ScenarioSelection;
  hrsgClass: HrsgClass;
  raw: Record<NumericInputId, string>;
  /** 기본값에서 사용자가 직접 바꾼 입력 — 데이터 출처 표시에 사용 */
  edited: Partial<Record<NumericInputId, boolean>>;
  /** 입력란별 선택 단위 (없으면 기준 단위) — raw 는 이 단위로 적힌 원문 */
  units: Partial<Record<NumericInputId, string>>;
  /** 마지막 계산 실행 후 입력이 바뀜 → 결과를 가리고 '재평가 필요' 표시 */
  stale: boolean;
}

/** 세정 전후 운전 조건 (원문) — 편차가 크면 세정 효과를 단정하지 않는다 */
export interface OperatingConditions {
  beforeLoadPct: string;
  afterLoadPct: string;
  beforeAmbientC: string;
  afterAmbientC: string;
}

/** 앱 전용 측정 정보 — 키트 progress 에는 없는 필드 (측정값 value 는 키트 progress 에 있음) */
export interface ChecklistExt {
  unit: string;
  location: string;
  condition: string;
  /** datetime-local 문자열 */
  measuredAt: string;
}

/** 화면에서 쓰는 항목별 측정 정보 = 키트 value + 앱 전용 정보 */
export interface ChecklistMeta extends ChecklistExt {
  value: string;
}

export interface ChecklistCaseState {
  /** 키트 표준 진행 상태 { [id]: { supply, verify, reviewed, value, note } } — 기본값인 항목은 키가 없다 */
  progress: KitProgress;
  ext: Record<string, ChecklistExt>;
  /** 이메일 초안의 고객사/발전소명 (LLM 으로 보내지 않음) */
  clientName: string;
}

export interface MeasuredEntry {
  id: number;
  /** 세정일 기준 경과일 (음수: 전, 0: 당일, 양수: 후) */
  day: number;
  backPressure: number | null;
  exhaustTemp: number | null;
}

export type QaMessage =
  /** context: 'AI에게 질문하기'로 첨부한 화면 데이터 (서버로 함께 전송된 스냅샷 그대로) */
  | { id: number; at: string; kind: 'question'; text: string; snapshotId?: string; context?: ContextSnapshot }
  /** 이전 버전의 사전 작성 시연용 답변 — 기록 보존용으로 표시만 하고 새로 만들지 않는다 */
  | { id: number; at: string; kind: 'answer'; answerId: QaAnswerId; via: 'preset' | 'exact' | 'keyword' | 'snapshot'; snapshotId?: string }
  | { id: number; at: string; kind: 'fallback' }
  /** server: RAG 서버에 연결할 수 없음 — question 으로 다시 시도 */
  | { id: number; at: string; kind: 'error'; reason: 'snapshot-missing' | 'server'; question?: string; context?: ContextSnapshot }
  /** 참고문헌 RAG 서버(server/app.py)의 답변 — 응답을 받은 그대로 저장한다 */
  | ({ id: number; at: string; kind: 'rag'; context?: ContextSnapshot } & RagResult);

/** 케이스 안의 대화 하나 — 새 대화·기록 불러오기·삭제 단위 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: QaMessage[];
}

export interface QaCaseState {
  conversations: Conversation[];
  /** 현재 열린 대화 — null 이면 다음 질문에서 새 대화를 만든다 */
  activeId: string | null;
}

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
  conditions: OperatingConditions;
  qa: QaCaseState;
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
  return { mode: 'demo', scenario: DEFAULT_SCENARIO, hrsgClass: DEFAULT_HRSG_CLASS, raw: defaultRaw(), edited: {}, units: {}, stale: false };
}

export function defaultConditions(): OperatingConditions {
  return { beforeLoadPct: '', afterLoadPct: '', beforeAmbientC: '', afterAmbientC: '' };
}

export function defaultExt(id: string): ChecklistExt {
  return { unit: CHECKLIST_DEFAULT_UNIT[id] ?? '', location: '', condition: '', measuredAt: '' };
}

export function defaultChecklist(): ChecklistCaseState {
  return {
    progress: {}, // 키트 resetProgress() 와 같은 처음 상태
    ext: Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.id, defaultExt(i.id)])),
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
    conditions: defaultConditions(),
    qa: { conversations: [], activeId: null },
    history: [],
    nextSnapshotSeq: 1,
  };
}

export function defaultStore(firstCaseName: string, now = new Date()): StoreData {
  const c = createCase(firstCaseName, now);
  return { version: STORE_VERSION, currentCaseId: c.id, cases: [c] };
}

/* ---- 대화 ------------------------------------------------------------------ */
export const CONVERSATION_LIMIT = 50;

/** 첫 질문으로 대화 제목을 만든다 */
export function conversationTitle(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || '새 대화';
}

export function newConversation(now = new Date(), title = '', id = newId('conv', now.getTime())): Conversation {
  const iso = now.toISOString();
  return { id, title, createdAt: iso, updatedAt: iso, messages: [] };
}

/**
 * 활성 대화에 메시지를 붙인다. 활성 대화가 없으면 newConvId 로 새로 만든다 (최신 대화가 앞).
 * 호출하는 쪽이 새 대화 id 를 미리 정해 두면, 답변을 같은 대화에 넣을 수 있다.
 */
export function appendToActive(
  qa: QaCaseState,
  build: (nextId: number, at: string) => QaMessage[],
  now = new Date(),
  newConvId = newId('conv', now.getTime()),
): QaCaseState {
  const at = now.toISOString();
  const conv = qa.conversations.find((c) => c.id === qa.activeId) ?? newConversation(now, '', newConvId);
  const next = Math.max(0, ...conv.messages.map((m) => m.id)) + 1;
  const added = build(next, at);
  const firstQ = added.find((m): m is Extract<QaMessage, { kind: 'question' }> => m.kind === 'question');
  const updated: Conversation = {
    ...conv,
    title: conv.title || (firstQ ? conversationTitle(firstQ.text) : conv.title),
    updatedAt: at,
    messages: [...conv.messages, ...added],
  };
  const rest = qa.conversations.filter((c) => c.id !== updated.id);
  return { conversations: [updated, ...rest].slice(0, CONVERSATION_LIMIT), activeId: updated.id };
}

/** 특정 대화에 메시지를 붙인다 (답변이 늦게 도착해도 질문한 대화에 들어가도록) */
export function appendToConversation(qa: QaCaseState, convId: string, build: (nextId: number, at: string) => QaMessage[], now = new Date()): QaCaseState {
  const conv = qa.conversations.find((c) => c.id === convId);
  if (!conv) return qa; // 그 사이 삭제됨
  const at = now.toISOString();
  const next = Math.max(0, ...conv.messages.map((m) => m.id)) + 1;
  return {
    ...qa,
    conversations: qa.conversations.map((c) => (c.id === convId ? { ...c, updatedAt: at, messages: [...c.messages, ...build(next, at)] } : c)),
  };
}

export function deleteConversation(qa: QaCaseState, convId: string): QaCaseState {
  return { conversations: qa.conversations.filter((c) => c.id !== convId), activeId: qa.activeId === convId ? null : qa.activeId };
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

/** 저장된 체크리스트를 키트 progress + 앱 전용 정보로 보정 (버전 4 이하 형식은 키트 형식으로 옮긴다) */
function normalizeChecklist(cl: Record<string, unknown>): ChecklistCaseState {
  const ids = new Set(CHECKLIST_ITEMS.map((i) => i.id));
  const progress: KitProgress = {};
  const put = (id: string, patch: KitProgressEntry) => {
    const next = { ...progress[id], ...patch };
    if (Object.keys(next).length) progress[id] = next;
  };
  if (isObj(cl.progress)) {
    for (const [id, p] of Object.entries(cl.progress)) {
      if (!ids.has(id) || !isObj(p)) continue;
      put(id, {
        ...(isSupply(p.supply) ? { supply: p.supply } : {}),
        ...(isVerify(p.verify) ? { verify: p.verify } : {}),
        ...(p.reviewed === true ? { reviewed: true } : {}),
        ...(typeof p.value === 'string' && p.value !== '' ? { value: p.value } : {}),
        ...(typeof p.note === 'string' && p.note !== '' ? { note: p.note } : {}),
      });
    }
  } else {
    // 버전 4 이하: reviewed / status / notes / meta.value → 키트 progress
    const rv = isObj(cl.reviewed) ? cl.reviewed : {};
    const st = isObj(cl.status) ? cl.status : {};
    const nt = isObj(cl.notes) ? cl.notes : {};
    const mt = isObj(cl.meta) ? cl.meta : {};
    for (const id of ids) {
      const supply = LEGACY_SUPPLY[String(st[id])];
      const value = isObj(mt[id]) ? (mt[id] as Record<string, unknown>).value : undefined;
      put(id, {
        ...(supply && supply !== 'not_entered' ? { supply } : {}),
        ...(rv[id] === true ? { reviewed: true } : {}),
        ...(typeof value === 'string' && value !== '' ? { value } : {}),
        ...(typeof nt[id] === 'string' && nt[id] !== '' ? { note: nt[id] as string } : {}),
      });
    }
  }
  const extRaw = isObj(cl.ext) ? cl.ext : isObj(cl.meta) ? cl.meta : {};
  const ext = Object.fromEntries(
    CHECKLIST_ITEMS.map((i) => {
      const m = isObj(extRaw[i.id]) ? (extRaw[i.id] as Record<string, unknown>) : {};
      const d = defaultExt(i.id);
      return [i.id, { unit: str(m.unit, d.unit), location: str(m.location, ''), condition: str(m.condition, ''), measuredAt: str(m.measuredAt, '') }];
    }),
  );
  return { progress, ext, clientName: str(cl.clientName, '') };
}

/** 저장된 케이스 하나를 현재 구조로 보정한다 — 누락 필드는 기본값으로 채우고 알 수 없는 값은 버린다 */
function normalizeCase(raw: unknown, index: number, version: number): CaseData | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null;
  const base = createCase(str(raw.name, `Case ${index + 1}`));
  const calcRaw = isObj(raw.calc) ? raw.calc : {};
  const editedRaw = isObj(calcRaw.edited) ? calcRaw.edited : {};
  // 버전 2 이하는 기본값 체계가 달랐다 — 사용자가 직접 바꾼 입력만 옮기고 나머지는 새 기본값
  const rawInputs = isObj(calcRaw.raw)
    ? version >= 3
      ? calcRaw.raw
      : Object.fromEntries(Object.entries(calcRaw.raw).filter(([k]) => editedRaw[k] === true))
    : {};
  const unitsRaw = isObj(calcRaw.units) ? calcRaw.units : {};
  const calc: CalcCaseState = {
    mode: calcRaw.mode === 'user' ? 'user' : 'demo',
    scenario: ['normal', 'alarm', 'trip', 'custom'].includes(calcRaw.scenario as string)
      ? (calcRaw.scenario as ScenarioSelection)
      : DEFAULT_SCENARIO,
    // 키트 GT 등급 F/H/E — 예전 J 등급 등 모르는 값은 기본 등급으로
    hrsgClass: (['F', 'H', 'E'] as const).find((c) => c === calcRaw.hrsgClass) ?? DEFAULT_HRSG_CLASS,
    raw: Object.fromEntries(
      NUMERIC_INPUTS.map((d) => [d.id, typeof rawInputs[d.id] === 'string' ? (rawInputs[d.id] as string) : base.calc.raw[d.id]]),
    ) as Record<NumericInputId, string>,
    edited: Object.fromEntries(Object.entries(editedRaw).filter(([k, v]) => v === true && k in base.calc.raw)),
    units: Object.fromEntries(Object.entries(unitsRaw).filter(([k, v]) => typeof v === 'string' && k in base.calc.raw)) as Partial<
      Record<NumericInputId, string>
    >,
    stale: calcRaw.stale === true,
  };
  const checklist = normalizeChecklist(isObj(raw.checklist) ? raw.checklist : {});
  const measurements = Array.isArray(raw.measurements)
    ? raw.measurements.filter(
        (m): m is MeasuredEntry =>
          isObj(m) && typeof m.id === 'number' && typeof m.day === 'number' &&
          (m.backPressure === null || typeof m.backPressure === 'number') &&
          (m.exhaustTemp === null || typeof m.exhaustTemp === 'number'),
      )
    : [];
  const condRaw = isObj(raw.conditions) ? raw.conditions : {};
  const conditions: OperatingConditions = {
    beforeLoadPct: str(condRaw.beforeLoadPct, ''),
    afterLoadPct: str(condRaw.afterLoadPct, ''),
    beforeAmbientC: str(condRaw.beforeAmbientC, ''),
    afterAmbientC: str(condRaw.afterAmbientC, ''),
  };
  const qaRaw = isObj(raw.qa) ? raw.qa : {};
  const validMsgs = (list: unknown): QaMessage[] =>
    Array.isArray(list) ? (list.filter((m) => isObj(m) && typeof m.id === 'number' && typeof m.kind === 'string') as QaMessage[]) : [];
  let qa: QaCaseState;
  if (Array.isArray(qaRaw.conversations)) {
    const conversations = qaRaw.conversations
      .filter((c): c is Record<string, unknown> => isObj(c) && typeof c.id === 'string')
      .map((c) => ({
        id: c.id as string,
        title: str(c.title, ''),
        createdAt: str(c.createdAt, base.createdAt),
        updatedAt: str(c.updatedAt, base.createdAt),
        messages: validMsgs(c.messages),
      }));
    const activeId = typeof qaRaw.activeId === 'string' && conversations.some((c) => c.id === qaRaw.activeId) ? qaRaw.activeId : null;
    qa = { conversations, activeId };
  } else {
    // 버전 3 이하: 케이스당 대화 하나 → 대화 목록의 첫 대화로 옮긴다
    const messages = validMsgs(qaRaw.messages);
    const firstQ = messages.find((m): m is Extract<QaMessage, { kind: 'question' }> => m.kind === 'question');
    const conv: Conversation | null = messages.length
      ? {
          id: `conv-legacy-${raw.id}`,
          title: firstQ ? conversationTitle(firstQ.text) : '이전 대화',
          createdAt: messages[0].at ?? base.createdAt,
          updatedAt: messages[messages.length - 1].at ?? base.createdAt,
          messages,
        }
      : null;
    qa = { conversations: conv ? [conv] : [], activeId: conv?.id ?? null };
  }
  const history = Array.isArray(raw.history) ? (raw.history.filter((h) => isObj(h) && typeof h.id === 'string' && isObj(h.cleaning) && isObj(h.bp)) as AnalysisSnapshot[]) : [];
  return {
    id: raw.id,
    name: str(raw.name, base.name),
    createdAt: str(raw.createdAt, base.createdAt),
    updatedAt: str(raw.updatedAt, base.updatedAt),
    calc,
    checklist,
    measurements,
    conditions,
    qa,
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
  const cases = data.cases.map((c, i) => normalizeCase(c, i, version)).filter((c): c is CaseData => c !== null);
  if (cases.length === 0) return { kind: 'invalid', reason: 'no-cases' };
  const currentCaseId = typeof data.currentCaseId === 'string' && cases.some((c) => c.id === data.currentCaseId) ? data.currentCaseId : cases[0].id;
  return { kind: 'ok', store: { version: STORE_VERSION, currentCaseId, cases }, migrated: version !== STORE_VERSION };
}

export function serializeStore(store: StoreData): string {
  return JSON.stringify({ ...store, version: STORE_VERSION });
}
