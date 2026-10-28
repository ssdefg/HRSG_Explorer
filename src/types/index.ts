/** 공통 도메인 타입 — 이후 단계의 계산기·체크리스트·검증 기능이 공유한다. */

export type Lang = 'ko' | 'en';
export type ThemeMode = 'light' | 'dark';

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
  | 'userInput';    // 사용자 입력 (출처 미확인 — 실측 여부 모름)

/** 데이터 요청 항목의 수령 상태. 검토 여부(체크박스)와 별개로 관리한다. */
export type ReceiptStatus = 'noMeasured' | 'requestNeeded' | 'received' | 'needsVerification';

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


