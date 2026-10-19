import { PageScaffold } from '@/components/layout/PageScaffold';
import { Card, DataTypeBadges, DeltaBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useMeasurements, type MeasuredEntry } from '@/context/Workspace';
import { POWER_LOSS_COEFF_MW_PER_MMH2O as K, calcBreakEvenDays, calcChange, mean } from '@/lib/calc';
import { formatNumber } from '@/lib/format';
import { VALIDATION_SCENARIO, type SeriesMetric } from '@/data/validationScenario';
import { CumulativeBenefitCard, TimeSeriesCard } from '@/components/validation/ValidationCharts';
import { MeasuredInput } from '@/components/validation/MeasuredInput';

const TXT = {
  ko: {
    notice:
      '아래 전후 비교 수치는 모두 가상 시나리오이며, 실제 세정 성능이나 검증된 개선 효과가 아닙니다. 이 시나리오는 계산기 입력값과 분리되어 있어 계산기 값을 바꿔도 변하지 않습니다.',
    bp: '배압',
    temp: '배기가스 출구 온도',
    power: '발전 성능 변화 예시',
    cost: '세정 비용',
    before: '세정 전',
    after: '세정 후',
    baseline: '기준 상태',
    assumed: '가정',
    change: '변화',
    measuredRow: (b: string, a: string, n: number) => `실측 평균: 전 ${b} · 후 ${a} (${n}건, 검증 전)`,
    noMeasured: '실측 데이터 미입력',
    powerNote: `계산기의 예시 계수(${K} MW/mmH₂O)와 별도로 설정한 시나리오 가정값`,
    costNote: '실제 견적 아님',
    bpCompare: '배압 비교',
    tempCompare: '배기가스 출구 온도 비교',
    econTitle: '세정 비용 및 경제성 요약',
    econSub: '손익분기점 예시 = 가상 세정 비용 ÷ 가상 일일 순편익',
    dailyNet: '가상 일일 순편익',
    perDay: '원/일',
    won: '원',
    beLabel: '손익분기점 예시',
    days: '일',
    beDisclaimer:
      '세정 비용을 가상 순편익으로 회수한다는 단순 시연 계산입니다. 정지 손실·할인율·재오염을 반영하지 않으며 실제 투자회수기간이 아닙니다. 계산기 세정 비교의 "월간 편익"(월 단위 편익, 단순 회수 기간 산정용)과는 별도의 가정입니다.',
  },
  en: {
    notice:
      'All pre/post figures below are a mock scenario, not actual cleaning performance or a validated improvement. The scenario is separate from calculator inputs and does not change when they change.',
    bp: 'Back pressure',
    temp: 'Stack gas outlet temp.',
    power: 'Power change (example)',
    cost: 'Cleaning cost',
    before: 'Before',
    after: 'After',
    baseline: 'Baseline',
    assumed: 'assumed',
    change: 'Change',
    measuredRow: (b: string, a: string, n: number) => `Measured avg.: pre ${b} · post ${a} (${n}, unverified)`,
    noMeasured: 'No measured data',
    powerNote: `Scenario assumption set separately from the calculator coefficient (${K} MW/mmH₂O)`,
    costNote: 'Not an actual quote',
    bpCompare: 'Back pressure comparison',
    tempCompare: 'Stack gas temperature comparison',
    econTitle: 'Cleaning cost & economics summary',
    econSub: 'Break-even example = mock cleaning cost ÷ mock daily net benefit',
    dailyNet: 'Mock daily net benefit',
    perDay: 'KRW/day',
    won: 'KRW',
    beLabel: 'Break-even example',
    days: 'days',
    beDisclaimer:
      'Simple demo calc of recovering the cleaning cost from a mock net benefit. It ignores outage loss, discounting and re-fouling and is not an actual payback period. It is a separate assumption from the calculator’s “monthly benefit” (monthly, used for simple payback).',
  },
};

type Txt = (typeof TXT)['ko'];

