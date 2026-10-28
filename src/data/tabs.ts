import type { Localized, TabId } from '@/types';

export interface TabDef {
  id: TabId;
  order: number;
  label: Localized;
  short: Localized;
}

/** 좌측 사이드바 메뉴 (순서 고정). AI 질의응답은 독립 메뉴가 아니라 대시보드 최상단에 있다. */
export const TABS: TabDef[] = [
  { id: 'dashboard', order: 1, label: { ko: '대시보드', en: 'Dashboard' }, short: { ko: '대시보드', en: 'Dashboard' } },
  { id: 'calculator', order: 2, label: { ko: '계산기', en: 'Calculator' }, short: { ko: '계산기', en: 'Calculator' } },
  { id: 'checklist', order: 3, label: { ko: '데이터 요청 체크리스트', en: 'Data Request Checklist' }, short: { ko: '체크리스트', en: 'Checklist' } },
  { id: 'validation', order: 4, label: { ko: '세정 전후', en: 'Pre/Post Cleaning' }, short: { ko: '세정 전후', en: 'Pre/Post' } },
];

export const DEFAULT_TAB: TabId = 'dashboard';

export function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

/** 화면 안에서 이동 대상이 되는 섹션 id */
export const SECTION_IDS = {
  /** 대시보드 최상단 AI 질의응답 */
  ai: 'dash-ai',
  /** 세정 전후 화면의 상세 분석 */
  validation: 'calc-validation',
  inventory: 'calc-inventory',
  economics: 'calc-economics',
} as const;
