import type { Lang, Localized } from '@/types';

const LOCALE: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US' };

export function formatNumber(value: number, lang: Lang, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(LOCALE[lang], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSignedPct(value: number, lang: Lang, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
  return `${sign}${formatNumber(Math.abs(value), lang, digits)}%`;
}


export function pick(text: string | Localized, lang: Lang): string {
  return typeof text === 'string' ? text : text[lang];
}