/** 사용자 입력 측정값의 세정 전·후 평균 (엔진 mean 사용) */
function measuredSummary(entries: MeasuredEntry[], metric: SeriesMetric) {
  const pre = entries.filter((e) => e.day < 0).map((e) => e[metric]);
  const post = entries.filter((e) => e.day > 0).map((e) => e[metric]);
  const n = [...pre, ...post].filter((v) => v !== null).length;
  return { before: mean(pre), after: mean(post), n };
}

function MeasuredLine({ entries, metric, unit, x, lang }: { entries: MeasuredEntry[]; metric: SeriesMetric; unit: string; x: Txt; lang: 'ko' | 'en' }) {
  const s = measuredSummary(entries, metric);
  if (s.n === 0) {
    return (
      <div className="compare__measured">
        <DataTypeBadges types={['noMeasured']} />
      </div>
    );
  }
  const f = (v: number | null) => (v === null ? '—' : `${formatNumber(v, lang, 1)} ${unit}`);
  return (
    <div className="compare__measured">
      <DataTypeBadges types={['measured']} />
      <span>{x.measuredRow(f(s.before), f(s.after), s.n)}</span>
    </div>
  );
}

function CompareBars({ title, before, after, unit, x, lang }: { title: string; before: number; after: number; unit: string; x: Txt; lang: 'ko' | 'en' }) {
  const max = Math.max(before, after) * 1.1;
  const ch = calcChange(before, after);
  const rows = [
    { key: 'before', label: x.before, v: before },
    { key: 'after', label: x.after, v: after },
  ];
  return (
    <Card title={title} badges={<DataTypeBadges types={['scenario']} />}>
      <div className="bars" role="img" aria-label={`${title}: ${x.before} ${before} ${unit}, ${x.after} ${after} ${unit}`}>
        {rows.map((r) => (
          <div key={r.key} className="bars__row">
            <span className="bars__label">{r.label}</span>
            <span className="bars__track">
              <span className={`bars__fill bars__fill--${r.key}`} style={{ width: `${(r.v / max) * 100}%` }} />
            </span>
            <span className="bars__value num">
              {formatNumber(r.v, lang, 0)} <small>{unit}</small>
            </span>
          </div>
        ))}
      </div>
      {ch && (
        <p className="bars__delta">
          {x.change}: <strong className="num">{formatNumber(ch.abs, lang, 0)} {unit}</strong>{' '}
          {ch.pct !== null && <DeltaBadge value={ch.pct} higherIsBetter={false} />}
        </p>
      )}
    </Card>
  );
}

