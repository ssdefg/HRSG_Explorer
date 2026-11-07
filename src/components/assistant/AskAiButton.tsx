import type { TabId } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { useQa } from '@/context/Workspace';
import { ASK_DRAFT } from '@/data/assistantPrompts';
import { usePageContext } from './usePageContext';

const LABEL = { ko: 'AI에게 질문하기', en: 'Ask AI' };

/**
 * 화면별 'AI에게 질문하기' — 어시스턴트를 열고, 이 화면의 데이터 스냅샷을 첨부하고, 추천 질문을 입력창에 넣는다.
 * 전송은 사용자가 직접 한다 (자동 전송하지 않음).
 */
export function AskAiButton({ tab, className = '' }: { tab: TabId; className?: string }) {
  const { lang } = useAppSettings();
  const qa = useQa();
  const pageContext = usePageContext();
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--sm ask-ai-btn ${className}`}
      onClick={() => qa.openAssistant({ context: pageContext(tab), draft: ASK_DRAFT[tab][lang] })}
      data-testid={`ask-ai-${tab}`}
    >
      <span aria-hidden="true">✦</span> {LABEL[lang]}
    </button>
  );
}
