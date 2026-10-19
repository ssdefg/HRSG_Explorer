import type { Localized, TabId } from '@/types';

export interface TabDef {
  id: TabId;
  order: number;
  label: Localized;
  short: Localized;
}

export const TABS: TabDef[] = [
  { id: 'qa', order: 1, label: { ko: 'AI 질의응답', en: 'AI Q&A' }, short: { ko: '질의응답', en: 'Q&A' } },
  { id: 'calculator', order: 2, label: { ko: '성능·경제성 계산기', en: 'Performance & Economics' }, short: { ko: '계산기', en: 'Calculator' } },
  { id: 'checklist', order: 3, label: { ko: '데이터 요청 체크리스트', en: 'Data Request Checklist' }, short: { ko: '체크리스트', en: 'Checklist' } },
  { id: 'validation', order: 4, label: { ko: '세정 전후 검증', en: 'Pre/Post Cleaning Validation' }, short: { ko: '세정 검증', en: 'Validation' } },
];

export const DEFAULT_TAB: TabId = 'qa';

export function isTabId(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}
