import type { DataType, Lang } from '@/types';
import { Card, DataTypeBadges, DeltaBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useMeasurements, type CalculatorState, type MeasuredEntry } from '@/context/Workspace';
import { calcChange, mean } from '@/lib/calc';
import { formatNumber } from '@/lib/format';
import { VALIDATION_SCENARIO, type SeriesMetric } from '@/data/validationScenario';
import { SECTION_IDS } from '@/data/tabs';
import { CumulativeBenefitCard, TimeSeriesCard } from './ValidationCharts';
import { MeasuredInput } from './MeasuredInput';
import { ConditionGuard } from './ConditionGuard';
import { fmtMetric, MetricStatusTag } from '@/components/calculator/metricText';

const TXT = {
  ko: {
    title: '세정 전후 상세 분석',
    sub: '세정 전후 배압·스택 온도 비교, 회수 출력, 경제성 변화, 시계열, 실측 스냅샷, 손익분기',
    notice:
      '세정 전후 배압·스택 온도와 시계열은 가상 시나리오입니다. 회수 출력·세정 비용·손익분기는 계산기 화면의 입력값(현재 케이스)과 중앙 계산 엔진에서 산출되며, 실제 세정 성능이나 검증된 개선 효과가 아닙니다.',
    bp: '배압',
    temp: '스택(배기가스 출구) 온도',
    recovered: '회수 출력',
    cost: '세정 비용',
    before: '세정 전',
    after: '세정 후',
    baseline: '기준 상태',
    fromInput: '계산기 입력값',
    change: '변화',
    measuredRow: (b: string, a: string, n: number) => `실측 평균: 전 ${b} · 후 ${a} (${n}건, 검증 전)`,
    bpCompare: '세정 전후 배압 비교',
    tempCompare: '세정 전후 스택 온도 비교',
    econTitle: '경제성 변화 요약',
    econSub: '상세 산식은 계산기 화면의 계산 결과 카드 참고',
    monthlyGain: '월간 순증분 편익 (정상 월)',
    investment: '초기 투자',
    breakEven: '손익분기 예시',
    won: '원',
    days: '일',
    sourcesTitle: '데이터 출처 및 검증 상태',
    colItem: '항목',
    colSource: '출처',
    colStatus: '검증 상태',
    srcScenario: '가상 시나리오 (validationScenario)',
    srcInput: '계산기 입력값',
    srcEngine: '중앙 계산 엔진',
    srcMeasured: '사용자 입력 실측 스냅샷',
    stUnverified: '검증 전 · 실데이터 아님',
    stNone: '실측 데이터 미입력',
    stCount: (n: number) => `${n}건 입력 · 검증 전`,
    itemBpTemp: '세정 전후 배압·스택 온도, 시계열',
    itemRecovered: '회수 출력·세정 비용·정지일수',
    itemEcon: '추가 매출·순편익·손익분기',
    itemMeasured: '실측값',
  },
  en: {
    title: 'Pre/post-cleaning detailed analysis',
    sub: 'Back pressure & stack temperature comparison, recovered output, economics, time series, measured snapshots, break-even',
    notice:
      'Pre/post back pressure, stack temperature and the time series are a mock scenario. Recovered output, cleaning cost and break-even come from the calculator screen’s inputs (current case) and the central engine. Not actual cleaning performance or a validated improvement.',
    bp: 'Back pressure',
    temp: 'Stack (exhaust outlet) temp.',
    recovered: 'Recovered output',
    cost: 'Cleaning cost',
    before: 'Before',
    after: 'After',
    baseline: 'Baseline',
    fromInput: 'Calculator input',
    change: 'Change',
    measuredRow: (b: string, a: string, n: number) => `Measured avg.: pre ${b} · post ${a} (${n}, unverified)`,
    bpCompare: 'Pre/post back pressure',
    tempCompare: 'Pre/post stack temperature',
    econTitle: 'Economics summary',
    econSub: 'See the calculation result card on the calculator screen for formulas',
    monthlyGain: 'Monthly incremental benefit (steady month)',
    investment: 'Initial investment',
    breakEven: 'Break-even example',
    won: 'KRW',
    days: 'd',
    sourcesTitle: 'Data sources & verification status',
    colItem: 'Item',
    colSource: 'Source',
    colStatus: 'Verification',
    srcScenario: 'Mock scenario (validationScenario)',
    srcInput: 'Calculator inputs',
    srcEngine: 'Central calculation engine',
    srcMeasured: 'User-entered measured snapshots',
    stUnverified: 'Unverified · not real data',
    stNone: 'No measured data',
    stCount: (n: number) => `${n} entered · unverified`,
    itemBpTemp: 'Pre/post back pressure & stack temp., time series',
    itemRecovered: 'Recovered output, cleaning cost, shutdown days',
    itemEcon: 'Additional revenue, net benefit, break-even',
    itemMeasured: 'Measured values',
  },
};

type Txt = (typeof TXT)['ko'];

/** 사용자 입력 측정값의 세정 전·후 평균 (엔진 mean 사용) */
function measuredSummary(entries: MeasuredEntry[], metric: SeriesMetric) {
  const pre = entries.filter((e) => e.day < 0).map((e) => e[metric]);
  const post = entries.filter((e) => e.day >= 0).map((e) => e[metric]);
  const n = [...pre, ...post].filter((v) => v !== null).length;
  return { before: mean(pre), after: mean(post), n };
}

