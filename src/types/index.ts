/** 공통 도메인 타입 — 이후 단계의 계산기·체크리스트·검증 기능이 공유한다. */

export type Lang = 'ko' | 'en';
export type ThemeMode = 'light' | 'dark';

/** validation = 세정 전후 화면 (URL 해시는 #before-after) */
export type TabId = 'dashboard' | 'calculator' | 'checklist' | 'validation';

/** 실제 운전 상태 (설비 상태). 데이터 신뢰성과 별개다. */
export type OperationalStatus = 'normal' | 'caution' | 'warning' | 'trip';

/** 데이터 신뢰성 / 구현 상태 유형. 운전 상태와 다른 스타일로 표시한다. */
export type DataType =
  | 'mock'          // 가상 데이터
  | 'example'       // 예시 계산
  | 'unconfirmed'   // 기준값 미확정
  | 'noMeasured'    // 실측 데이터 미입력
  | 'implemented'   // 기능 구현
  | 'planned'       // 연동 예정
  | 'scenario'      // 가상 시나리오
  | 'measured'      // 실측 데이터 (사용자 입력 — 검증 전)
  | 'userInput'     // 사용자 입력 (출처 미확인 — 실측 여부 모름)
  | 'literature'    // 공개문헌 참고
  | 'notComputable' // 산출 불가
  | 'stale';        // 재평가 필요 (입력 변경 후 재계산 전)

/** 데이터 요청 항목의 수령 상태. 검토 여부(체크박스)와 별개로 관리한다. */
/** 데이터 수급 상태 — 키트 supply 키 (실측 미입력 · 요청 필요 · 수령 완료 · 검증 필요 · 해당 없음). 검토 여부와 별개 */
export type ReceiptStatus = 'not_entered' | 'requested' | 'received' | 'verify_needed' | 'na';
/** 데이터 검증 상태 — 키트 verify 키 */
export type VerifyStatus = 'unverified' | 'in_progress' | 'verified' | 'failed';

export type Localized = Record<Lang, string>;

export interface Kpi {
  id: string;
  label: Localized;
  value: number;
  /** 단위 — 언어별로 다르면 Localized */
  unit: string | Localized;
  /** 표시 소수 자릿수 */
  digits: number;
  /** 기준 대비 변동률(%) — 없으면 배지 미표시 */
  deltaPct?: number;
  /** 변동률이 양수일 때 좋은 지표인지 (예: 효율 ↑ 좋음, 차압 ↑ 나쁨) */
  higherIsBetter?: boolean;
  status?: OperationalStatus;
  /** 상태 배지 문구를 바꿀 때 (예: 시연용 임계값의 '위험') — 없으면 기본 운전 상태 문구 */
  statusLabel?: Localized;
  note?: Localized;
  dataTypes: DataType[];
}


