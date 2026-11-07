/// <reference types="vite/client" />

/** vite.config.ts define — 빌드 환경변수 gemini_API (없으면 VITE_GEMINI_API_KEY) 값. 번들에 포함되어 공개된다 */
declare const __GEMINI_KEY__: string;

interface ImportMetaEnv {
  /** Gemini 직결 모드 키 (정적 사이트 단독 배포용) — 빌드 시 번들에 포함되어 공개된다 */
  readonly VITE_GEMINI_API_KEY?: string;
  /** VITE_GEMINI_API_KEY 가 없을 때 쓰는 대체 이름 */
  readonly VITE_gemini_API?: string;
  /** 쉼표로 구분한 모델 목록, 앞에서부터 시도 (기본 gemini-3.5-flash,gemini-3.8-flash) */
  readonly VITE_GEMINI_MODEL?: string;
}
