import type { DataType } from '@/types';
import { useAppSettings } from '@/context/AppSettings';

/** 데이터 유형별 짧은 기호 — 색에 의존하지 않고도 구분되도록 한다. */
const GLYPH: Record<DataType, string> = {
  mock: 'M',
  example: 'Σ',
  unconfirmed: '?',
  noMeasured: '∅',
  implemented: '✓',
  planned: '…',
  scenario: 'S',
  measured: '●',
  userInput: 'U',
};

/** 데이터 신뢰성 / 구현 상태 배지 — 점선 외곽의 사각 캡슐로 운전 상태 배지와 구분 */
export function DataTypeBadge({ type }: { type: DataType }) {
  const { t } = useAppSettings();
  const variant =
    type === 'implemented' || type === 'planned' || type === 'measured' ? ` badge--data-${type}` : '';
  return (
    <span className={`badge badge--data${variant}`} title={t.dataType[type]}>
      <span className="badge__glyph" aria-hidden="true">
        {GLYPH[type]}
      </span>
      {t.dataType[type]}
    </span>
  );
}

export function DataTypeBadges({ types }: { types: DataType[] }) {
  return (
    <>
      {types.map((ty) => (
        <DataTypeBadge key={ty} type={ty} />
      ))}
    </>
  );
}
