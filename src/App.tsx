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
import { FloatingAssistant } from '@/components/assistant/FloatingAssistant';
import { useQa } from '@/context/Workspace';

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
  const qa = useQa();
  // 데스크톱에서 사이드 패널로 확장하면 메인 콘텐츠를 패널 너비만큼 줄여 가리지 않는다 (좁은 화면은 CSS 에서 오버레이)
  const panelOpen = qa.chatOpen && qa.chatMode === 'panel';

  return (
    <div className={`shell${panelOpen ? ' shell--assistant-panel' : ''}`}>
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
      {/* 전역 AI 어시스턴트 — 최상위 레이아웃에 두어 페이지 이동 시 다시 만들어지지 않는다 */}
      <FloatingAssistant tab={tab} />
    </div>
  );
}
