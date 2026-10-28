import { useCallback, useEffect, useState } from 'react';
import type { TabId } from '@/types';
import { DEFAULT_TAB, SECTION_IDS, isTabId } from '@/data/tabs';

/** 페이지 이동 후 스크롤할 섹션 (한 번 소비되면 지워진다) */
let pendingSection: string | null = null;

function readHash(): TabId {
  const h = window.location.hash.replace(/^#\/?/, '');
  // 폐지된 독립 메뉴: AI 질의응답(#/qa) → 대시보드 최상단 AI 질의응답 영역으로 이동
  if (h === 'qa') {
    pendingSection = SECTION_IDS.ai;
    window.history.replaceState(null, '', '#/dashboard');
    return 'dashboard';
  }
  return isTabId(h) ? h : DEFAULT_TAB;
}

/** 다른 화면으로 이동. section을 주면 해당 화면이 그려진 뒤 그 영역으로 스크롤한다. */
export function goToTab(t: TabId, opts: { section?: string } = {}): void {
  pendingSection = opts.section ?? null;
  if (window.location.hash !== `#/${t}`) window.location.hash = `/${t}`;
  else window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (!opts.section) window.scrollTo({ top: 0 });
}

/** 대기 중인 섹션 이동을 꺼낸다 — 페이지가 마운트·갱신될 때 호출 */
export function consumePendingSection(): string | null {
  const s = pendingSection;
  pendingSection = null;
  return s;
}

/** 같은 페이지 안의 영역으로 스크롤하고 키보드 포커스를 옮긴다 */
export function scrollToSection(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  return true;
}

/** URL 해시(#/calculator)와 활성 화면을 동기화 — 새로고침·뒤로가기에도 유지된다. */
export function useHashTab(): [TabId, (t: TabId) => void, number] {
  const [tab, setTabState] = useState<TabId>(readHash);
  // 같은 탭으로의 재이동(섹션 이동)도 페이지가 감지하도록 카운터를 둔다
  const [navCount, setNavCount] = useState(0);

  useEffect(() => {
    const onHash = () => {
      setTabState(readHash());
      setNavCount((n) => n + 1);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setTab = useCallback((t: TabId) => goToTab(t), []);
  return [tab, setTab, navCount];
}
