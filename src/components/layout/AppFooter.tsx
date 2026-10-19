import { useAppSettings } from '@/context/AppSettings';

export function AppFooter() {
  const { t } = useAppSettings();
  return (
    <footer className="footer">
      <div className="container">
        <p>{t.branding}</p>
        <p>{t.footer}</p>
      </div>
    </footer>
  );
}
