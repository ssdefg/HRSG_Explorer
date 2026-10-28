import type { Localized } from '@/types';

export interface CleaningMethod {
  id: 'dryIce' | 'highPressureWater' | 'chemical';
  label: Localized;
  /** 가상 세정 비용 [원] — 실제 견적 아님 */
  costKrw: number;
  /** 가상 월간 편익 [원] — 검증된 경제성 자료 아님 */
  monthlyBenefitKrw: number;
}

/**
 * 시연용 세정 공법 비교 데이터 (가상 데이터). 공법명은 일반 명칭만 쓰며 업체명·상표명을 쓰지 않는다.
 * 값을 실제 견적·검증된 성능처럼 표현하지 않는다.
 */
export const MOCK_CLEANING_METHODS: CleaningMethod[] = [
  { id: 'dryIce', label: { ko: '드라이아이스 세정', en: 'Dry-ice blasting' }, costKrw: 30_000_000, monthlyBenefitKrw: 38_000_000 },
  { id: 'highPressureWater', label: { ko: '고압수 세정', en: 'High-pressure water' }, costKrw: 18_000_000, monthlyBenefitKrw: 24_000_000 },
  { id: 'chemical', label: { ko: '화학(약품) 세정', en: 'Chemical cleaning' }, costKrw: 25_000_000, monthlyBenefitKrw: 30_000_000 },
];
