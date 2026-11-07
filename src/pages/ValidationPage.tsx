import { useEffect } from 'react';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { useCalculator } from '@/context/Workspace';
import { consumePendingSection, scrollToSection } from '@/lib/useHashTab';
import { ValidationSection } from '@/components/validation/ValidationSection';
import { AskAiButton } from '@/components/assistant/AskAiButton';

/**
 * 세정 전후 — 기존 계산기 안에 있던 세정 전후 상세 분석(ValidationSection)을 그대로 옮긴 화면.
 * 계산기와 같은 케이스 상태·중앙 계산 결과(useCalculator)를 사용한다.
 */
export function ValidationPage({ navCount }: { navCount: number }) {
  const state = useCalculator();

  useEffect(() => {
    const section = consumePendingSection();
    if (section) window.requestAnimationFrame(() => scrollToSection(section));
  }, [navCount]);

  return (
    <PageScaffold tabId="validation" pageDataTypes={['scenario', 'mock', 'example', 'noMeasured']}>
      <div className="page-actions">
        <AskAiButton tab="validation" />
      </div>
      <div className="section-grid">
        <ValidationSection state={state} />
      </div>
    </PageScaffold>
  );
}
