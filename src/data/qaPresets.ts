import type { Localized } from '@/types';

export type QaCategory = 'thermo' | 'economics' | 'pinch' | 'data';

export type QaPresetId =
  // 열역학·성능 영향
  | 'bpImpact'
  | 'dpCause'
  | 'stackTemp'
  | 'foulingImpact'
  // 세정 공법 및 경제성
  | 'methodCompare'
  | 'costBasis'
  | 'econData'
  // 핀치/어프로치 포인트
  | 'pinchDef'
  | 'approachDef'
  | 'pinchData'
  // 필요 데이터 가이드
  | 'cleaningNeedData'
  | 'checklistUse'
  | 'missingData'
  | 'validationData';

/** 추천 질문 답변 + 계산기에서 넘어온 결과 스냅샷 해설 */
export type QaAnswerId = QaPresetId | 'resultSummary';

export interface QaPreset {
  id: QaPresetId;
  category: QaCategory;
  question: Localized;
  /** 하나 이상 포함되어야 후보가 되는 핵심어 (공백 제거·소문자 기준) */
  required: string[];
  /** 점수를 더하는 보조어 */
  related: string[];
}

export const QA_CATEGORY_LABEL: Record<QaCategory, Localized> = {
  thermo: { ko: '열역학·성능 영향', en: 'Thermodynamics & performance' },
  economics: { ko: '세정 공법 및 경제성', en: 'Cleaning methods & economics' },
  pinch: { ko: '핀치/어프로치 포인트', en: 'Pinch / approach point' },
  data: { ko: '필요 데이터 가이드', en: 'Required data guide' },
};

export const QA_CATEGORIES: QaCategory[] = ['thermo', 'economics', 'pinch', 'data'];

/**
 * 사전 작성된 시연용 질문 목록. 실제 AI/RAG가 아니라, 입력 문장과 이 목록을 대조해
 * 준비된 답변을 고르는 단순 매칭에 쓰인다. 의미가 겹치는 질문은 하나로 정리했다.
 */
