/** HRSG 서비스 심볼 — 상부 드럼에 매달린 수직 튜브 뱅크를 가로지르는 배기가스 열 흐름 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 34 34" role="img" aria-label="HRSG">
      <rect x="0.5" y="0.5" width="33" height="33" rx="8" fill="#F8F9FA" fillOpacity="0.06" stroke="#F8F9FA" strokeOpacity="0.22" />
      <rect x="8" y="6" width="18" height="4" rx="2" fill="#F8F9FA" />
      <g stroke="#F8F9FA" strokeWidth="2" strokeLinecap="round">
        <path d="M11 10v17" />
        <path d="M17 10v17" />
        <path d="M23 10v17" />
      </g>
      <path
        d="M5 19.5c2.2-2.4 4.4-2.4 6 0s3.8 2.4 6 0 3.8-2.4 6 0 3.8 2.4 6 0"
        stroke="#D95D39"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
