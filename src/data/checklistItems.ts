import type { Localized } from '@/types';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';

const { daysBefore: PRE, daysAfter: POST } = VALIDATION_SCENARIO;

export type ChecklistCategory = 'A' | 'B' | 'C';
export type Priority = 'high' | 'medium' | 'low';

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  name: Localized;
  reason: Localized;
  /** 단위 또는 데이터 형식 */
  format: Localized;
  priority: Priority;
  note: Localized;
}

export const CHECKLIST_CATEGORY_LABEL: Record<ChecklistCategory, Localized> = {
  A: { ko: 'A. 가스터빈 및 운전 데이터', en: 'A. Gas turbine & operating data' },
  B: { ko: 'B. HRSG 설계 및 운전 데이터', en: 'B. HRSG design & operating data' },
  C: { ko: 'C. 세정 및 유지보수 데이터', en: 'C. Cleaning & maintenance data' },
};

/** 클라우드라 측에 요청하거나 향후 확보해야 할 데이터 항목 — 아직 수령된 항목은 없다. */
export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // ---- A. 가스터빈 및 운전 데이터 ----
  {
    id: 'a-gt-load', category: 'A', priority: 'high',
    name: { ko: '가스터빈 부하 및 출력 이력', en: 'GT load & output history' },
    reason: { ko: '배압·온도 변화를 부하 조건으로 보정하기 위해 필요', en: 'Needed to correct ΔP / temperature trends for load' },
    format: { ko: 'MW, % · 시계열 (1시간 평균 권장)', en: 'MW, % · time series (hourly avg.)' },
    note: { ko: '최소 12개월 권장', en: '12+ months preferred' },
  },
  {
    id: 'a-hours-mode', category: 'A', priority: 'medium',
    name: { ko: '운전 시간 및 운전 모드', en: 'Operating hours & mode' },
    reason: { ko: '월간 운전 시간 가정값(720 h) 교체 및 기동·정지 구간 구분', en: 'Replace the 720 h assumption; separate start-up/shutdown' },
    format: { ko: 'h, 모드 구분 · 일별 기록', en: 'h, mode flag · daily log' },
    note: { ko: '계산기 가정값 교체 대상', en: 'Replaces calculator assumption' },
  },
  {
    id: 'a-exh-flow', category: 'A', priority: 'high',
    name: { ko: '배기가스 유량', en: 'Exhaust gas flow' },
    reason: { ko: '가스측 압력손실과 열회수량 해석의 기본 입력', en: 'Basic input for gas-side ΔP and heat recovery analysis' },
    format: { ko: 'kg/s 또는 t/h · 시계열', en: 'kg/s or t/h · time series' },
    note: { ko: '측정값/계산값 여부 표기 요청', en: 'Ask whether measured or calculated' },
  },
  {
    id: 'a-exh-temp', category: 'A', priority: 'high',
    name: { ko: '배기가스 온도', en: 'Exhaust gas temperature' },
    reason: { ko: 'HRSG 입구 조건 확인 및 성능 변화 추적', en: 'Confirms HRSG inlet condition; tracks performance' },
    format: { ko: '°C · 시계열', en: '°C · time series' },
    note: { ko: '계측 위치 함께 요청', en: 'Request sensor location' },
  },
  {
    id: 'a-load-cond', category: 'A', priority: 'medium',
    name: { ko: '부하별 주요 운전 조건', en: 'Key conditions by load' },
    reason: { ko: '세정 전후를 동일 조건에서 비교하기 위한 기준', en: 'Basis for like-for-like pre/post comparison' },
    format: { ko: '표 (부하 구간별 대표값)', en: 'Table (typical values per load band)' },
    note: { ko: '대기 온도 포함 요청', en: 'Include ambient temperature' },
  },

  // ---- B. HRSG 설계 및 운전 데이터 ----
  {
    id: 'b-type-cap', category: 'B', priority: 'high',
    name: { ko: 'HRSG 설비 유형 및 설계 용량', en: 'HRSG type & design capacity' },
    reason: { ko: '시연용 용량(150/270 MW) 가정값 교체', en: 'Replaces demo capacity (150/270 MW)' },
    format: { ko: '사양 문서 · MW, 압력 단계 수', en: 'Spec document · MW, pressure levels' },
    note: { ko: '계산기 가정값 교체 대상', en: 'Replaces calculator assumption' },
  },
  {
    id: 'b-bp-dp', category: 'B', priority: 'high',
    name: { ko: '배압 및 차압 측정값', en: 'Back pressure & ΔP measurements' },
    reason: { ko: '현재 배압 가상값 교체, 파울링 추세 확인', en: 'Replaces mock back pressure; fouling trend' },
    format: { ko: 'mmH₂O 또는 mbar · 시계열', en: 'mmH₂O or mbar · time series' },
    note: { ko: '단위·계측 지점 확인 필요', en: 'Confirm unit & tap location' },
  },
  {
    id: 'b-ref-cond', category: 'B', priority: 'high',
    name: { ko: '기준 운전 조건', en: 'Reference operating condition' },
    reason: { ko: '기준 배압(250 mmH₂O) 및 상태 임계값의 근거 확보', en: 'Basis for reference BP (250) and status thresholds' },
    format: { ko: '설계/시운전 기준값 표', en: 'Design / commissioning reference table' },
    note: { ko: '현재 기준값 미확정', en: 'Baseline currently TBD' },
  },
  {
    id: 'b-drum-p', category: 'B', priority: 'medium',
    name: { ko: 'Drum Pressure', en: 'Drum pressure' },
    reason: { ko: 'Pinch/Approach 검토 시 포화온도 산정에 필요', en: 'Needed for saturation temperature in pinch/approach review' },
    format: { ko: 'bar(g/a 표기) · 시계열', en: 'bar (g/a) · time series' },
    note: { ko: '게이지/절대압 구분 요청', en: 'Specify gauge or absolute' },
  },
  {
    id: 'b-fw-temp', category: 'B', priority: 'medium',
    name: { ko: '급수 온도', en: 'Feedwater temperature' },
    reason: { ko: 'Economizer 출구 온도와 Approach Point 검토', en: 'Economizer outlet temp. and approach review' },
    format: { ko: '°C · 시계열 (입·출구)', en: '°C · time series (in/out)' },
    note: { ko: '', en: '' },
  },
  {
    id: 'b-gas-io', category: 'B', priority: 'high',
    name: { ko: '배기가스 입·출구 온도', en: 'Gas inlet/outlet temperatures' },
    reason: { ko: '열회수 상태와 배기가스 출구 온도 가상값 교체', en: 'Heat recovery state; replaces mock stack temp.' },
    format: { ko: '°C · 시계열 (섹션별 가능 시)', en: '°C · time series (per section if available)' },
    note: { ko: '', en: '' },
  },
  {
    id: 'b-pinch', category: 'B', priority: 'medium',
    name: { ko: 'Pinch Point 관련 설계값', en: 'Pinch point design values' },
    reason: { ko: 'Pinch 분석 대기 상태 해소에 필요한 기준', en: 'Criterion needed to start pinch analysis' },
    format: { ko: '설계 사양 · °C', en: 'Design spec · °C' },
    note: { ko: '제작사 기준 확인', en: 'Confirm OEM basis' },
  },
  {
    id: 'b-approach', category: 'B', priority: 'medium',
    name: { ko: 'Approach Point 관련 설계값', en: 'Approach point design values' },
    reason: { ko: 'Approach 분석 대기 상태 해소에 필요한 기준', en: 'Criterion needed to start approach analysis' },
    format: { ko: '설계 사양 · °C', en: 'Design spec · °C' },
    note: { ko: '제작사 기준 확인', en: 'Confirm OEM basis' },
  },
  {
    id: 'b-spec-log', category: 'B', priority: 'low',
    name: { ko: '설계 사양 및 운전 기록', en: 'Design specification & operating logs' },
    reason: { ko: '튜브 배열·핀 사양 등 해석 전제 확인', en: 'Confirms analysis premises (tube layout, fins)' },
    format: { ko: '문서 (PDF 등) · 운전일지', en: 'Documents (PDF) · logs' },
    note: { ko: '보안 등급 확인 후 요청', en: 'Check confidentiality first' },
  },

  // ---- C. 세정 및 유지보수 데이터 ----
  {
    id: 'c-pre', category: 'C', priority: 'high',
    name: { ko: '세정 전 운전 데이터', en: 'Pre-cleaning operating data' },
    reason: { ko: '세정 효과 검증의 비교 기준 구간', en: 'Baseline window for cleaning effect validation' },
    format: { ko: `시계열 · 세정 전 최소 ${PRE}일`, en: `Time series · ≥${PRE} days before` },
    note: { ko: '세정 전후 검증 탭 입력 대상', en: 'Input for Validation tab' },
  },
  {
    id: 'c-post', category: 'C', priority: 'high',
    name: { ko: '세정 후 운전 데이터', en: 'Post-cleaning operating data' },
    reason: { ko: '개선 효과와 재오염 추세 확인', en: 'Improvement and re-fouling trend' },
    format: { ko: `시계열 · 세정 후 최소 ${POST}일`, en: `Time series · ≥${POST} days after` },
    note: { ko: '세정 전후 검증 탭 입력 대상', en: 'Input for Validation tab' },
  },
  {
    id: 'c-history', category: 'C', priority: 'medium',
    name: { ko: '과거 세정 이력', en: 'Past cleaning history' },
    reason: { ko: '세정 주기와 효과 지속 기간 파악', en: 'Cleaning interval and effect duration' },
    format: { ko: '일자·방식 목록', en: 'List of dates & methods' },
    note: { ko: '', en: '' },
  },
  {
    id: 'c-method', category: 'C', priority: 'medium',
    name: { ko: '세정 방식 및 작업 조건', en: 'Cleaning method & work conditions' },
    reason: { ko: '방식별 비교 시 조건 차이 보정', en: 'Normalize method comparison for conditions' },
    format: { ko: '작업 보고서', en: 'Work reports' },
    note: { ko: '', en: '' },
  },
  {
    id: 'c-cost', category: 'C', priority: 'high',
    name: { ko: '세정 작업 비용', en: 'Cleaning cost' },
    reason: { ko: '세정 방식별 가상 비용 교체', en: 'Replaces mock cleaning costs' },
    format: { ko: '원 · 항목별 내역', en: 'KRW · itemized' },
    note: { ko: '계산기·검증 탭 가정값 교체 대상', en: 'Replaces calculator/validation assumptions' },
  },
  {
    id: 'c-downtime', category: 'C', priority: 'medium',
    name: { ko: '작업 시간 및 정지 시간', en: 'Work time & outage duration' },
    reason: { ko: '정지 손실을 포함한 순편익 산정', en: 'Net benefit including outage loss' },
    format: { ko: 'h', en: 'h' },
    note: { ko: '', en: '' },
  },
  {
    id: 'c-compare', category: 'C', priority: 'medium',
    name: { ko: '세정 전후 성능 비교 자료', en: 'Pre/post performance comparison' },
    reason: { ko: '기존 평가 방법과 결과 확인', en: 'Existing evaluation method and results' },
    format: { ko: '보고서 · 표', en: 'Report · tables' },
    note: { ko: '', en: '' },
  },
  {
    id: 'c-maint', category: 'C', priority: 'low',
    name: { ko: '관련 정비 기록', en: 'Related maintenance records' },
    reason: { ko: '튜브 교체 등 성능에 영향을 준 이벤트 구분', en: 'Separate events affecting performance' },
    format: { ko: '정비 이력 목록', en: 'Maintenance log' },
    note: { ko: '', en: '' },
  },
];
