import { useRef, type KeyboardEvent } from 'react';
import type { TabId } from '@/types';
import { TABS } from '@/data/tabs';
import { useAppSettings } from '@/context/AppSettings';

interface TabNavProps {
  active: TabId;
  onChange: (t: TabId) => void;
}

/** 4개 주요 탭. 좌우 화살표·Home·End 키로 이동할 수 있다. */
export function TabNav({ active, onChange }: TabNavProps) {
  const { lang, t } = useAppSettings();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <nav aria-label={t.mainNav}>
      <div className="tabs" role="tablist">
        {TABS.map((tab, idx) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[idx] = el;
              }}
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              className="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
            >
              <span className="tab__num">{String(tab.order).padStart(2, '0')}</span>
              <span className="tab__full">{tab.label[lang]}</span>
              <span className="tab__short">{tab.short[lang]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
