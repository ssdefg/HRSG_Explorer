import type { ReactNode } from 'react';
import type { Lang } from '@/types';
import { Card, DataTypeBadges, StatusBadge } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { goToTab } from '@/lib/useHashTab';
import { KIT_CALC_DATA } from '@/lib/kit';

const W = KIT_CALC_DATA.constants.index_weights;
import type { AnalysisSnapshot } from '@/lib/caseStore';
import type { CalculatorState } from '@/context/Workspace';
import {
  PROGRESS_STEPS,
  type ActualPerformanceGap,
  type CalcSummaryKpi,
  type ChecklistReadiness,
  type MethodPayback,
  type ProgressStep,
} from '@/lib/dashboardModel';
import { LEVEL_STATUS } from '@/components/calculator/level';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';

export type DashMode = 'simulation' | 'measured';

const TXT = {
  ko: {
    bp: '가스터빈 배압',
    vsBase: '기준치 대비',
    stack: '스택 온도',
    lossMw: '발전 출력 손실량',
    lossKrw: '월간 발전 손실액',
    recovery: '세정 시 예상 회수 효과',
    recoveryNote: '회수 출력 ÷ 운전 출력',
    score: '세정 필요도 지수',
    scoreNote: `100 × (${W.hrsg_dp_mbar}·차압 + ${W.gt_bp_mbar}·배압 + ${W.stack_c}·스택) 초과 비율`,
    ready: '데이터 준비 수령률',
    won: '원',
    notMeasured: '실측 미입력',
    measuredAt: (d: number) => `실측 D${d >= 0 ? '+' : ''}${d}`,
    flowTitle: '공정 흐름 · 오염 상태',
    flowSub: 'GT → HRSG → ST · 계산기 입력과 즉시 동기화',
    flowNote: '개념도 · 실제 설비 도면 아님',
    gt: '가스터빈',
    hrsg: 'HRSG',
    st: '증기터빈',
    fouling: '오염 판정',
    cleanTitle: '세정 직후 대비 현재값',
    cleanSub: '세정 직후(D0)와 현재값 비교',
    d0: '세정 직후 (D0)',
    now: '현재',
    toBA: '세정 전후 상세 보기',
    target: '목표 기준선 · 기준 배압',
    d0Scenario: '실측이 없어 D0는 가상 시나리오 값입니다.',
    gapRecovery: '실측 회수 출력',
    gapBep: (ok: boolean) => (ok ? '손익분기 도달' : '손익분기 미도달'),
    nextTitle: '세정 판단 · 공법 경제성',
    steps: { data: '데이터 수집', simulation: '이상 징후 분석', analysis: '위험도 평가', ai: 'AI 검토' } as Record<ProgressStep, string>,
    stepsLabel: '평가 진행 단계',
    stepDone: '완료',
    stepActive: '진행 중',
    stepTodo: '대기',
    stepHint: {
      data: '필수 데이터 수령',
      simulation: '계산기 재평가 완료',
      analysis: '분석 스냅샷 저장',
      ai: 'AI 질의',
    } as Record<ProgressStep, string>,
    alertTitle: '주의',
    alertDanger: '경고',
    alertIndicator: (label: string, value: string, unit: string, level: string, thr: string) => `${label} ${value} ${unit} — ${level} 구간 (≥ ${thr})`,
    levelName: { caution: '주의', danger: '위험' } as Record<'caution' | 'danger', string>,
    alertTrip: '트립 시나리오가 선택되어 있습니다',
    alertScore: (s: string) => `세정 필요도 ${s}/100`,
    alertMissing: (n: number) => `필수 데이터 ${n}건 미수령 — 세정 필요성을 확정하지 않습니다`,
    alertStale: '계산기 입력이 바뀌어 재평가가 필요합니다',
    alertOpen: '체크리스트 열기',
    alertCalc: '계산기 열기',
    verdict: '세정 필요성 판정',
    needMore: '추가 검토 필요',
    needReady: '평가 조건 충족',
    methods: '공법별 회수 기간 (개월)',
    methodsNote: '키트 compareMethods · 드라이아이스 = 계산기 입력 · 나머지 = 키트 데이터 (가정 기준, 추천 아님)',
    noPayback: '회수 불가',
    noInput: '산출 불가',
    missing: (n: number) => `결측 데이터 ${n}건`,
    toChecklist: '체크리스트에서 보기',
    snapTitle: '최근 분석 스냅샷 비교',
    snapEmpty: '스냅샷이 2개 이상이면 최근 두 결과를 비교합니다.',
    snapCols: ['항목', '이전', '최근', '변화'],
    snapRows: { bp: '현재 배압 (mmH₂O)', loss: '월간 손실 (백만원)', payback: '회수 기간 (개월)', be: '손익분기 (일)' },
  },
  en: {
    bp: 'GT back pressure',
    vsBase: 'vs baseline',
    stack: 'Stack temperature',
    lossMw: 'Power output loss',
    lossKrw: 'Monthly generation loss',
    recovery: 'Expected recovery from cleaning',
    recoveryNote: 'Recovered ÷ operating output',
    score: 'Cleaning-need score',
    scoreNote: `100 × (${W.hrsg_dp_mbar}·ΔP + ${W.gt_bp_mbar}·BP + ${W.stack_c}·stack) excess ratio`,
    ready: 'Data receipt rate',
    won: 'KRW',
    notMeasured: 'Not measured',
    measuredAt: (d: number) => `Measured D${d >= 0 ? '+' : ''}${d}`,
    flowTitle: 'Process flow · fouling state',
    flowSub: 'GT → HRSG → ST · synced with calculator inputs',
    flowNote: 'Concept diagram · not an actual plant drawing',
    gt: 'Gas turbine',
    hrsg: 'HRSG',
    st: 'Steam turbine',
    fouling: 'Fouling',
    cleanTitle: 'Post-cleaning vs current',
    cleanSub: 'Right after cleaning (D0) vs current value',
    d0: 'Post-cleaning (D0)',
    now: 'Current',
    toBA: 'Open pre/post details',
    target: 'Target · baseline back pressure',
    d0Scenario: 'No measurements — D0 uses the mock scenario.',
    gapRecovery: 'Measured recovery',
    gapBep: (ok: boolean) => (ok ? 'Break-even reached' : 'Break-even not reached'),
    nextTitle: 'Cleaning verdict · method economics',
    steps: { data: 'Data collection', simulation: 'Anomaly analysis', analysis: 'Risk assessment', ai: 'AI review' } as Record<ProgressStep, string>,
    stepsLabel: 'Evaluation steps',
    stepDone: 'Done',
    stepActive: 'In progress',
    stepTodo: 'Pending',
    stepHint: {
      data: 'Required data received',
      simulation: 'Calculator re-evaluated',
      analysis: 'Analysis snapshot saved',
      ai: 'Asked the AI',
    } as Record<ProgressStep, string>,
    alertTitle: 'Warning',
    alertDanger: 'Danger',
    alertIndicator: (label: string, value: string, unit: string, level: string, thr: string) => `${label} ${value} ${unit} — ${level} band (≥ ${thr})`,
    levelName: { caution: 'caution', danger: 'danger' } as Record<'caution' | 'danger', string>,
    alertTrip: 'Trip scenario selected',
    alertScore: (s: string) => `Cleaning need ${s}/100`,
    alertMissing: (n: number) => `${n} required items not received — cleaning need not confirmed`,
    alertStale: 'Calculator inputs changed — re-evaluation needed',
    alertOpen: 'Open checklist',
    alertCalc: 'Open calculator',
    verdict: 'Cleaning-need verdict',
    needMore: 'Further review needed',
    needReady: 'Evaluation conditions met',
    methods: 'Payback by method (months)',
    methodsNote: 'Kit compareMethods · dry ice = calculator input · others = kit data (assumption, not a recommendation)',
    noPayback: 'No payback',
    noInput: 'N/A',
    missing: (n: number) => `${n} missing items`,
    toChecklist: 'Open in checklist',
    snapTitle: 'Recent snapshot comparison',
    snapEmpty: 'Compares the latest two results once two or more snapshots exist.',
    snapCols: ['Item', 'Previous', 'Latest', 'Change'],
    snapRows: { bp: 'Back pressure (mmH₂O)', loss: 'Monthly loss (KRW M)', payback: 'Payback (months)', be: 'Break-even (d)' },
  },
};

