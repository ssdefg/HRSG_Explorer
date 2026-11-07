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
  literature: 'L',
  notComputable: '×',
  stale: '↻',
};

/**
 * 데이터 신뢰성 배지 (가이드 §2.1 ReliabilityBadge) — 점선 외곽의 사각 캡슐로 운전 상태 배지와 구분.
 * 가상(보라) · 예시(회색) · 미확정(주황) · 실측 미입력(적색 외곽선) · 사용자 입력(파랑) · 공개문헌 참고(녹색)
 * · 산출 불가(적색) · 재평가 필요(앰버). 색 외에 기호로도 구분된다.
 */
export function DataTypeBadge({ type }: { type: DataType }) {
  const { t } = useAppSettings();
  return (
    <span className={`badge badge--data badge--data-${type}`} title={t.dataType[type]} data-reliability={type}>
      <span className="badge__glyph" aria-hidden="true">
        {GLYPH[type]}
      </span>
      {t.dataType[type]}
    </span>
  );
}

/** 가이드 명칭 */
export const ReliabilityBadge = DataTypeBadge;

export function DataTypeBadges({ types }: { types: DataType[] }) {
  return (
    <>
      {types.map((ty) => (
        <DataTypeBadge key={ty} type={ty} />
      ))}
    </>
  );
}
