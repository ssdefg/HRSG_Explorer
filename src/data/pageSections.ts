import type { Localized, TabId } from '@/types';

export interface PageMeta {
  title: Localized;
  description: Localized;
}

/** 각 탭의 페이지 제목과 설명 */
export const PAGE_META: Record<TabId, PageMeta> = {
  qa: {
    title: { ko: 'AI 질의응답', en: 'AI Q&A' },
    description: {
      ko: 'HRSG 운전 상태, 성능 저하, 세정 방식, 경제성, 추가 데이터 요청에 관한 질문과 시연용 답변을 확인합니다. 실제 AI/RAG는 연결되어 있지 않습니다.',
      en: 'Ask about HRSG operation, degradation, cleaning methods, economics and data requests, and view demo answers. No real AI/RAG is connected.',
    },
  },
  calculator: {
    title: { ko: '성능·경제성 계산기', en: 'Performance & Economics Calculator' },
    description: {
      ko: '배압 상승에 따른 발전 손실과 세정 방식별 경제성을 예시 계산식으로 산정합니다. 입력값을 바꾸면 KPI·게이지·차트가 즉시 갱신됩니다.',
      en: 'Estimates back-pressure-driven power loss and cleaning economics with example formulas. KPIs, gauge and charts update as inputs change.',
    },
  },
  checklist: {
    title: { ko: '데이터 요청 체크리스트', en: 'Data Request Checklist' },
    description: {
      ko: '클라우드라에 요청하거나 향후 확보해야 할 HRSG 관련 데이터의 검토 상태와 수령 상태를 관리합니다.',
      en: 'Tracks review and receipt status of HRSG data to request from or obtain with 클라우드라.',
    },
  },
  validation: {
    title: { ko: '세정 전후 검증', en: 'Pre/Post Cleaning Validation' },
    description: {
      ko: '세정 전후의 운전 조건과 성능 지표를 비교합니다. 현재는 가상 시나리오로 화면을 시연하며, 실측 데이터를 입력할 수 있는 구조를 제공합니다.',
      en: 'Compares operating conditions and indicators before and after cleaning. Currently demonstrated with a mock scenario, with a structure for entering measured data.',
    },
  },
};