export function CleaningValidationPage() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const { entries } = useMeasurements();
  const s = VALIDATION_SCENARIO;
  const bpCh = calcChange(s.backPressure.before, s.backPressure.after);
  const tCh = calcChange(s.exhaustTemp.before, s.exhaustTemp.after);
  const be = calcBreakEvenDays(s.cleaningCostKrw, s.dailyNetBenefitKrw);
  const n0 = (v: number) => formatNumber(v, lang, 0);

  return (
    <PageScaffold tabId="validation" pageDataTypes={['scenario', 'example', 'noMeasured']}>
      <p className="page-notice" role="note">
        <DataTypeBadges types={['scenario', 'example']} />
        <span>{x.notice}</span>
      </p>

      <div className="kpi-grid">
        <article className="card kpi compare">
          <span className="kpi__label">{x.bp}</span>
          <div className="compare__pair">
            <span className="compare__before num">{n0(s.backPressure.before)}</span>
            <span className="compare__arrow" aria-hidden="true">→</span>
            <span className="kpi__value num">{n0(s.backPressure.after)}</span>
            <span className="kpi__unit">mmH₂O</span>
          </div>
          <div className="kpi__meta">{bpCh?.pct != null && <DeltaBadge value={bpCh.pct} higherIsBetter={false} />}</div>
          <div className="kpi__badges">
            <DataTypeBadges types={['scenario']} />
          </div>
          <MeasuredLine entries={entries} metric="backPressure" unit="mmH₂O" x={x} lang={lang} />
        </article>

        <article className="card kpi compare">
          <span className="kpi__label">{x.temp}</span>
          <div className="compare__pair">
            <span className="compare__before num">{n0(s.exhaustTemp.before)}</span>
            <span className="compare__arrow" aria-hidden="true">→</span>
            <span className="kpi__value num">{n0(s.exhaustTemp.after)}</span>
            <span className="kpi__unit">°C</span>
          </div>
          <div className="kpi__meta">{tCh?.pct != null && <DeltaBadge value={tCh.pct} higherIsBetter={false} />}</div>
          <div className="kpi__badges">
            <DataTypeBadges types={['scenario']} />
          </div>
          <MeasuredLine entries={entries} metric="exhaustTemp" unit="°C" x={x} lang={lang} />
        </article>

        <article className="card kpi compare">
          <span className="kpi__label">{x.power}</span>
          <div className="compare__pair">
            <span className="compare__before">{x.baseline}</span>
            <span className="compare__arrow" aria-hidden="true">→</span>
            <span className="kpi__value num">+{formatNumber(s.powerChangeMw.after, lang, 1)}</span>
            <span className="kpi__unit">MW {x.assumed}</span>
          </div>
          <div className="kpi__meta">{x.powerNote}</div>
          <div className="kpi__badges">
            <DataTypeBadges types={['scenario']} />
          </div>
          <div className="compare__measured">
            <DataTypeBadges types={['noMeasured']} />
          </div>
        </article>

        <article className="card kpi compare">
          <span className="kpi__label">{x.cost}</span>
          <div className="compare__pair">
            <span className="kpi__value num">{n0(s.cleaningCostKrw)}</span>
            <span className="kpi__unit">
              {x.won} {x.assumed}
            </span>
          </div>
          <div className="kpi__meta">{x.costNote}</div>
          <div className="kpi__badges">
            <DataTypeBadges types={['scenario']} />
          </div>
          <div className="compare__measured">
            <DataTypeBadges types={['noMeasured']} />
          </div>
        </article>
      </div>

      <div className="section-grid">
        <CompareBars title={x.bpCompare} before={s.backPressure.before} after={s.backPressure.after} unit="mmH₂O" x={x} lang={lang} />
        <CompareBars title={x.tempCompare} before={s.exhaustTemp.before} after={s.exhaustTemp.after} unit="°C" x={x} lang={lang} />

        <Card span={2} title={x.econTitle} subtitle={x.econSub} badges={<DataTypeBadges types={['scenario', 'example']} />}>
          <div className="econ">
            <dl className="econ__inputs">
              <div>
                <dt>{x.cost}</dt>
                <dd>
                  <span className="num">{n0(s.cleaningCostKrw)}</span> <small>{x.won}</small>
                </dd>
                <DataTypeBadges types={['scenario']} />
              </div>
              <div>
                <dt>{x.dailyNet}</dt>
                <dd>
                  <span className="num">{n0(s.dailyNetBenefitKrw)}</span> <small>{x.perDay}</small>
                </dd>
                <DataTypeBadges types={['scenario']} />
              </div>
            </dl>
            <div className="econ__result">
              <span className="econ__label">{x.beLabel}</span>
              <p className="econ__value" data-testid="breakeven">
                <span className="num">{be === null ? '—' : n0(be)}</span>
                <small>{x.days}</small>
              </p>
              <span className="badge-row">
                <DataTypeBadges types={['scenario', 'example']} />
              </span>
              <code className="calc-steps__formula">
                {n0(s.cleaningCostKrw)} ÷ {n0(s.dailyNetBenefitKrw)} = {be === null ? '—' : n0(be)}
                {lang === 'ko' ? '일' : ' days'}
              </code>
            </div>
          </div>
          <p className="note note--warn">{x.beDisclaimer}</p>
        </Card>

        <CumulativeBenefitCard />
        <TimeSeriesCard />
        <MeasuredInput />
      </div>
    </PageScaffold>
  );
}
