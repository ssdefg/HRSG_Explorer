import type { ComponentType } from 'react';
import type { TabId } from '@/types';
import { useHashTab } from '@/lib/useHashTab';
import { GlobalHeader } from '@/components/layout/GlobalHeader';
import { MockDataBanner } from '@/components/layout/MockDataBanner';
import { AppFooter } from '@/components/layout/AppFooter';
import { TeamReviewPanel } from '@/components/layout/TeamReviewPanel';
import { AiQaPage } from '@/pages/AiQaPage';
import { CalculatorPage } from '@/pages/CalculatorPage';
import { ChecklistPage } from '@/pages/ChecklistPage';
import { CleaningValidationPage } from '@/pages/CleaningValidationPage';

const PAGES: Record<TabId, ComponentType> = {
  qa: AiQaPage,
  calculator: CalculatorPage,
  checklist: ChecklistPage,
  validation: CleaningValidationPage,
};

export default function App() {
  const [tab, setTab] = useHashTab();
  const Page = PAGES[tab];

  return (
    <div className="app">
      <GlobalHeader activeTab={tab} onTabChange={setTab} />
      <MockDataBanner />
      <main className="main">
        <div className="container">
          <Page />
        </div>
      </main>
      <TeamReviewPanel />
      <AppFooter />
    </div>
  );
}
