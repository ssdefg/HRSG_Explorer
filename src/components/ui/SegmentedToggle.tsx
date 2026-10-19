import type { ReactNode } from 'react';

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

interface SegmentedToggleProps<T extends string> {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}

/** 헤더용 소형 세그먼트 토글 (언어·테마 전환) */
export function SegmentedToggle<T extends string>({ label, value, options, onChange, className = '' }: SegmentedToggleProps<T>) {
  return (
    <div className={`seg ${className}`.trim()} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__btn"
          aria-pressed={o.value === value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
