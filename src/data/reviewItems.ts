import type { Localized } from '@/types';

export interface ReviewCategory {
  id: string;
  label: Localized;
  items: { id: string; label: Localized }[];
}

/** 팀 내부 검토 항목 — 기본 상태는 모두 '미검토'이며 자동으로 완료 처리하지 않는다. */
export const REVIEW_CATEGORIES: ReviewCategory[] = [
  {
    id: 'ux',
    label: { ko: 'UI/UX', en: 'UI/UX' },
    items: [
      { id: 'ux-layout', label: { ko: '탭별 정보 배치와 읽기 흐름', en: 'Information layout and reading flow per tab' } },
      { id: 'ux-responsive', label: { ko: '모바일·태블릿 반응형 레이아웃', en: 'Mobile / tablet responsive layout' } },
      { id: 'ux-a11y', label: { ko: '키보드 조작·색 대비·다크 모드', en: 'Keyboard use, contrast, dark mode' } },
    ],
  },
  {
    id: 'func',
    label: { ko: '기능 동작', en: 'Functionality' },
    items: [
      { id: 'func-qa', label: { ko: 'AI 질의응답 추천 질문·대체 안내', en: 'Q&A presets and fallback notice' } },
      { id: 'func-checklist', label: { ko: '체크리스트 검토/수령 상태 분리', en: 'Checklist review vs. receipt separation' } },
      { id: 'func-email', label: { ko: '이메일 초안 생성·편집·복사', en: 'Email draft generate / edit / copy' } },
      { id: 'func-validation', label: { ko: '세정 전후 비교·실측 입력', en: 'Pre/post comparison and measured input' } },
    ],
  },
  {
    id: 'calc',
    label: { ko: '계산 로직', en: 'Calculation logic' },
    items: [
      { id: 'calc-default', label: { ko: '기본값 결과 (70 / 1.05 / 105,840,000)', en: 'Default results (70 / 1.05 / 105,840,000)' } },
      { id: 'calc-breakeven', label: { ko: '손익분기점 예시 (24일)', en: 'Break-even example (24 days)' } },
      { id: 'calc-consistency', label: { ko: '탭 간 수치 일관성', en: 'Cross-tab number consistency' } },
    ],
  },
  {
    id: 'eng',
    label: { ko: '공학적 기준', en: 'Engineering basis' },
    items: [
      { id: 'eng-coeff', label: { ko: '발전 손실 계수 0.015의 근거', en: 'Basis for the 0.015 loss coefficient' } },
      { id: 'eng-threshold', label: { ko: '배압 임계값 270/300의 근거', en: 'Basis for 270/300 thresholds' } },
      { id: 'eng-pinch', label: { ko: 'Pinch/Approach 계산 기준', en: 'Pinch/approach calculation basis' } },
    ],
  },
  {
    id: 'data',
    label: { ko: '데이터 연동 준비', en: 'Data integration readiness' },
    items: [
      { id: 'data-format', label: { ko: '요청 데이터 형식·단위 정의', en: 'Requested data formats and units' } },
      { id: 'data-replace', label: { ko: '가상값 → 실측값 교체 경로', en: 'Mock → measured replacement path' } },
    ],
  },
  {
    id: 'sec',
    label: { ko: '보안 및 표현', en: 'Security & wording' },
    items: [
      { id: 'sec-name', label: { ko: '기업명 표기 (클라우드라)', en: 'Partner name wording (클라우드라)' } },
      { id: 'sec-citation', label: { ko: '미제공 문서 인용 없음', en: 'No citation of unprovided documents' } },
      { id: 'sec-ai', label: { ko: 'AI/RAG 미연동 고지', en: 'AI/RAG not-connected notice' } },
      { id: 'sec-mock', label: { ko: '가상/실측 데이터 구분 표시', en: 'Mock vs. measured distinction' } },
    ],
  },
];