const num = (v: number | null, lang: Lang, d = 0) => (v === null ? '—' : formatNumber(v, lang, d));

function MiniKpi({ title, badges, children, foot, testId }: { title: string; badges?: ReactNode; children: ReactNode; foot?: ReactNode; testId?: string }) {
  return (
    <Card className="ov-kpi" title={title} badges={badges}>
      <div className="ov-kpi__value" data-testid={testId}>
        {children}
      </div>
      {foot && <div className="ov-kpi__foot">{foot}</div>}
    </Card>
  );
}

/** 0~100 반원 게이지 — 그레이 트랙 + 오렌지 채움 · 바늘 */
function ScoreGauge({ value }: { value: number | null }) {
  const v = Math.min(100, Math.max(0, value ?? 0));
  const r = 34;
  const len = Math.PI * r;
  const angle = Math.PI * (1 - v / 100);
  const nx = 40 + 26 * Math.cos(angle);
  const ny = 42 - 26 * Math.sin(angle);
  return (
    <svg className="score-gauge" viewBox="0 0 80 46" role="img" aria-label={`${Math.round(v)} / 100`}>
      <path d="M6 42 A34 34 0 0 1 74 42" fill="none" stroke="var(--c-track)" strokeWidth="7" strokeLinecap="round" />
      {value !== null && (
        <>
          <path
            d="M6 42 A34 34 0 0 1 74 42"
            fill="none"
            stroke="var(--c-chart-main)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(len * v) / 100} ${len}`}
          />
          <line x1="40" y1="42" x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke="var(--c-chart-main)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="40" cy="42" r="3" fill="var(--c-chart-main)" />
        </>
      )}
    </svg>
  );
}

