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

export function formatDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE[lang], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function pick(text: string | Localized, lang: Lang): string {
  return typeof text === 'string' ? text : text[lang];
}
