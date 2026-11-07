import type { Lang } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { KIT_CALC_DATA } from '@/lib/kit';

/** 키트 계산 상수 — 문구가 키트 값을 따라가게 (하드코딩 방지) */
const K = KIT_CALC_DATA.constants;
const f1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** 문구 속 계수·임계값은 계산 엔진 상수에서 가져온다 — 엔진 값을 바꾸면 안내 문구도 함께 바뀐다. */

/** 성능·경제성 계산기(대시보드) 전용 문자열 */
const ko = {
  pageNotice:
    '모든 입력 기본값은 시연용 가상 데이터이며, 발전 손실·월간 손실은 임시 계산식에 따른 예시 계산입니다. 실제 설비 판단에 사용하지 마십시오.',
  exampleNote: '임시 계산식 기반 · 실제 설비 성능 및 손실 검증 필요',

  // KPI
  kpiCurrentBp: '현재 배압',
  kpiDeltaBp: '초과 압력 (GT 배압·HRSG 차압 중 큰 값)',
  kpiPowerLoss: '발전 손실 추정치',
  kpiMonthlyLoss: '월간 경제적 손실 예시',
  kpiCurrentBpNote: '키트 GT 등급 지표 기준 종합 판정',
  kpiDeltaBpNote: (ref: string) => `기준 배압 ${ref} mmH₂O · HRSG 차압 설계값 대비 초과분 중 큰 값`,
  kpiPowerLossNote: `GT 정격 × ${K.gt_loss_pct_per_mbar} %/mbar × 초과 압력 + ST 정격 × ${K.st_loss_pct_per_c} %/°C × 스택 초과`,
  won: '원',
  invalidInput: '입력값 확인 필요',

  // inputs
  inputsTitle: '계산기 입력값',
  inputsSubtitle: '값을 바꾸면 결과가 가려지고, "재평가 실행"으로 다시 계산합니다.',
  hrsgClass: 'HRSG 설비 유형',
  classCapacityNote: (mw: number) => `선택 시 시연용 용량 ${mw} MW 적용 — 실제 설비의 공식 용량이 아님`,
  reset: '기본값으로 초기화',
  range: (min: string, max: string) => `허용 범위 ${min} ~ ${max}`,
  errEmpty: '유효한 숫자를 입력하세요.',
  errNan: '유효한 숫자를 입력하세요.',
  errNegative: '음수는 입력할 수 없습니다.',
  errMin: (min: string) => `${min} 이상이어야 합니다.`,
  errMax: (max: string) => `${max} 이하이어야 합니다.`,
  errorSummary: (n: number) => `입력 오류 ${n}건 — 해당 값에 의존하는 결과는 계산을 보류합니다.`,

  // result
  resultTitle: '계산 결과',
  resultSubtitle: '키트 계산식(hrsg_calc_kit_team1, calc_adapter 경유)의 단계별 결과',
  stepDelta: '배압 초과분',
  stepPower: '발전 손실 예시',
  stepMonthly: '월간 손실 예시',
  stepPending: '입력값 오류로 계산 보류',
  coeffNote: `손실 계수 ${K.gt_loss_pct_per_mbar} %/mbar · ${K.st_loss_pct_per_c} %/°C 는 키트의 DEMO 임시값이며 공학적으로 검증된 계수가 아닙니다.`,

  // gauge
  gaugeTitle: '배압 상태 게이지',
  gaugeSubtitle: '현재 배압 vs 기준 배압',
  gaugeCurrent: '현재',
  gaugeReference: '기준',
  gaugeExcess: '초과',
  levelNormal: '정상',
  levelCaution: '주의',
  levelDanger: '위험',
  gaugeThresholds: (caution: number, danger: number) =>
    `키트 GT 배압 구간: ${f1(caution)} 미만 정상 · ${f1(caution)}~${f1(danger)} 주의 · ${f1(danger)} 이상 위험 (mmH₂O, DEMO)`,
  gaugeDisclaimer: '상태 표시는 키트 DEMO 구간에 따른 것이며 세정 필요성을 확정하는 진단 결과가 아닙니다.',
  gaugeNeedsData: '판단에 추가로 필요한 데이터',
  gaugeNeedsList: ['운전 부하 조건', '배기가스 온도 추이', '설비 이력 (세정·정비)', '설계 조건 (설계 배압·유량)'],
  gaugeContext: '참고 입력값',

  // chart
  chartTitle: '운전 조건 및 성능 분석',
  chartSubtitle: '배압에 따른 월간 손실 예시 — KPI와 동일한 계산 엔진으로 산출',
  chartYAxis: '월간 손실 예시 (백만원)',
  chartXAxis: '배압 (mmH₂O)',
  chartSeries: '월간 손실 예시',
  chartRefLine: '기준 배압',
  chartCurLine: '현재 배압',
  outputExample: '운전 출력 예시',
  outputFormula: '설비 용량 × 부하율',
  lossShare: '출력 대비 손실 비율',
  exhaustTemp: '배기가스 출구 온도',
  chartEmpty: '입력값 오류로 차트를 표시할 수 없습니다.',
  chartModel: '모델 미연동 — 사용자 입력 모드에서는 검증되지 않은 배압→손실 계수로 곡선을 그리지 않습니다. DEMO 시나리오 모드에서 확인하세요.',
  million: '백만원',
  tableView: '표로 보기',

  // diagram
  diagramTitle: 'HRSG 개념도',
  diagramNotice: 'HRSG 개념도 · 시연용 · 실제 설비 도면 아님',
  diagramLegend: '흐름 범례',
  legendGas: '가스 흐름',
  legendWater: '급수 흐름',
  legendSteam: '증기 흐름',
  diagramHint: '구성요소에 마우스를 올리거나 클릭하면 설명이 표시됩니다.',
  gasFlow: '배기가스 흐름',
  steamWater: 'Steam/Water Flow',
  currentInput: '현재 입력값',

  // pinch
  pinchTitle: 'Pinch Point · Approach Point',
  pinchSubtitle: '분석 입력값 확인',
  pinchWaiting: '분석 대기 — 설계 데이터 및 물성 기준 필요',
  pinchWaitingDesc:
    '계산 기준(포화온도 산정 방법, 설계 Pinch/Approach 기준값)이 확정되지 않아 수치를 산출하지 않습니다. 아래 입력값은 가상 데이터입니다.',
  pinchDefsTitle: '일반 정의 (참고용 · 계산하지 않음)',
  pinchDef: 'Pinch Point = 증발기 출구 가스 온도 − 드럼 압력 기준 포화온도',
  approachDef: 'Approach Point = 드럼 압력 기준 포화온도 − Economizer 출구 급수 온도',
  pinchNeeds: '추가로 필요한 설계 및 운전 데이터',
  pinchNeedsList: [
    '제작사 설계 Pinch/Approach 기준값',
    '포화온도 산정 기준 (증기표 버전·보정 방법)',
    '섹션별 가스·급수 온도 실측 이력',
    '배기가스 유량 및 부하별 운전 조건',
    '계측 위치 및 계측기 정확도',
    '세정·튜브 교체 등 설비 이력',
  ],
  mockEntered: '가상값 입력됨 · 실측 아님',

  // cleaning
  cleanTitle: '세정 방식별 비용·편익 비교',
  cleanSubtitle: '키트 세정 공법 4개 — 총투자와 월간 편익 (단위: 백만원)',
  cleanNotice: '키트 DEMO 데이터이며 실제 견적 또는 검증된 경제성 자료가 아닙니다. 「회수기간이 가장 짧은 공법」은 가정 기준이며 추천이 아닙니다.',
  cleanCost: '세정 비용',
  cleanBenefit: '월간 편익',
  cleanMethod: '세정 방식',
  cleanPayback: '단순 회수 기간',
  cleanPaybackUnit: '개월',
  cleanPaybackNote: '단순 회수 기간 = 세정 비용 ÷ 월간 편익 (가상 데이터 기반 예시 계산)',

  // inventory
  invTitle: '데이터 인벤토리 · 가정값 확인',
  invSubtitle: '현재 화면에 사용된 모든 값의 출처와 교체 필요 여부',
  invItem: '데이터 항목',
  invValue: '현재 값',
  invUnit: '단위',
  invType: '데이터 유형',
  invAssumption: '임시 가정',
  invReplace: '실제 데이터 교체',
  yes: '예',
  no: '아니오',
  required: '필요',
  modelCheck: '모델 검증 필요',
  invCoeff: '발전 손실 계수',
  invThrCaution: '배압 주의 임계값',
  invThrDanger: '배압 위험 임계값',
  invOutputs: '계산 결과',
  invInputs: '입력값',
  invAssumptions: '가정값',
  invCleaning: '세정 비교 데이터',
};