/** 원형 프로그레스 */
function Ring({ pct }: { pct: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 40 40" role="img" aria-label={`${Math.round(pct)}%`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--c-track)" strokeWidth="5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="var(--c-chart-main)"
        strokeWidth="5"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform="rotate(-90 20 20)"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** KPI 7종 (가이드 §2.2) */
export function KpiGrid({
  lang,
  mode,
  kpi,
  calc,
  readiness,
  gap,
  demoBadge,
}: {
  lang: Lang;
  mode: DashMode;
  kpi: CalcSummaryKpi;
  calc: CalculatorState;
  readiness: ChecklistReadiness;
  gap: ActualPerformanceGap;
  demoBadge?: ReactNode;
}) {
  const x = TXT[lang];
  const measured = mode === 'measured';
  const bp = measured ? gap.currentBackPressure : kpi.backPressure;
  const stack = measured ? gap.currentStackTemp : kpi.stackTemp;
  const staleTag = calc.stale ? <DataTypeBadges types={['stale']} /> : null;
  const srcTag = measured ? (
    bp === null ? <DataTypeBadges types={['noMeasured']} /> : <DataTypeBadges types={['measured']} />
  ) : (
    <DataTypeBadges types={[calc.mode === 'demo' ? 'mock' : 'userInput']} />
  );
  const bpPct =
    measured && bp !== null && calc.values.referenceBp ? ((bp - calc.values.referenceBp) / calc.values.referenceBp) * 100 : kpi.backPressureDeltaPct;
  const pctText = bpPct === null ? '—' : `${bpPct >= 0 ? '+' : ''}${formatNumber(bpPct, lang, 1)}%`;
  const comp = (v: number | null, d: number) => (v === null ? <DataTypeBadges types={['notComputable']} /> : <span className="num">{num(v, lang, d)}</span>);

  return (
    <div className="dash-overview dash-overview--7" role="group" aria-label="KPI">
      <MiniKpi
        title={x.bp}
        badges={demoBadge}
        testId="kpi-bp"
        foot={
          <>
            <span className="ov-kpi__caption">
              {x.vsBase} <span className="num">{pctText}</span>
            </span>
            {srcTag}
          </>
        }
      >
        {bp === null ? <span className="ov-kpi__empty">{x.notMeasured}</span> : <span className="num">{num(bp, lang, 0)}</span>}{' '}
        <small>mmH₂O</small>
        {!measured && calc.level && (
          <span className="ov-kpi__status">
            <StatusBadge status={LEVEL_STATUS[calc.level]} />
          </span>
        )}
      </MiniKpi>
      <MiniKpi title={x.stack} badges={demoBadge} foot={srcTag} testId="kpi-stack">
        {stack === null ? <span className="ov-kpi__empty">{x.notMeasured}</span> : <span className="num">{num(stack, lang, 1)}</span>}{' '}
        <small>°C</small>
      </MiniKpi>
      <MiniKpi title={x.lossMw} badges={demoBadge} foot={staleTag ?? <DataTypeBadges types={['example']} />} testId="dash-loss-mw">
        {comp(kpi.lossMW, 3)} <small>MW</small>
      </MiniKpi>
      <MiniKpi title={x.lossKrw} badges={demoBadge} foot={staleTag ?? <DataTypeBadges types={['example']} />} testId="dash-loss-krw">
        {comp(kpi.lossMonthlyWon, 0)} <small>{x.won}</small>
      </MiniKpi>
      <MiniKpi
        title={x.recovery}
        badges={demoBadge}
        foot={
          <>
            <span className="ov-kpi__caption">{x.recoveryNote}</span>
            {staleTag}
          </>
        }
      >
        {comp(kpi.recoveryBenefitPct, 2)} <small>%</small>
      </MiniKpi>
      <MiniKpi
        title={x.score}
        badges={demoBadge}
        testId="kpi-score"
        foot={
          <>
            <span className="ov-kpi__caption">{x.scoreNote}</span>
            {staleTag}
          </>
        }
      >
        <ScoreGauge value={kpi.cleaningNeedScore} />
        {comp(kpi.cleaningNeedScore, 0)} <small>/ 100</small>
      </MiniKpi>
      <MiniKpi
        title={x.ready}
        badges={demoBadge}
        testId="dash-receipt"
        foot={
          <span className="ov-kpi__caption num">
            {readiness.receivedCount} / {readiness.totalCount}
          </span>
        }
      >
        <Ring pct={readiness.readinessRate} />
        <span className="num">{formatNumber(readiness.readinessRate, lang, 0)}</span> <small>%</small>
      </MiniKpi>
    </div>
  );
}

/** GT → HRSG(오염 오버레이) → ST 도식 */
export function ProcessFlow({ lang, calc, kpi }: { lang: Lang; calc: CalculatorState; kpi: CalcSummaryKpi }) {
  const x = TXT[lang];
  const level = calc.level;
  const tone = level === 'danger' ? 'warning' : level === 'caution' ? 'caution' : level === 'normal' ? 'normal' : 'none';
  return (
    <Card title={x.flowTitle} subtitle={x.flowSub} badges={<DataTypeBadges types={['mock']} />}>
      <div className="pflow" data-testid="process-flow" data-level={level ?? 'none'}>
        <div className="pflow__node">
          <span className="pflow__name">{x.gt}</span>
          <span className="pflow__val num">{num(calc.values.capacityMw, lang, 0)} MW</span>
          <span className="pflow__val num">{num(calc.values.loadPct, lang, 0)} %</span>
        </div>
        <span className="pflow__arrow" aria-hidden="true">→</span>
        <div className={`pflow__node pflow__node--hrsg pflow__node--${tone}`}>
          <span className="pflow__name">{x.hrsg}</span>
          <span className="pflow__val num" data-testid="flow-bp">
            {num(kpi.backPressure, lang, 0)} mmH₂O
          </span>
          <span className="pflow__val num">ΔBP {num(calc.metrics.deltaBp.value, lang, 0)}</span>
          <span className="pflow__val num">{num(kpi.stackTemp, lang, 1)} °C</span>
          {level && (
            <span className="pflow__tag">
              {x.fouling}: <StatusBadge status={LEVEL_STATUS[level]} />
            </span>
          )}
        </div>
        <span className="pflow__arrow" aria-hidden="true">→</span>
        <div className="pflow__node">
          <span className="pflow__name">{x.st}</span>
          <span className="pflow__val num">{num(calc.values.drumPressure, lang, 0)} bar(a)</span>
          <span className="pflow__val num">Tsat {num(calc.pinch.tSatC, lang, 1)} °C</span>
        </div>
      </div>
      <p className="note">{x.flowNote}</p>
    </Card>
  );
}

/** 얇은 알약 트랙 + 오렌지 바 + (선택) 목표 기준선 */
function Bars({
  rows,
  lang,
  unit,
  target,
}: {
  rows: { label: string; value: number | null }[];
  lang: Lang;
  unit: string;
  target?: { value: number; label: string };
}) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0), (target?.value ?? 0) * 1.05);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <ul className="hbar">
      {rows.map((r) => (
        <li key={r.label} className="hbar__row">
          <span className="hbar__label">{r.label}</span>
          <span className="hbar__track">
            <span className="hbar__fill" style={{ width: pct(r.value ?? 0) }} />
            {target && <span className="hbar__target" style={{ left: pct(target.value) }} title={target.label} />}
          </span>
          <span className="hbar__val num">
            {num(r.value, lang, 1)} {unit}
          </span>
        </li>
      ))}
      {target && (
        <li className="hbar__legend">
          <span className="hbar__target-key" aria-hidden="true" /> {target.label}{' '}
          <span className="num">
            {num(target.value, lang, 0)} {unit}
          </span>
        </li>
      )}
    </ul>
  );
}

