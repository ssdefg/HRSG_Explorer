import { useEffect } from 'react';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { useCalculator } from '@/context/Workspace';
import { consumePendingSection, scrollToSection } from '@/lib/useHashTab';
import { CalculatorControls } from '@/components/calculator/CalculatorControls';
import { CalculatorKpis } from '@/components/calculator/CalculatorKpis';
import { CalculatorInputs } from '@/components/calculator/CalculatorInputs';
import { CalculationResult } from '@/components/calculator/CalculationResult';
import { BackpressureGauge } from '@/components/calculator/BackpressureGauge';
import { PerformanceChart } from '@/components/calculator/PerformanceChart';
import { HrsgDiagram } from '@/components/calculator/HrsgDiagram';
import { PinchApproachPanel } from '@/components/calculator/PinchApproachPanel';
import { CleaningComparison } from '@/components/calculator/CleaningComparison';
import { DataInventory } from '@/components/calculator/DataInventory';

/**
 * 성능·경제성 계산기 — 입력 · 계산 · 경제성 비교 · 차트. (세정 전후 상세 분석은 '세정 전후' 화면으로 이동)
 * 모든 카드가 같은 케이스 상태(useCalculator)와 중앙 계산 엔진 결과를 공유한다.
 */
export function CalculatorPage({ navCount }: { navCount: number }) {
  const { t } = useAppSettings();
  const c = useCalcText();
  const state = useCalculator();

  // 다른 화면에서 특정 섹션(예: 계산 결과·데이터 인벤토리)으로 이동해 온 경우
  useEffect(() => {
    const section = consumePendingSection();
    if (section) window.requestAnimationFrame(() => scrollToSection(section));
  }, [navCount]);

  return (
    <PageScaffold tabId="calculator" pageDataTypes={state.mode === 'demo' ? ['mock', 'example', 'unconfirmed'] : ['userInput', 'example', 'unconfirmed']}>
      <p className="page-notice" role="note">
        <DataTypeBadges types={['mock', 'example']} />
        <span>{c.pageNotice}</span>
      </p>

      <CalculatorControls state={state} />

      <h3 className="section-title">{t.keyIndicators}</h3>
      <CalculatorKpis state={state} />

      <div className="calc-layout">
        <aside className="calc-layout__side">
          <CalculatorInputs state={state} />
        </aside>

        <div className="calc-layout__main">
          <div className="section-grid">
            <BackpressureGauge state={state} />
            <CalculationResult state={state} />
            <PerformanceChart state={state} />
            <HrsgDiagram values={state.values} />
            <PinchApproachPanel values={state.values} />
            <CleaningComparison />
            <DataInventory state={state} />
          </div>
        </div>
      </div>
    </PageScaffold>
  );
}
