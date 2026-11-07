/**
 * 체크리스트 어댑터 — 키트(hrsg_calc_kit_team1) 체크리스트 49개 항목·상태 스키마 ↔ 앱 화면.
 *
 * 단일 기준은 키트다: 항목(data/checklist.json), 수급·검증 상태 키, 수령률·필수 충족 계산(checklist.js).
 * 진행 상태는 키트 형식 { [id]: { supply, verify, reviewed, value, note } } 그대로 저장한다.
 * 키트 progress 에 없는 앱 전용 정보(측정 단위·위치·조건·일시)는 따로 저장한다 (validateProgress 가 모르는 필드를 경고하므로).
 */
import { KIT_CHECKLIST_DATA as C, kitChecklist, type KitProgress, type KitSupply, type KitVerify } from '@/lib/kit';

export type Supply = KitSupply;
export type Verify = KitVerify;

/** 키트 상태 키 순서 (화면 드롭다운·분포 표시 순서) */
export const SUPPLY_STATES = Object.keys(C.supply_states) as Supply[];
export const VERIFY_STATES = Object.keys(C.verify_states) as Verify[];
export const SUPPLY_LABEL = C.supply_states;
export const VERIFY_LABEL = C.verify_states;

/** 이전 앱 버전의 수령 상태 → 키트 supply 키 (저장 데이터 이전용) */
export const LEGACY_SUPPLY: Record<string, Supply> = {
  noMeasured: 'not_entered',
  requestNeeded: 'requested',
  received: 'received',
  needsVerification: 'verify_needed',
};

export const isSupply = (v: unknown): v is Supply => typeof v === 'string' && v in C.supply_states;
export const isVerify = (v: unknown): v is Verify => typeof v === 'string' && v in C.verify_states;

/** 키트 진행 상태 검사 — 모르는 항목 ID·화면 글자를 그대로 넣은 상태 값 */
export function validateProgress(progress: KitProgress) {
  return kitChecklist.validateProgress(C, progress);
}

/** 카테고리 하나의 항목만 담은 키트 데이터 (카테고리별 kpis 계산용) */
function scoped(category?: string) {
  return category ? { ...C, items: C.items.filter((i) => i.category === category) } : C;
}

export interface KitProgressStats {
  /** 해당 없음(na)을 뺀 항목 수 — 모든 비율의 분모 */
  total: number;
  receivedCount: number;
  receivedPct: number;
  reviewedCount: number;
  reviewPct: number;
  verifiedCount: number;
  verifiedPct: number;
  bySupply: Record<Supply, number>;
}

/** 키트 kpis · distribution 으로 진행률 (category 를 주면 그 카테고리만) */
export function progressStats(progress: KitProgress, category?: string): KitProgressStats {
  const D = scoped(category);
  const k = kitChecklist.kpis(D, progress);
  const dist = kitChecklist.distribution(D, progress);
  return {
    total: k.received.total,
    receivedCount: k.received.done,
    receivedPct: k.received.percent,
    reviewedCount: k.reviewed.done,
    reviewPct: k.reviewed.percent,
    verifiedCount: k.verified.done,
    verifiedPct: k.verified.percent,
    bySupply: dist.supply,
  };
}

export interface KitReadiness {
  requiredTotal: number;
  requiredMetCount: number;
  /** 필수 충족(키트 isSatisfied: 수령 + 검증 실패 아님)이 아닌 필수 항목 — 해당 없음 제외 */
  missingIds: string[];
}

export function requiredReadiness(progress: KitProgress): KitReadiness {
  const k = kitChecklist.kpis(C, progress);
  const required = C.items.filter((i) => i.required && progress[i.id]?.supply !== 'na');
  return {
    requiredTotal: k.required.total,
    requiredMetCount: k.required.done,
    missingIds: required.filter((i) => !kitChecklist.isSatisfied(progress, i.id)).map((i) => i.id),
  };
}

/** 키트 요청 메일 문구 (선택 ID, 없으면 미수령 전체) — 복사용, 발송하지 않음 */
export function kitEmailDraft(progress: KitProgress, ids: string[] | null, plant = ''): string {
  return kitChecklist.emailDraft(C, progress, { ids, plant });
}