/** 세정 직후(D0) 대비 현재값 비교 */
export function CleaningSummary({
  lang,
  kpi,
  gap,
  baselineBp,
}: {
  lang: Lang;
  kpi: CalcSummaryKpi;
  gap: ActualPerformanceGap;
  baselineBp: number | null;
}) {
  const x = TXT[lang];
  const hasMeasured = gap.d0BackPressure !== null;
  const d0 = hasMeasured ? gap.d0BackPressure : VALIDATION_SCENARIO.backPressure.after;
  const now = gap.currentBackPressure ?? kpi.backPressure;
  return (
    <Card title={x.cleanTitle} subtitle={x.cleanSub} badges={<DataTypeBadges types={[hasMeasured ? 'measured' : 'scenario']} />}>
      <Bars
        lang={lang}
        unit="mmH₂O"
        target={baselineBp === null ? undefined : { value: baselineBp, label: x.target }}
        rows={[
          { label: x.d0, value: d0 },
          { label: x.now, value: now },
        ]}
      />
      {hasMeasured ? (
        <p className="note">
          {x.gapRecovery}: <strong className="num">{num(gap.actualRecoveryMW, lang, 3)} MW</strong>
          {gap.bepAchieved !== null && <> · {x.gapBep(gap.bepAchieved)}</>}
        </p>
      ) : (
        <p className="note">{x.d0Scenario}</p>
      )}
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => goToTab('validation')}>
        {x.toBA}
      </button>
    </Card>
  );
}

