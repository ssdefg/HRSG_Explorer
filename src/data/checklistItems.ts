import type { Localized } from '@/types';
import { KIT_CHECKLIST_DATA, type KitChecklistItem } from '@/lib/kit';

/**
 * 데이터 요청 체크리스트 항목 — 키트(hrsg_calc_kit_team1/data/checklist.json)의 49개 항목을 그대로 쓴다.
 * A. 가스터빈/운전 6 · B. HRSG 열역학/설계 13 · C. 세정/유지보수 9 · D. 경제성 3 · E. 확장 18 (필수 16).
 * 필수·우선순위는 키트의 임시 기준이다. 항목명·이유는 키트에 한국어만 있어 영어 화면에도 같은 글자를 보여 준다.
 */

export type ChecklistCategory = 'A' | 'B' | 'C' | 'D' | 'E';
export type Priority = 'high' | 'medium' | 'low';

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  name: Localized;
  reason: Localized;
  /** 단위 또는 데이터 형식 (키트 unit, 없으면 종류) */
  format: Localized;
  priority: Priority;
  /** 키트 필수 여부 */
  required: boolean;
  /** 키트 종류: 설계 · 운전 · 문서 (문서는 측정값 칸에 「문서」) */
  kind: KitChecklistItem['kind'];
  /** 계산기 입력 경로 — 있으면 「계산기 입력에 사용됨」 */
  calcInput: string | null;
  note: Localized;
}

const both = (s: string): Localized => ({ ko: s, en: s });
const KIND_EN: Record<KitChecklistItem['kind'], string> = { design: 'Design', operation: 'Operation', document: 'Document' };

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = KIT_CHECKLIST_DATA.categories.map((c) => c.id as ChecklistCategory);

export const CHECKLIST_CATEGORY_LABEL = Object.fromEntries(
  KIT_CHECKLIST_DATA.categories.map((c) => [c.id, both(c.name)]),
) as Record<ChecklistCategory, Localized>;

export const CHECKLIST_ITEMS: ChecklistItem[] = KIT_CHECKLIST_DATA.items.map((i) => ({
  id: i.id,
  category: i.category as ChecklistCategory,
  name: both(i.name),
  reason: both(i.reason),
  format: i.unit ? both(i.unit) : { ko: KIT_CHECKLIST_DATA.kinds[i.kind], en: KIND_EN[i.kind] },
  priority: i.priority,
  required: i.required,
  kind: i.kind,
  calcInput: i.calc_input,
  note: i.calc_input ? { ko: '계산기 입력에 사용됨', en: 'Used as a calculator input' } : both(''),
}));

/** 측정값 입력란의 기본 단위 (키트 unit, 사용자가 수정 가능) */
export const CHECKLIST_DEFAULT_UNIT: Record<string, string> = Object.fromEntries(KIT_CHECKLIST_DATA.items.map((i) => [i.id, i.unit ?? '']));

/** 필수 데이터 = 키트 required 항목 (16개) */
export const REQUIRED_ITEM_IDS: string[] = CHECKLIST_ITEMS.filter((i) => i.required).map((i) => i.id);
