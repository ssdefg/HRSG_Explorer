import type { Localized } from '@/types';

export type QaAnswerId = 'bpImpact' | 'cleaningNeedData' | 'dryIceVsWater' | 'pinchApproach' | 'validationData';

export interface QaPreset {
  id: QaAnswerId;
  question: Localized;
  /** 하나 이상 포함되어야 후보가 되는 핵심어 (공백 제거·소문자 기준) */
  required: string[];
  /** 점수를 더하는 보조어 */
  related: string[];
}

/**
 * 사전 작성된 시연용 질문 목록. 실제 AI/RAG가 아니라, 입력 문장과 이 목록을 대조해
 * 준비된 답변을 고르는 단순 매칭에 쓰인다.
 */
export const QA_PRESETS: QaPreset[] = [
  {
    id: 'bpImpact',
    question: {
      ko: 'HRSG 배압이 증가하면 발전 성능에 어떤 영향을 주는가?',
      en: 'How does rising HRSG back pressure affect generating performance?',
    },
    required: ['배압', '차압', 'backpressure', 'pressuredrop'],
    related: ['증가', '상승', '발전', '성능', '출력', '영향', '손실', 'increase', 'rise', 'power', 'output', 'performance', 'impact', 'effect', 'loss'],
  },
  {
    id: 'cleaningNeedData',
    question: {
      ko: '현재 조건에서 세정 필요성을 판단하려면 어떤 데이터가 필요한가?',
      en: 'What data is needed to judge whether cleaning is necessary under current conditions?',
    },
    required: ['필요성', '판단', '세정시점', 'necessary', 'necessity', 'judge', 'decide', 'whethercleaning'],
    related: ['세정', '데이터', '자료', '현재', '조건', 'cleaning', 'data', 'current', 'condition'],
  },
  {
    id: 'dryIceVsWater',
    question: {
      ko: '드라이아이스 세정과 고압수 세정의 차이는 무엇인가?',
      en: 'What is the difference between dry-ice blasting and high-pressure water cleaning?',
    },
    required: ['드라이아이스', '고압수', '약품세정', 'dryice', 'highpressurewater', 'waterjet', 'chemical'],
    related: ['차이', '비교', '장단점', '세정', '방식', 'difference', 'compare', 'vs', 'cleaning', 'method'],
  },
  {
    id: 'pinchApproach',
    question: {
      ko: 'Pinch Point와 Approach Point는 각각 무엇을 의미하는가?',
      en: 'What do the pinch point and approach point each mean?',
    },
    required: ['pinch', 'approach', '핀치', '어프로치'],
    related: ['point', '포인트', '의미', '정의', '무엇', '뭐', 'mean', 'definition', 'what'],
  },
  {
    id: 'validationData',
    question: {
      ko: '세정 전후의 성능 개선 효과를 검증하려면 어떤 자료가 필요한가?',
      en: 'What data is needed to validate the performance improvement before and after cleaning?',
    },
    required: ['전후', '검증', '개선효과', 'beforeandafter', 'prepost', 'validate', 'validation', 'verify'],
    related: ['세정', '성능', '개선', '효과', '자료', '데이터', 'cleaning', 'performance', 'improvement', 'data'],
  },
];