/** 세정 필요성 판정 · 공법 회수 기간 · 결측 점프 (진행 단계는 상단 StepBar) */
export function NextActionCard({
  lang,
  evaluable,
  methods,
  readiness,
  onMissing,
}: {
  lang: Lang;
  evaluable: boolean;
  methods: MethodPayback[];
  readiness: ChecklistReadiness;
  onMissing: () => void;
}) {
  const x = TXT[lang];
  const maxPb = Math.max(0.01, ...methods.map((m) => m.paybackMonths ?? 0));
  return (
    <Card title={x.nextTitle} badges={<DataTypeBadges types={['example']} />}>
      <p className="next-verdict" data-testid="dash-need">
        {x.verdict}: <StatusBadge status={evaluable ? 'normal' : 'caution'} label={evaluable ? x.needReady : x.needMore} />
      </p>

      <h4 className="calc-subhead">{x.methods}</h4>
      <ul className="hbar">
        {methods.map((m) => (
          <li key={m.method.id} className="hbar__row">
            <span className="hbar__label">{m.method.name}</span>
            <span className="hbar__track">
              <span className="hbar__fill" style={{ width: `${((m.paybackMonths ?? 0) / maxPb) * 100}%` }} />
            </span>
            <span className="hbar__val num" title={m.message ?? undefined}>
              {m.paybackMonths === null ? (m.message ? x.noInput : x.noPayback) : formatNumber(m.paybackMonths, lang, 2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="note">{x.methodsNote}</p>

      <div className="dash-missing">
        <span className="num" data-testid="dash-missing">
          {x.missing(readiness.missingIds.length)}
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onMissing} disabled={readiness.missingIds.length === 0} data-testid="dash-missing-jump">
          {x.toChecklist}
        </button>
      </div>
    </Card>
  );
}

/** 최근 두 스냅샷 비교 */
export function SnapshotCompare({ lang, snapshots }: { lang: Lang; snapshots: AnalysisSnapshot[] }) {
  const x = TXT[lang];
  const [latest, prev] = snapshots;
  if (!latest || !prev) {
    return (
      <Card title={x.snapTitle}>
        <p className="empty-state">{x.snapEmpty}</p>
      </Card>
    );
  }
  const rows: { label: string; a: number | null; b: number | null; d: number }[] = [
    { label: x.snapRows.bp, a: prev.inputs.currentBp ?? null, b: latest.inputs.currentBp ?? null, d: 0 },
    {
      label: x.snapRows.loss,
      a: prev.bp.monthlyLossKrw === null ? null : prev.bp.monthlyLossKrw / 1e6,
      b: latest.bp.monthlyLossKrw === null ? null : latest.bp.monthlyLossKrw / 1e6,
      d: 1,
    },
    { label: x.snapRows.payback, a: prev.cleaning.paybackMonths, b: latest.cleaning.paybackMonths, d: 2 },
    { label: x.snapRows.be, a: prev.cleaning.breakEvenDays, b: latest.cleaning.breakEvenDays, d: 1 },
  ];
  return (
    <Card title={x.snapTitle} subtitle={`#${prev.seq} → #${latest.seq}`}>
      <table className="data-table data-table--compact" data-testid="snapshot-compare">
        <thead>
          <tr>
            {x.snapCols.map((c, i) => (
              <th key={c} scope="col" className={i ? 'num-col' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const diff = r.a !== null && r.b !== null ? r.b - r.a : null;
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="num-col num">{num(r.a, lang, r.d)}</td>
                <td className="num-col num">{num(r.b, lang, r.d)}</td>
                <td className="num-col num">{diff === null ? '—' : `${diff >= 0 ? '+' : ''}${formatNumber(diff, lang, r.d)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/** 상단 평가 단계 바 — 01 데이터 수집 → 02 이상 징후 분석 → 03 위험도 평가 → 04 AI 검토 (실제 진행 상태 기준) */
export function StepBar({ lang, steps }: { lang: Lang; steps: Record<ProgressStep, boolean> }) {
  const x = TXT[lang];
  // 활성 단계 = 아직 끝나지 않은 첫 단계 (모두 끝났으면 없음)
  const active = PROGRESS_STEPS.find((s) => !steps[s]) ?? null;
  return (
    <ol className="stepbar" aria-label={x.stepsLabel} data-testid="stepbar">
      {PROGRESS_STEPS.map((s, i) => {
        const state = steps[s] ? 'done' : s === active ? 'active' : 'todo';
        return (
          <li key={s} className={`stepbar__item stepbar__item--${state}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="stepbar__badge" aria-hidden="true">
              {state === 'done' ? '✓' : String(i + 1).padStart(2, '0')}
            </span>
            <span className="stepbar__text">
              <span className="stepbar__name">{x.steps[s]}</span>
              <span className="stepbar__hint">
                {state === 'done' ? x.stepDone : state === 'active' ? x.stepActive : x.stepTodo} · {x.stepHint[s]}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 단계 바 아래 주의/경고 배너 — DEMO 경보 규칙·세정 필요도·필수 데이터·재평가 상태에서 만든다 (없으면 표시 안 함) */
export function AlertBanner({
  lang,
  calc,
  kpi,
  readiness,
  tripScenario,
  onChecklist,
  onCalculator,
}: {
  lang: Lang;
  calc: CalculatorState;
  kpi: CalcSummaryKpi;
  readiness: ChecklistReadiness;
  tripScenario: boolean;
  onChecklist: () => void;
  onCalculator: () => void;
}) {
  const x = TXT[lang];
  const lines: string[] = [];
  // 키트 지표 3개(GT 배압 · HRSG 차압 · 스택 온도) 중 주의·위험 구간인 것
  const ind = calc.kit.result?.indicators;
  if (ind) {
    const unit: Record<string, string> = { gt_bp_mbar: 'mbar', hrsg_dp_mbar: 'mbar', stack_c: '°C' };
    for (const [k, i] of Object.entries(ind)) {
      if (i.level === 'normal') continue;
      lines.push(x.alertIndicator(i.label, num(i.value, lang, 1), unit[k], x.levelName[i.level], num(i.level === 'danger' ? i.danger : i.caution, lang, 1)));
    }
  }
  if (tripScenario) lines.push(x.alertTrip);
  if (lines.length && kpi.cleaningNeedScore !== null) lines.push(x.alertScore(num(kpi.cleaningNeedScore, lang, 0)));
  if (calc.stale) lines.push(x.alertStale);
  if (readiness.missingIds.length > 0 && lines.length) lines.push(x.alertMissing(readiness.missingIds.length));
  if (lines.length === 0) return null;
  const danger = calc.level === 'danger' || tripScenario;
  return (
    <div className={`alert-banner${danger ? ' alert-banner--danger' : ''}`} role="alert" data-testid="alert-banner">
      <span className="alert-banner__icon" aria-hidden="true">
        !
      </span>
      <div className="alert-banner__body">
        <strong className="alert-banner__title">{danger ? x.alertDanger : x.alertTitle}</strong>
        <span className="alert-banner__text">{lines.join(' · ')}</span>
      </div>
      <div className="alert-banner__actions">
        {calc.stale && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCalculator}>
            {x.alertCalc}
          </button>
        )}
        {readiness.missingIds.length > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onChecklist}>
            {x.alertOpen}
          </button>
        )}
      </div>
    </div>
  );
}
