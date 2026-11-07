import { useState } from 'react';
import type { Lang, TabId, ThemeMode } from '@/types';

/** 다크/라이트 전환 — 현재 테마의 반대 아이콘을 보여 준다 (라이트: 달 · 다크: 해) */
function ThemeToggle({
  theme,
  onChange,
  labels,
}: {
  theme: ThemeMode;
  onChange: (t: ThemeMode) => void;
  labels: { light: string; dark: string; group: string };
}) {
  const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
  const label = `${labels.group}: ${next === 'dark' ? labels.dark : labels.light}`;
  return (
    <button type="button" className="theme-toggle" onClick={() => onChange(next)} aria-label={label} title={label} data-testid="theme-toggle">
      {theme === 'light' ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
import { useAppSettings } from '@/context/AppSettings';
import { useCalculator, useCases } from '@/context/Workspace';
import { useHealth } from '@/lib/useHealth';
import { SegmentedToggle } from '@/components/ui';
import { TABS } from '@/data/tabs';
import { CaseManager } from './CaseManager';

const TXT = {
  ko: {
    menu: '메뉴',
    openMenu: '메뉴 열기',
    case: '케이스',
    manage: '케이스 관리',
    saved: '저장됨',
    idle: '저장 대기',
    pending: '저장 대기',
    quota: '용량 초과',
    unavailable: '저장 불가',
    error: '저장 불가',
    savedTip: '이 브라우저(localStorage)에 자동 저장됨',
    loseWarn: '저장되지 않았습니다 — 새로고침 시 변경 사항이 사라질 수 있습니다.',
    healthUp: '서버 정상',
    healthDown: 'Standalone 모드 · 키 미설정',
    healthDirect: '온라인 (Standalone 모드)',
    healthDirectTip: (t: string) => `검색 서버 응답 없음 → 브라우저에서 참고문헌 검색(BM25) 후 Gemini API 직접 호출 · 마지막 확인 ${t}`,
    healthChecking: '서버 확인 중',
    healthTip: (t: string) => `30초마다 /api/health 확인 · 마지막 확인 ${t}`,
    demo: 'DEMO',
    demoTip: 'DEMO 시나리오 모드 — 화면의 수치는 가상 데이터입니다.',
  },
  en: {
    menu: 'Menu',
    openMenu: 'Open menu',
    case: 'Case',
    manage: 'Manage cases',
    saved: 'Saved',
    idle: 'Save pending',
    pending: 'Save pending',
    quota: 'Quota exceeded',
    unavailable: 'Cannot save',
    error: 'Cannot save',
    savedTip: 'Auto-saved in this browser (localStorage)',
    loseWarn: 'Not saved — changes may be lost on reload.',
    healthUp: 'Server OK',
    healthDown: 'Standalone · key not set',
    healthDirect: 'Online (Standalone mode)',
    healthDirectTip: (t: string) => `No search server → the browser searches the references (BM25) and calls the Gemini API directly · last checked ${t}`,
    healthChecking: 'Checking server',
    healthTip: (t: string) => `Checks /api/health every 30 s · last checked ${t}`,
    demo: 'DEMO',
    demoTip: 'DEMO scenario mode — figures on screen are mock data.',
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
  const calc = useCalculator();
  const health = useHealth();
  const [managerOpen, setManagerOpen] = useState(false);
  const tab = TABS.find((tb) => tb.id === active);
  const failed = cs.saveStatus === 'quota' || cs.saveStatus === 'unavailable' || cs.saveStatus === 'error';
  const saveTone = failed ? 'error' : cs.saveStatus === 'saved' ? 'ok' : 'idle';
  const healthText =
    health.status === 'up' ? x.healthUp : health.status === 'direct' ? x.healthDirect : health.status === 'down' ? x.healthDown : x.healthChecking;
  const checked = health.checkedAt ? health.checkedAt.toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour12: false }) : '—';

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

        <span
          className={`utilbar__save utilbar__save--${saveTone}`}
          role="status"
          title={failed ? x.loseWarn : cs.saveStatus === 'saved' ? x.savedTip : undefined}
          data-testid="save-status"
        >
          <span className="utilbar__dot" aria-hidden="true" />
          {x[cs.saveStatus]}
        </span>

        <span
          className={`utilbar__health utilbar__health--${health.status}`}
          role="status"
          title={health.status === 'direct' ? x.healthDirectTip(checked) : x.healthTip(checked)}
          data-testid="health-status"
        >
          <span className="utilbar__dot" aria-hidden="true" />
          {healthText}
        </span>

        {calc.mode === 'demo' && (
          <span className="badge badge--demo-mini badge--demo-header" title={x.demoTip}>
            {x.demo}
          </span>
        )}

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
          <ThemeToggle theme={theme} onChange={setTheme} labels={{ light: t.themeLight, dark: t.themeDark, group: t.theme }} />
        </div>
      </div>
      <CaseManager open={managerOpen} onClose={() => setManagerOpen(false)} />
    </header>
  );
}