export type CalcStrings = typeof ko;

const en: CalcStrings = {
  pageNotice:
    'All default inputs are mock data for demonstration; power loss and monthly loss are example calculations from a provisional formula. Do not use for real equipment decisions.',
  exampleNote: 'Provisional formula · actual unit performance and loss must be verified',

  kpiCurrentBp: 'Current back pressure',
  kpiDeltaBp: 'Excess pressure (max of GT BP / HRSG ΔP)',
  kpiPowerLoss: 'Est. power loss',
  kpiMonthlyLoss: 'Monthly economic loss (example)',
  kpiCurrentBpNote: 'Overall status by kit GT-class indicators',
  kpiDeltaBpNote: (ref: string) => `vs reference ${ref} mmH₂O and HRSG ΔP design — the larger excess`,
  kpiPowerLossNote: `GT rating × ${K.gt_loss_pct_per_mbar} %/mbar × excess + ST rating × ${K.st_loss_pct_per_c} %/°C × stack excess`,
  won: 'KRW',
  invalidInput: 'Check inputs',

  inputsTitle: 'Calculator inputs',
  inputsSubtitle: 'Editing hides results until you re-evaluate.',
  hrsgClass: 'HRSG class',
  classCapacityNote: (mw: number) => `Applies demo capacity ${mw} MW — not an official rating of any real unit`,
  reset: 'Reset to defaults',
  range: (min: string, max: string) => `Allowed ${min} – ${max}`,
  errEmpty: 'Enter a valid number.',
  errNan: 'Enter a valid number.',
  errNegative: 'Negative values are not allowed.',
  errMin: (min: string) => `Must be ≥ ${min}.`,
  errMax: (max: string) => `Must be ≤ ${max}.`,
  errorSummary: (n: number) => `${n} input error(s) — dependent results are on hold.`,

  resultTitle: 'Calculation result',
  resultSubtitle: 'Step-by-step results from the kit formulas (hrsg_calc_kit_team1 via calc_adapter)',
  stepDelta: 'Back-pressure excess',
  stepPower: 'Power loss (example)',
  stepMonthly: 'Monthly loss (example)',
  stepPending: 'On hold — invalid input',
  coeffNote: `Loss coefficients ${K.gt_loss_pct_per_mbar} %/mbar and ${K.st_loss_pct_per_c} %/°C are the kit's DEMO values, not engineering-validated.`,

  gaugeTitle: 'Back-pressure gauge',
  gaugeSubtitle: 'Current vs. reference back pressure',
  gaugeCurrent: 'Current',
  gaugeReference: 'Reference',
  gaugeExcess: 'Excess',
  levelNormal: 'Normal',
  levelCaution: 'Caution',
  levelDanger: 'Danger',
  gaugeThresholds: (caution: number, danger: number) =>
    `Kit GT back-pressure bands: < ${f1(caution)} normal · ${f1(caution)}–${f1(danger)} caution · ≥ ${f1(danger)} danger (mmH₂O, DEMO)`,
  gaugeDisclaimer: 'Status reflects the kit DEMO bands only — it is not a diagnosis confirming the need for cleaning.',
  gaugeNeedsData: 'Additional data required for judgement',
  gaugeNeedsList: ['Operating load', 'Stack gas temperature trend', 'Equipment history (cleaning, maintenance)', 'Design conditions (design ΔP, flow)'],
  gaugeContext: 'Context inputs',

  chartTitle: 'Operating conditions & performance analysis',
  chartSubtitle: 'Monthly loss (example) vs. back pressure — same engine as the KPIs',
  chartYAxis: 'Monthly loss, example (KRW M)',
  chartXAxis: 'Back pressure (mmH₂O)',
  chartSeries: 'Monthly loss (example)',
  chartRefLine: 'Reference',
  chartCurLine: 'Current',
  outputExample: 'Operating output (example)',
  outputFormula: 'Capacity × load',
  lossShare: 'Loss share of output',
  exhaustTemp: 'Stack gas outlet temp.',
  chartEmpty: 'Chart unavailable — invalid inputs.',
  chartModel: 'Model not connected — user-input mode does not draw the curve with the unverified BP→loss coefficient. View it in DEMO scenario mode.',
  million: 'KRW M',
  tableView: 'Show as table',

  diagramTitle: 'HRSG concept diagram',
  diagramNotice: 'HRSG concept diagram · demo · not an actual drawing',
  diagramLegend: 'Flow legend',
  legendGas: 'Gas flow',
  legendWater: 'Feedwater flow',
  legendSteam: 'Steam flow',
  diagramHint: 'Hover or click a component to see its description.',
  gasFlow: 'Exhaust gas flow',
  steamWater: 'Steam/Water Flow',
  currentInput: 'Current input',

  pinchTitle: 'Pinch Point · Approach Point',
  pinchSubtitle: 'Analysis inputs',
  pinchWaiting: 'Analysis pending — design data and property basis required',
  pinchWaitingDesc:
    'The calculation basis (saturation temperature method, design pinch/approach criteria) is not confirmed, so no values are computed. Inputs below are mock data.',
  pinchDefsTitle: 'General definitions (reference only · not computed)',
  pinchDef: 'Pinch = evaporator outlet gas temp. − saturation temp. at drum pressure',
  approachDef: 'Approach = saturation temp. at drum pressure − economizer outlet water temp.',
  pinchNeeds: 'Additional design & operating data required',
  pinchNeedsList: [
    'OEM design pinch/approach criteria',
    'Saturation temperature basis (steam table version, corrections)',
    'Measured gas/water temperature history per section',
    'Exhaust gas flow and load-dependent conditions',
    'Instrument locations and accuracy',
    'Equipment history (cleaning, tube replacement)',
  ],
  mockEntered: 'Mock value entered · not measured',

  cleanTitle: 'Cleaning method cost vs. benefit',
  cleanSubtitle: 'Kit cleaning methods (4) — total investment and monthly benefit (KRW million)',
  cleanNotice: 'Not actual quotes or validated economics. Replace after obtaining vendor quotes and measured benefits.',
  cleanCost: 'Cleaning cost',
  cleanBenefit: 'Monthly benefit',
  cleanMethod: 'Method',
  cleanPayback: 'Simple payback',
  cleanPaybackUnit: 'months',
  cleanPaybackNote: 'Simple payback = cleaning cost ÷ monthly benefit (example calc on mock data)',

  invTitle: 'Data inventory · assumptions',
  invSubtitle: 'Source and replacement status of every value on this screen',
  invItem: 'Data item',
  invValue: 'Current value',
  invUnit: 'Unit',
  invType: 'Data type',
  invAssumption: 'Provisional',
  invReplace: 'Replace with real data',
  yes: 'Yes',
  no: 'No',
  required: 'Required',
  modelCheck: 'Model validation needed',
  invCoeff: 'Power-loss coefficient',
  invThrCaution: 'BP caution threshold',
  invThrDanger: 'BP danger threshold',
  invOutputs: 'Calculated results',
  invInputs: 'Inputs',
  invAssumptions: 'Assumptions',
  invCleaning: 'Cleaning comparison data',
};

export const STRINGS_CALC: Record<Lang, CalcStrings> = { ko, en };

export function useCalcText(): CalcStrings {
  const { lang } = useAppSettings();
  return STRINGS_CALC[lang];
}
