import { useCallback } from 'react';
import type { TabId } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { useCalculator, useChecklist, useConditions, useMeasurements } from '@/context/Workspace';
import {
  buildBeforeAfterContext,
  buildCalculatorContext,
  buildChecklistContext,
  buildDashboardContext,
  type ContextSnapshot,
} from '@/lib/aiContext';

/** 화면별 데이터 스냅샷 생성기 — 'AI에게 질문하기' 버튼과 어시스턴트의 '화면 데이터 첨부'가 같이 쓴다 */
export function usePageContext(): (tab: TabId) => ContextSnapshot {
  const { lang } = useAppSettings();
  const calc = useCalculator();
  const cl = useChecklist();
  const { entries } = useMeasurements();
  const { conditions } = useConditions();
  return useCallback(
    (tab: TabId) => {
      const c = { calc, mode: calc.mode, scenario: calc.scenario, stale: calc.stale };
      switch (tab) {
        case 'dashboard':
          return buildDashboardContext(c, cl, lang);
        case 'calculator':
          return buildCalculatorContext(c, lang);
        case 'checklist':
          return buildChecklistContext(cl, lang);
        case 'validation':
          return buildBeforeAfterContext(c, entries, conditions, lang);
      }
    },
    [calc, cl, entries, conditions, lang],
  );
}
