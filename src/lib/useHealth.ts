import { useSyncExternalStore } from 'react';
import type { RagHealth } from '@/lib/ragClient';
import { hasDirectKey } from '@/lib/geminiDirect';

/** 헬스 체크 주기 [ms] — 가이드 §1.1 (30초 주기 /api/health 폴링) */
export const HEALTH_INTERVAL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5_000;

/**
 * checking: 첫 응답 전 · up: 서버/검색 인덱스 응답 정상
 * direct: 서버 응답은 없지만 Gemini 키가 빌드에 있어 브라우저에서 직결 (Standalone — 정적 사이트 단독 배포)
 * down: 서버 응답 없음 · 직결 키도 없음 (또는 브라우저 오프라인)
 */
export type HealthStatus = 'checking' | 'up' | 'direct' | 'down';

export interface HealthState {
  status: HealthStatus;
  checkedAt: Date | null;
  /** 서버가 알려 준 검색 인덱스·모델 정보 (down 이면 null) */
  info: RagHealth | null;
}

/**
 * 슬래시 없는 경로를 쓴다. '/api/health/' 를 라우트로 갖지 않은 서버(이전 버전 server/app.py)는
 * FastAPI 가 307 로 'http://127.0.0.1:8000/api/health' 절대 주소로 리다이렉트하고, 브라우저가 이를
 * 다른 출처로 따라가다 CORS 에 막혀 실제로는 살아 있는 서버를 '단절'로 표시했다.
 * 현재 server/app.py 는 두 경로를 모두 받는다.
 */
export const HEALTH_PATH = '/api/health';

export async function pingHealth(): Promise<RagHealth | null> {
  try {
    const res = await fetch(HEALTH_PATH, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS), cache: 'no-store', redirect: 'error' });
    if (!res.ok) return null;
    const d = await res.json();
    return d?.status === 'ok' ? (d as RagHealth) : null;
  } catch {
    return null;
  }
}

/*
 * 헤더와 AI 어시스턴트가 같은 상태를 보도록 모듈 단위로 한 번만 폴링한다.
 * 구독자가 하나라도 있으면 30초마다 확인하고, 모두 사라지면 멈춘다.
 */
let state: HealthState = { status: 'checking', checkedAt: null, info: null };
const listeners = new Set<() => void>();
let timer: number | null = null;

function set(next: HealthState) {
  state = next;
  listeners.forEach((l) => l());
}

export function checkHealthNow(): void {
  pingHealth().then((info) => set({ status: info ? 'up' : hasDirectKey() ? 'direct' : 'down', checkedAt: new Date(), info }));
}

/** 지금 알고 있는 상태 — 질문을 보낼 때 RAG 서버를 건너뛸지 정한다 */
export function currentHealthStatus(): HealthStatus {
  return state.status;
}

const onOffline = () => set({ ...state, status: 'down', info: null });

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (listeners.size === 1) {
    checkHealthNow();
    timer = window.setInterval(checkHealthNow, HEALTH_INTERVAL_MS);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', checkHealthNow);
  }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', checkHealthNow);
    }
  };
}

/** 30초마다 서버 상태를 확인한다. 브라우저가 오프라인이 되면 즉시 'down'. */
export function useHealth(): HealthState {
  return useSyncExternalStore(subscribe, () => state);
}
