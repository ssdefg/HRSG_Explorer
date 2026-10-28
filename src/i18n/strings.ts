import type { DataType, Lang, OperationalStatus } from '@/types';

/** UI 공통 문자열 사전. 도메인 데이터의 번역은 각 데이터 파일의 Localized 필드에 둔다. */
const ko = {
  appName: 'HRSG Maintenance Decision Support Platform',
  subtitle: '복합화력 발전소 엔지니어를 위한 AI 질의응답 + 성능·경제성 계산기',
  branding: 'HRSG Reference App (폐열회수단 × 클라우드라 협력 프로젝트)',
  language: '언어',
  theme: '테마',
  themeLight: '라이트',
  themeDark: '다크',
  mainNav: '주요 메뉴',
  keyIndicators: '핵심 지표',
  legendTitle: '표시 규칙',
  legendOperational: '운전 상태 — 설비가 어떤 상태인가',
  legendData: '데이터 유형 — 이 값을 얼마나 믿을 수 있는가',
  footer: '© 2026 HRSG Reference App · 폐열회수단 × 클라우드라 · UI 프로토타입',
  operational: {
    normal: '정상',
    caution: '주의',
    warning: '경고',
    trip: '트립',
  } satisfies Record<OperationalStatus, string>,
  dataType: {
    mock: '가상 데이터',
    example: '예시 계산',
    unconfirmed: '기준값 미확정',
    noMeasured: '실측 데이터 미입력',
    implemented: '기능 구현',
    planned: '연동 예정',
    scenario: '가상 시나리오',
    measured: '실측 데이터',
    userInput: '사용자 입력',
  } satisfies Record<DataType, string>,
};

export type Strings = typeof ko;

const en: Strings = {
  appName: 'HRSG Maintenance Decision Support Platform',
  subtitle: 'AI Q&A + performance & economics calculator for combined-cycle plant engineers',
  branding: 'HRSG Reference App (폐열회수단 × 클라우드라 joint project)',
  language: 'Language',
  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  mainNav: 'Main navigation',
  keyIndicators: 'Key indicators',
  legendTitle: 'Display rules',
  legendOperational: 'Operational status — what state the equipment is in',
  legendData: 'Data type — how far the value can be trusted',
  footer: '© 2026 HRSG Reference App · 폐열회수단 × 클라우드라 · UI prototype',
  operational: {
    normal: 'Normal',
    caution: 'Caution',
    warning: 'Warning',
    trip: 'Trip',
  },
  dataType: {
    mock: 'Mock data',
    example: 'Example calc',
    unconfirmed: 'Baseline TBD',
    noMeasured: 'No measured data',
    implemented: 'Implemented',
    planned: 'Planned',
    scenario: 'Mock scenario',
    measured: 'Measured data',
    userInput: 'User input',
  },
};

export const STRINGS: Record<Lang, Strings> = { ko, en };
