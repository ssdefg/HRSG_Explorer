import { useCallback, useState, type ComponentType } from 'react';
import type { TabId } from '@/types';
import { useHashTab } from '@/lib/useHashTab';
import { Sidebar } from '@/components/layout/Sidebar';
import { UtilityHeader } from '@/components/layout/UtilityHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ToastHost } from '@/components/layout/ToastHost';
import { DashboardPage } from '@/pages/DashboardPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { ChecklistPage } from '@/pages/ChecklistPage';
import { ValidationPage } from '@/pages/ValidationPage';

const PAGES: Record<TabId, ComponentType<{ navCount: number }>> = {
  dashboard: DashboardPage,
  calculator: CalculatorPage,
  checklist: ChecklistPage,
  validation: ValidationPage,
};

/** 좌측 고정 사이드바 + 우측 메인 콘텐츠 (모바일: 햄버거 드로어) */
export default function App() {
  const [tab, , navCount] = useHashTab();
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  const Page = PAGES[tab];

  return (
    <div className="shell">
      <Sidebar active={tab} open={navOpen} onClose={closeNav} />
      <div className="shell__main">
        <UtilityHeader active={tab} navOpen={navOpen} onMenu={() => setNavOpen((o) => !o)} />
        <main className="main" id="main">
          <div className="container">
            <Page navCount={navCount} />
          </div>
        </main>
        <AppFooter />
      </div>
      <ToastHost />
    </div>
  );
}