export const QA_PRESETS: QaPreset[] = [
  {
    id: 'bpImpact', category: 'thermo',
    question: { ko: 'HRSG 배압이 증가하면 발전 성능에 어떤 영향을 주는가?', en: 'How does rising HRSG back pressure affect generating performance?' },
    required: ['배압', 'backpressure'],
    related: ['증가', '상승', '발전', '성능', '출력', '영향', '손실', 'increase', 'rise', 'power', 'output', 'performance', 'impact', 'effect', 'loss'],
  },
  {
    id: 'dpCause', category: 'thermo',
    question: { ko: 'HRSG 차압(ΔP)이 상승하는 원인은 무엇인가?', en: 'What causes the HRSG pressure drop (ΔP) to rise?' },
    required: ['차압', 'δp', 'deltap', 'differentialpressure', 'pressuredrop'],
    related: ['원인', '상승', '증가', '이유', 'cause', 'why', 'rise', 'increase'],
  },
  {
    id: 'stackTemp', category: 'thermo',
    question: { ko: '스택(배기가스 출구) 온도가 상승하면 무엇을 의미하는가?', en: 'What does a rising stack (exhaust outlet) temperature indicate?' },
    required: ['스택온도', '스택', '배기가스온도', '출구온도', 'stack', 'exhausttemp', 'exhaustgastemperature'],
    related: ['상승', '증가', '의미', '높', 'meaning', 'mean', 'rise', 'rising', 'high', 'indicate'],
  },
  {
    id: 'foulingImpact', category: 'thermo',
    question: { ko: 'HRSG 오염(파울링)은 성능에 어떤 영향을 주는가?', en: 'How does HRSG fouling affect performance?' },
    required: ['오염', '파울링', 'fouling', 'deposit'],
    related: ['성능', '영향', '열전달', '효율', 'performance', 'impact', 'heattransfer', 'effect', 'efficiency'],
  },
  {
    id: 'methodCompare', category: 'economics',
    question: { ko: '드라이아이스·고압수·화학(약품) 세정은 어떻게 다른가?', en: 'How do dry-ice, high-pressure water and chemical cleaning differ?' },
    required: ['드라이아이스', '고압수', '화학', '약품', '공법', 'dryice', 'highpressurewater', 'waterjet', 'chemical', 'method'],
    related: ['차이', '비교', '다른', '장단점', 'difference', 'differ', 'compare', 'vs'],
  },
  {
    id: 'costBasis', category: 'economics',
    question: { ko: '세정 공법별 비용은 어떤 기준으로 비교해야 하는가?', en: 'On what basis should cleaning costs be compared across methods?' },
    required: ['비용비교', '비교기준', '비용기준', 'costcomparison', 'costbasis', 'comparecost', 'comparingcost'],
    related: ['비용', '기준', '공법', 'cost', 'basis', 'method'],
  },
  {
    id: 'econData', category: 'economics',
    question: { ko: '세정 판단에 필요한 경제성 데이터는 무엇인가?', en: 'What economic data is needed to decide on cleaning?' },
    required: ['경제성데이터', '경제성자료', '경제성', 'economicdata', 'economics', 'economic'],
    related: ['세정', '판단', '필요', '데이터', 'cleaning', 'decide', 'data', 'needed'],
  },
  {
    id: 'pinchDef', category: 'pinch',
    question: { ko: '핀치 포인트(Pinch Point)란 무엇인가?', en: 'What is the pinch point?' },
    required: ['핀치', 'pinch'],
    related: ['정의', '의미', '무엇', '뭐', 'definition', 'mean', 'what'],
  },
  {
    id: 'approachDef', category: 'pinch',
    question: { ko: '어프로치 포인트(Approach Point)란 무엇인가?', en: 'What is the approach point?' },
    required: ['어프로치', 'approach'],
    related: ['정의', '의미', '무엇', '뭐', 'definition', 'mean', 'what'],
  },
  {
    id: 'pinchData', category: 'pinch',
    question: { ko: '핀치/어프로치 검토에 필요한 설계 및 운전 데이터는 무엇인가?', en: 'What design and operating data are needed for pinch/approach review?' },
    required: ['핀치', '어프로치', 'pinch', 'approach'],
    related: ['설계', '운전', '데이터', '자료', '필요', 'design', 'operating', 'data', 'needed'],
  },
  {
    id: 'cleaningNeedData', category: 'data',
    question: { ko: '세정 필요성 판단에 필수인 데이터는 무엇인가?', en: 'What data is essential to judge whether cleaning is necessary?' },
    required: ['필요성', '판단', '세정시점', 'necessity', 'necessary', 'judge', 'decidewhether'],
    related: ['세정', '데이터', '자료', '필수', 'cleaning', 'data', 'essential', 'required'],
  },
  {
    id: 'checklistUse', category: 'data',
    question: { ko: '데이터 요청 체크리스트는 어떻게 활용하는가?', en: 'How should the data request checklist be used?' },
    required: ['체크리스트', 'checklist'],
    related: ['활용', '사용', '방법', '어떻게', 'use', 'how', 'used'],
  },
  {
    id: 'missingData', category: 'data',
    question: { ko: '현재 케이스에서 부족한 데이터는 무엇인가?', en: 'Which data is still missing for the current case?' },
    required: ['부족', '누락', '미수령', 'missing', 'lacking'],
    related: ['데이터', '자료', '확인', '현재', 'data', 'check', 'current'],
  },
  {
    id: 'validationData', category: 'data',
    question: { ko: '세정 전후 성능 개선 효과를 검증하려면 어떤 자료가 필요한가?', en: 'What data is needed to validate the performance improvement before and after cleaning?' },
    required: ['전후', '검증', '개선효과', 'beforeandafter', 'prepost', 'validate', 'validation', 'verify'],
    related: ['세정', '성능', '개선', '효과', '자료', '데이터', 'cleaning', 'performance', 'improvement', 'data'],
  },
];

export const QA_FALLBACK_TEXT: Localized = {
  ko: '확인 가능한 공학 데이터 범위를 벗어났습니다. 추천 질문을 이용하시거나 계산기 화면을 확인해 주세요.',
  en: 'This is outside the range of engineering data that can be confirmed. Please use a suggested question or check the calculator screen.',
};
