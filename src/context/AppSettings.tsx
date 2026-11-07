import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, ThemeMode } from '@/types';
import { STRINGS, type Strings } from '@/i18n/strings';
import { readStored, writeStored } from '@/lib/storage';

interface AppSettingsValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  t: Strings;
}

const AppSettingsContext = createContext<AppSettingsValue | null>(null);

/** 저장된 테마가 없으면 라이트가 기본 (OS 설정을 따르지 않음) — index.html 의 인라인 스크립트와 같은 규칙 */
export function initialTheme(): ThemeMode {
  return readStored<ThemeMode>('hrsg.theme', ['light', 'dark'], 'light');
}

/** html[data-theme] + 다크일 때만 html.dark 클래스 */
export function applyTheme(t: ThemeMode): void {
  const el = document.documentElement;
  el.dataset.theme = t;
  el.classList.toggle('dark', t === 'dark');
  el.style.colorScheme = t;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStored<Lang>('hrsg.lang', ['ko', 'en'], 'ko'));
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => applyTheme(theme), [theme]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStored('hrsg.lang', l);
  }, []);

  const setTheme = useCallback((tm: ThemeMode) => {
    setThemeState(tm);
    writeStored('hrsg.theme', tm);
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, theme, setTheme, t: STRINGS[lang] }),
    [lang, setLang, theme, setTheme],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
