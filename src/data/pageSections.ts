import type { Localized, TabId } from '@/types';

export interface PageMeta {
  title: Localized;
  description: Localized;
}

/** 각 화면의 제목과 설명 */
export const PAGE_META: Record<TabId, PageMeta> = {
  dashboard: {
    title: { ko: '대시보드 / 개요', en: 'Dashboard / Overview' },
    description: {
      ko: '상단의 AI 질의응답에서 질문하고, 현재 평가 케이스의 운전 상태, 데이터 준비 현황, 성능·경제성 요약을 확인하고 상세 화면으로 이동합니다. 모든 수치는 시연용 가상 데이터와 예시 계산입니다.',
      en: 'Ask questions in the AI Q&A at the top, review the current case’s operating state, data readiness and performance/economics summary, and jump to detail screens. All figures are mock data and example calculations.',
    },
  },
  calculator: {
    title: { ko: '성능·경제성 계산기', en: 'Performance & Economics Calculator' },
    description: {
      ko: '배압 상승에 따른 발전 손실과 세정 경제성을 예시 계산식으로 산정합니다. 입력값을 바꾸면 이전 결과가 가려지고 "재평가 필요"가 표시되며, "재평가 실행"으로 다시 계산합니다. 세정 전후 상세 분석은 "세정 전후" 메뉴에 있습니다.',
      en: 'Estimates back-pressure-driven power loss and cleaning economics with example formulas. Editing an input hides the previous results and shows "Re-evaluation needed" until you re-evaluate. The detailed pre/post-cleaning analysis is in the "Pre/Post Cleaning" menu.',
    },
  },
  checklist: {
    title: { ko: '데이터 요청 체크리스트', en: 'Data Request Checklist' },
    description: {
      ko: '클라우드라에 요청하거나 향후 확보해야 할 HRSG 관련 데이터의 수급 상태와 검토 상태를 관리합니다.',
      en: 'Tracks receipt and review status of HRSG data to request from or obtain with 클라우드라.',
    },
  },
  validation: {
    title: { ko: '세정 전후', en: 'Pre/Post Cleaning' },
    description: {
      ko: '세정 전후 배압·스택 온도·회수 출력·누적 편익을 가상 시나리오로 비교하고, 실측 스냅샷을 입력해 함께 확인합니다. 계산기와 같은 케이스 입력값·중앙 계산 결과를 사용합니다.',
      en: 'Compares pre/post-cleaning back pressure, stack temperature, recovered output and cumulative benefit in a mock scenario, with measured snapshots you enter. Uses the same case inputs and central calculation results as the calculator.',
    },
  },
};
