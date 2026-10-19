/** localStorage 접근은 프라이빗 모드 등에서 실패할 수 있으므로 항상 안전하게 감싼다. */
export function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 저장 실패는 무시 — 현재 세션 동작에는 영향 없음 */
  }
}
