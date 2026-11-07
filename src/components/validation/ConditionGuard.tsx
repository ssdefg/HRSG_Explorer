import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useConditions, type OperatingConditions } from '@/context/Workspace';
import { assessConditionDeviation, CONDITION_LIMITS } from '@/lib/conditions';
import { formatNumber } from '@/lib/format';

const TXT = {
  ko: {
    title: '운전 조건 편차 검증',
    sub: `세정 전·후 측정 시점의 부하율·외기온도 — 편차가 ${CONDITION_LIMITS.loadPct} %p 또는 ${CONDITION_LIMITS.ambientC} °C를 넘으면 세정 효과를 단정하지 않습니다.`,
    before: '세정 전',
    after: '세정 후',
    load: '부하율 (%)',
    ambient: '외기온도 (°C)',
    warn: '운전 조건 편차가 커서 세정 효과를 단정할 수 없습니다',
    detail: (dl: string, dt: string) => `부하율 편차 ${dl} %p · 외기온도 편차 ${dt} °C`,
    ok: '운전 조건 편차가 허용 범위 안에 있습니다.',
    empty: '전·후 운전 조건을 입력하면 편차를 검증합니다.',
  },
  en: {
    title: 'Operating-condition deviation check',
    sub: `Load and ambient temperature at the pre/post measurements — beyond ${CONDITION_LIMITS.loadPct} %p or ${CONDITION_LIMITS.ambientC} °C the cleaning effect is not asserted.`,
    before: 'Before',
    after: 'After',
    load: 'Load factor (%)',
    ambient: 'Ambient temp. (°C)',
    warn: 'Operating conditions differ too much to conclude the cleaning effect',
    detail: (dl: string, dt: string) => `Load deviation ${dl} %p · ambient deviation ${dt} °C`,
    ok: 'Operating-condition deviation is within limits.',
    empty: 'Enter pre/post operating conditions to check the deviation.',
  },
};

const FIELDS: { key: keyof OperatingConditions; row: 'load' | 'ambient'; side: 'before' | 'after' }[] = [
  { key: 'beforeLoadPct', row: 'load', side: 'before' },
  { key: 'afterLoadPct', row: 'load', side: 'after' },
  { key: 'beforeAmbientC', row: 'ambient', side: 'before' },
  { key: 'afterAmbientC', row: 'ambient', side: 'after' },
];

/** 세정 전후 운전 조건 편차 가드 (가이드 §2.5) */
export function ConditionGuard() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const { conditions, setCondition } = useConditions();
  const r = assessConditionDeviation(conditions);
  const f = (v: number | null) => (v === null ? '—' : formatNumber(v, lang, 1));

  return (
    <Card span={2} title={x.title} subtitle={x.sub} badges={<DataTypeBadges types={['userInput']} />}>
      <div className="cond-grid">
        {FIELDS.map((fd) => (
          <label key={fd.key} className="field">
            <span className="field__label">
              {x[fd.side]} · {x[fd.row]}
            </span>
            <input
              className="text-input num"
              inputMode="decimal"
              value={conditions[fd.key]}
              onChange={(e) => setCondition(fd.key, e.target.value)}
              data-testid={`cond-${fd.key}`}
            />
          </label>
        ))}
      </div>
      {r.exceeded ? (
        <p className="note note--warn cond-banner" role="alert" data-testid="condition-warning">
          <strong>⚠ {x.warn}</strong> — {x.detail(f(r.loadDiff), f(r.ambientDiff))}
        </p>
      ) : r.loadDiff === null && r.ambientDiff === null ? (
        <p className="note">{x.empty}</p>
      ) : (
        <p className="note">
          {x.ok} {x.detail(f(r.loadDiff), f(r.ambientDiff))}
        </p>
      )}
    </Card>
  );
}