function MeasuredLine({ entries, metric, unit, x, lang }: { entries: MeasuredEntry[]; metric: SeriesMetric; unit: string; x: Txt; lang: Lang }) {
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

function CompareBars({ title, before, after, unit, x, lang }: { title: string; before: number; after: number; unit: string; x: Txt; lang: Lang }) {
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

/** 계산기 결과 영역의 세정 전후 상세 분석 (기존 독립 탭의 기능을 이전) */
export function ValidationSection({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const { entries } = useMeasurements();
  const s = VALIDATION_SCENARIO;
  const v = state.values;
  const m = state.metrics;
  const bpCh = calcChange(s.backPressure.before, s.backPressure.after);
  const tCh = calcChange(s.exhaustTemp.before, s.exhaustTemp.after);
  const n0 = (val: number) => formatNumber(val, lang, 0);
  const n = (val: number | null, d = 0) => (val === null ? '—' : formatNumber(val, lang, d));
  const inputType: DataType = state.mode === 'user' && (state.edited.recoveredPowerMw || state.edited.cleaningCostKrw) ? 'userInput' : 'mock';

  const sources: { item: string; src: string; types: DataType[]; status: string }[] = [
    { item: x.itemBpTemp, src: x.srcScenario, types: ['scenario'], status: x.stUnverified },
    { item: x.itemRecovered, src: x.srcInput, types: [inputType], status: x.stUnverified },
    { item: x.itemEcon, src: x.srcEngine, types: ['example'], status: x.stUnverified },
    {
      item: x.itemMeasured,
      src: x.srcMeasured,
      types: entries.length ? ['measured'] : ['noMeasured'],
      status: entries.length ? x.stCount(entries.length) : x.stNone,
    },
  ];

  return (
    <details className="validation card card--span-2" id={SECTION_IDS.validation} open>
      <summary className="validation__summary">
        <span>
          <span className="validation__title">{x.title}</span>
          <span className="validation__sub">{x.sub}</span>
        </span>
        <span className="badge-row">
          <DataTypeBadges types={['scenario', 'example']} />
        </span>
      </summary>

      <div className="validation__body">
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
            <span className="kpi__label">{x.recovered}</span>
            <div className="compare__pair">
              <span className="compare__before">{x.baseline}</span>
              <span className="compare__arrow" aria-hidden="true">→</span>
              <span className="kpi__value num">+{n(v.recoveredPowerMw, 2)}</span>
              <span className="kpi__unit">MW</span>
            </div>
            <div className="kpi__meta">{x.fromInput}</div>
            <div className="kpi__badges">
              <DataTypeBadges types={[inputType, 'unconfirmed']} />
            </div>
            <div className="compare__measured">
              <DataTypeBadges types={['noMeasured']} />
            </div>
          </article>

          <article className="card kpi compare">
            <span className="kpi__label">{x.cost}</span>
            <div className="compare__pair">
              <span className="kpi__value num">{n(v.cleaningCostKrw)}</span>
              <span className="kpi__unit">{x.won}</span>
            </div>
            <div className="kpi__meta">{x.fromInput}</div>
            <div className="kpi__badges">
              <DataTypeBadges types={[inputType]} />
            </div>
            <div className="compare__measured">
              <DataTypeBadges types={['noMeasured']} />
            </div>
          </article>
        </div>

        <div className="section-grid">
          <CompareBars title={x.bpCompare} before={s.backPressure.before} after={s.backPressure.after} unit="mmH₂O" x={x} lang={lang} />
          <CompareBars title={x.tempCompare} before={s.exhaustTemp.before} after={s.exhaustTemp.after} unit="°C" x={x} lang={lang} />

          <Card span={2} title={x.econTitle} subtitle={x.econSub} badges={<DataTypeBadges types={['example']} />}>
            <dl className="econ-summary">
              <div>
                <dt>{x.monthlyGain}</dt>
                <dd>
                  <span className="num">{fmtMetric(m.monthlyIncrementalBenefitKrw, lang)}</span> <small>{x.won}</small>{' '}
                  <MetricStatusTag state={state} id="monthlyIncrementalBenefitKrw" lang={lang} />
                </dd>
              </div>
              <div>
                <dt>{x.investment}</dt>
                <dd>
                  <span className="num">{fmtMetric(m.initialInvestmentKrw, lang)}</span> <small>{x.won}</small>{' '}
                  <MetricStatusTag state={state} id="initialInvestmentKrw" lang={lang} />
                </dd>
              </div>
              <div className="econ-summary__key">
                <dt>{x.breakEven}</dt>
                <dd data-testid="breakeven">
                  <span className="num">{fmtMetric(m.breakEvenDays, lang, 1)}</span> <small>{x.days}</small>{' '}
                  <MetricStatusTag state={state} id="breakEvenDays" lang={lang} />
                </dd>
              </div>
            </dl>
          </Card>

          <CumulativeBenefitCard state={state} />
          <TimeSeriesCard />
          <MeasuredInput />
          <ConditionGuard />

          <Card span={2} title={x.sourcesTitle}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">{x.colItem}</th>
                    <th scope="col">{x.colSource}</th>
                    <th scope="col">{x.colStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((r) => (
                    <tr key={r.item}>
                      <th scope="row">{r.item}</th>
                      <td>
                        <span className="badge-row">
                          {r.src} <DataTypeBadges types={r.types} />
                        </span>
                      </td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </details>
  );
}
