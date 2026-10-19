import { useAppSettings } from '@/context/AppSettings';

/** 모든 화면 상단에 고정 노출되는 가상 데이터 안내 */
export function MockDataBanner() {
  const { t } = useAppSettings();
  return (
    <div className="mock-banner" role="status">
      <div className="container mock-banner__inner">
        <span className="badge badge--mock">{t.mockBadge}</span>
        <span>{t.mockNotice}</span>
      </div>
    </div>
  );
}
