import { useAppSettings } from '@/context/AppSettings';
import { formatSignedPct } from '@/lib/format';

interface DeltaBadgeProps {
  value: number;
  /** 값이 오를수록 좋은 지표인가 — 색상 판단에 사용 */
  higherIsBetter?: boolean;
  digits?: number;
}

/** 변동률 캡슐 배지. 지표 방향성에 따라 좋음/나쁨 색을 고른다. */
export function DeltaBadge({ value, higherIsBetter = true, digits = 1 }: DeltaBadgeProps) {
  const { lang } = useAppSettings();
  if (!Number.isFinite(value)) return null;
  const tone = value === 0 ? 'flat' : value > 0 === higherIsBetter ? 'good' : 'bad';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '–';
  return (
    <span className={`badge badge--delta badge--delta-${tone}`}>
      <span aria-hidden="true">{arrow}</span>
      {formatSignedPct(value, lang, digits)}
    </span>
  );
}
