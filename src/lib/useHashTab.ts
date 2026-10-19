import { useCallback, useEffect, useState } from 'react';
import type { TabId } from '@/types';
import { DEFAULT_TAB, isTabId } from '@/data/tabs';

function readHash(): TabId {
  const h = window.location.hash.replace(/^#\/?/, '');
  return isTabId(h) ? h : DEFAULT_TAB;
}

/** 다른 탭으로 이동 (예: AI 답변의 '계산기 열기') — hashchange를 통해 useHashTab이 반영한다. */
export function goToTab(t: TabId): void {
  window.location.hash = `/${t}`;
  window.scrollTo({ top: 0 });
}

/** URL 해시(#/calculator)와 활성 탭을 동기화 — 새로고침·뒤로가기에도 탭이 유지된다. */
export function useHashTab(): [TabId, (t: TabId) => void] {
  const [tab, setTabState] = useState<TabId>(readHash);

  useEffect(() => {
    const onHash = () => setTabState(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setTab = useCallback((t: TabId) => {
    if (readHash() !== t) window.location.hash = `/${t}`;
    setTabState(t);
  }, []);

  return [tab, setTab];
}
