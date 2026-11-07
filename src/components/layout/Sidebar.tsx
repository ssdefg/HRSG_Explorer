import { useEffect, useRef } from 'react';
import type { TabId } from '@/types';
import { TABS } from '@/data/tabs';
import { hashFor } from '@/lib/useHashTab';
import { useAppSettings } from '@/context/AppSettings';
import { Logo } from './Logo';

interface SidebarProps {
  active: TabId;
  /** 모바일 드로어 열림 여부 (데스크톱에서는 항상 표시) */
  open: boolean;
  onClose: () => void;
}

/** 좌측 고정 사이드바 — 모바일에서는 햄버거 메뉴로 여는 드로어 */
export function Sidebar({ active, open, onClose }: SidebarProps) {
  const { lang, t } = useAppSettings();
  const firstLink = useRef<HTMLAnchorElement>(null);

  // 드로어가 열리면 첫 메뉴로 포커스, Esc로 닫기
  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`sidebar-backdrop${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside id="app-sidebar" className={`sidebar${open ? ' is-open' : ''}`} aria-label={t.mainNav}>
        <div className="sidebar__brand">
          <Logo className="sidebar__logo" />
          <div className="sidebar__brand-text">
            <span className="sidebar__name">HRSG Maintenance DSP</span>
            <span className="sidebar__sub">Decision Support Platform</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          <ul>
            {TABS.map((tab, i) => {
              const selected = tab.id === active;
              return (
                <li key={tab.id}>
                  <a
                    ref={i === 0 ? firstLink : undefined}
                    id={`nav-${tab.id}`}
                    href={hashFor(tab.id)}
                    className={`side-link${selected ? ' is-active' : ''}`}
                    aria-current={selected ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <span className="side-link__num">{String(tab.order).padStart(2, '0')}</span>
                    <span>{tab.label[lang]}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar__foot">
          <p>{t.branding}</p>
        </div>
      </aside>
    </>
  );
}
