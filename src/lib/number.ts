/**
 * 숫자 입력 파싱·검증 유틸 — 이후 계산기 폼에서 공통 사용한다.
 * UI 컴포넌트에 검증 로직을 중복 작성하지 않도록 여기서 일원화한다.
 */

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'nan' | 'min' | 'max' };

export interface ParseOptions {
  min?: number;
  max?: number;
}

/** "1,234.5", " 12 " 같은 입력을 허용하고, 빈 값·숫자 아님·범위 초과를 구분해 돌려준다. */
export function parseNumericInput(raw: string, opts: ParseOptions = {}): ParseResult {
  const trimmed = raw.trim().replace(/,/g, '');
  if (trimmed === '') return { ok: false, reason: 'empty' };
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) return { ok: false, reason: 'nan' };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, reason: 'nan' };
  if (opts.min !== undefined && value < opts.min) return { ok: false, reason: 'min' };
  if (opts.max !== undefined && value > opts.max) return { ok: false, reason: 'max' };
  return { ok: true, value };
}
