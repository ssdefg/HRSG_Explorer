import type { Localized, TabId } from '@/types';

/**
 * AI 어시스턴트 추천 질문 — 현재 화면에 따라 순서·구성이 바뀐다.
 * 'AI에게 질문하기' 버튼이 화면 데이터를 첨부할 때 입력창에 넣는 기본 질문(ASK_DRAFT)도 여기 둔다.
 */
const Q = {
  performance: { ko: '현재 HRSG 성능을 설명해 줘.', en: 'Explain the current HRSG performance.' },
  backPressure: { ko: '배압이 증가하면 발전 출력이 왜 감소해?', en: 'Why does power output drop when back pressure rises?' },
  needCleaning: { ko: '세정이 필요한지 검토해 줘.', en: 'Review whether cleaning is needed.' },
  methods: { ko: '세정 공법별 경제성을 비교해 줘.', en: 'Compare the economics of the cleaning methods.' },
  pinch: { ko: 'Pinch Point와 Approach Point를 설명해 줘.', en: 'Explain the pinch point and approach point.' },
  moreData: { ko: '평가를 위해 어떤 데이터가 더 필요해?', en: 'What additional data is needed for the evaluation?' },
  stackTemp: { ko: '스택 온도가 높으면 무엇을 의미해?', en: 'What does a high stack temperature indicate?' },
  verifyEffect: { ko: '세정 효과를 검증하려면 무엇을 비교해야 해?', en: 'What should be compared to verify the cleaning effect?' },
  loadCorrection: { ko: '세정 전후 운전 조건이 다르면 어떻게 보정해?', en: 'How do I correct for different pre/post operating conditions?' },
  missingImpact: { ko: '누락된 필수 데이터가 평가에 어떤 영향을 줘?', en: 'How do the missing required items affect the evaluation?' },
} satisfies Record<string, Localized>;

export const ASSISTANT_SUGGESTIONS: Record<TabId, Localized[]> = {
  dashboard: [Q.performance, Q.needCleaning, Q.backPressure, Q.methods, Q.moreData, Q.pinch],
  calculator: [Q.backPressure, Q.methods, Q.pinch, Q.needCleaning, Q.stackTemp, Q.moreData],
  checklist: [Q.moreData, Q.missingImpact, Q.needCleaning, Q.verifyEffect, Q.performance, Q.pinch],
  validation: [Q.verifyEffect, Q.loadCorrection, Q.methods, Q.stackTemp, Q.needCleaning, Q.performance],
};

/** 'AI에게 질문하기'로 화면 데이터를 첨부할 때의 기본 질문 */
export const ASK_DRAFT: Record<TabId, Localized> = {
  dashboard: { ko: '첨부한 대시보드 요약을 기준으로 현재 HRSG 상태와 세정 필요성을 문헌 근거와 함께 설명해 줘.', en: 'Based on the attached dashboard summary, explain the current HRSG state and cleaning need with literature evidence.' },
  calculator: { ko: '첨부한 계산 결과의 의미와, 판단 전에 추가로 필요한 데이터를 문헌 근거와 함께 알려 줘.', en: 'Explain the attached calculation results and what extra data is needed before deciding, with literature evidence.' },
  checklist: { ko: '첨부한 체크리스트 현황에서 누락·검증 필요 데이터가 평가에 주는 영향과 우선순위를 알려 줘.', en: 'From the attached checklist status, how do missing / unverified items affect the evaluation, and what should come first?' },
  validation: { ko: '첨부한 세정 전후 비교값으로 세정 효과를 어떻게 해석하고 검증해야 하는지 알려 줘.', en: 'How should the cleaning effect in the attached pre/post comparison be interpreted and verified?' },
};
