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

function initialTheme(): ThemeMode {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return readStored<ThemeMode>('hrsg.theme', ['light', 'dark'], prefersDark ? 'dark' : 'light');
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStored<Lang>('hrsg.lang', ['ko', 'en'], 'ko'));
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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
