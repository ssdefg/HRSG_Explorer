import { useState } from 'react';
import type { Lang, TabId, ThemeMode } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { useCases } from '@/context/Workspace';
import { SegmentedToggle } from '@/components/ui';
import { TABS } from '@/data/tabs';
import { CaseManager } from './CaseManager';

const TXT = {
  ko: {
    menu: '메뉴',
    openMenu: '메뉴 열기',
    case: '케이스',
    manage: '케이스 관리',
    saved: '이 브라우저에 자동 저장됨',
    idle: '자동 저장 대기',
    quota: '저장 실패 — 브라우저 저장 용량 초과',
    unavailable: '저장 불가 — 브라우저 저장소를 사용할 수 없음',
    error: '저장 실패',
    loseWarn: '새로고침 시 변경 사항이 사라질 수 있습니다.',
  },
  en: {
    menu: 'Menu',
    openMenu: 'Open menu',
    case: 'Case',
    manage: 'Manage cases',
    saved: 'Auto-saved in this browser',
    idle: 'Auto-save pending',
    quota: 'Save failed — browser storage quota exceeded',
    unavailable: 'Cannot save — browser storage unavailable',
    error: 'Save failed',
    loseWarn: 'Changes may be lost on reload.',
  },
};

interface UtilityHeaderProps {
  active: TabId;
  navOpen: boolean;
  onMenu: () => void;
}

/** 상단 컴팩트 유틸리티 헤더 — 햄버거(모바일)·현재 화면·케이스 선택·저장 상태·언어·테마 */
export function UtilityHeader({ active, navOpen, onMenu }: UtilityHeaderProps) {
  const { t, lang, setLang, theme, setTheme } = useAppSettings();
  const x = TXT[lang];
  const cs = useCases();
  const [managerOpen, setManagerOpen] = useState(false);
  const tab = TABS.find((tb) => tb.id === active);
  const failed = cs.saveStatus === 'quota' || cs.saveStatus === 'unavailable' || cs.saveStatus === 'error';
  const saveText = cs.saveStatus === 'saved' ? x.saved : cs.saveStatus === 'idle' ? x.idle : x[cs.saveStatus];

  return (
    <header className="utilbar">
      <div className="utilbar__row">
        <button
          type="button"
          className="utilbar__menu"
          aria-label={x.openMenu}
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          onClick={onMenu}
        >
          <span className="utilbar__burger" aria-hidden="true" />
          <span className="utilbar__menu-text">{x.menu}</span>
        </button>
        <span className="utilbar__page">{tab?.label[lang]}</span>

        <div className="utilbar__case">
          <label htmlFor="case-select" className="utilbar__label">
            {x.case}
          </label>
          <select id="case-select" className="select select--sm" value={cs.current.id} onChange={(e) => cs.select(e.target.value)}>
            {cs.cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setManagerOpen(true)}>
            {x.manage}
          </button>
        </div>

        <span className={`utilbar__save${failed ? ' is-error' : ''}`} role="status" title={failed ? x.loseWarn : undefined}>
          {saveText}
        </span>

        <div className="utilbar__tools">
          <SegmentedToggle<Lang>
            className="seg--light"
            label={t.language}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'ko', label: '한국어' },
              { value: 'en', label: 'EN', ariaLabel: 'English' },
            ]}
          />
          <SegmentedToggle<ThemeMode>
            className="seg--light"
            label={t.theme}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t.themeLight },
              { value: 'dark', label: t.themeDark },
            ]}
          />
        </div>
      </div>
      <CaseManager open={managerOpen} onClose={() => setManagerOpen(false)} />
    </header>
  );
}
