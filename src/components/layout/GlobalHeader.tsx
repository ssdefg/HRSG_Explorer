import type { Lang, TabId, ThemeMode } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { MOCK_SYSTEM_STATUS } from '@/data/mockSystemStatus';
import { SegmentedToggle } from '@/components/ui';
import { Logo } from './Logo';
import { TabNav } from './TabNav';
import { SystemStatusSummary } from './SystemStatusSummary';

interface GlobalHeaderProps {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}

export function GlobalHeader({ activeTab, onTabChange }: GlobalHeaderProps) {
  const { t, lang, setLang, theme, setTheme } = useAppSettings();

  return (
    <header className="header">
      <div className="container">
        <div className="header__bar">
          <div className="brand">
            <Logo className="brand__logo" />
            <div className="brand__text">
              <h1 className="brand__name">
                <span className="brand__name-full">{t.appName}</span>
                <span className="brand__name-short">{t.appNameShort}</span>
              </h1>
              <p className="brand__sub">{t.subtitle}</p>
            </div>
          </div>

          <div className="header__tools">
            <span className="badge badge--mock">{t.mockBadge}</span>
            <SystemStatusSummary summary={MOCK_SYSTEM_STATUS} />
            <SegmentedToggle<Lang>
              label={t.language}
              value={lang}
              onChange={setLang}
              options={[
                { value: 'ko', label: '한국어' },
                { value: 'en', label: 'EN', ariaLabel: 'English' },
              ]}
            />
            <SegmentedToggle<ThemeMode>
              label={t.theme}
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: <><span aria-hidden="true">☀</span>{t.themeLight}</> },
                { value: 'dark', label: <><span aria-hidden="true">☾</span>{t.themeDark}</> },
              ]}
            />
          </div>
        </div>

        <TabNav active={activeTab} onChange={onTabChange} />
      </div>
    </header>
  );
}
