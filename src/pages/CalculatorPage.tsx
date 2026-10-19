import { PageScaffold } from '@/components/layout/PageScaffold';
import { DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalcText } from '@/i18n/calculatorStrings';
import { useCalculator } from '@/context/Workspace';
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
 * 성능·경제성 계산기 대시보드.
 * 탭 간 공유 입력 상태(useCalculator)와 계산 엔진(lib/calc.ts)의 결과를 모든 카드가 공유한다.
 */
export function CalculatorPage() {
  const { t } = useAppSettings();
  const c = useCalcText();
  const state = useCalculator();

  return (
    <PageScaffold tabId="calculator" pageDataTypes={['mock', 'example', 'unconfirmed']}>
      <p className="page-notice" role="note">
        <DataTypeBadges types={['mock', 'example']} />
        <span>{c.pageNotice}</span>
      </p>

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
