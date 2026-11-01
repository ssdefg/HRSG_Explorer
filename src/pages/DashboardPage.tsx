import { useEffect } from 'react';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { AiQaSection } from '@/components/qa/AiQaSection';
import { QaHistoryPanel } from '@/components/qa/QaHistoryPanel';
import { Card, DataTypeBadges, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalculator, useCases, useChecklist, useHistory, useMeasurements } from '@/context/Workspace';
import { useCalcText } from '@/i18n/calculatorStrings';
import { activeAlarms, DEMO_ALARM_RULES } from '@/lib/alarms';
import { calcChange, calcSimplePaybackMonths } from '@/lib/calc';
import { formatNumber, pick } from '@/lib/format';
import { consumePendingSection, goToTab, scrollToSection } from '@/lib/useHashTab';
import { INPUT_DEF, SCENARIO_LABEL } from '@/data/calculatorInputs';
import { MOCK_CLEANING_METHODS } from '@/data/mockCleaning';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';
import { LEVEL_STATUS, levelLabel } from '@/components/calculator/level';
import { fmtMetric, MetricStatusTag } from '@/components/calculator/metricText';

const TXT = {
  ko: {
    stOp: '가상 운전 상태',
    stAlarms: '활성 경보',
    stAlarmRules: 'DEMO 경보 규칙',
    stAlarmNone: '정의된 규칙 중 활성 경보 없음',
    stDataTime: '데이터 기준 시점',
    stDataTimeVal: '미정 — 시연 데이터에 측정 시점 없음',
    stCalcTime: '마지막 입력·계산',
    stNotLive: '실시간 연동 아님',
    opTitle: '운전 현황',
    opSub: '현재 케이스의 계산기 입력값 (가상 데이터)',
    model: '가스터빈 모델',
    capacity: '설비 용량',
    dp: '차압 ΔP',
    bp: '현재 배압',
    stack: '스택 온도',
    opStatus: '운전 상태',
    scenarioSel: '시나리오',
    autoStatus: '배압 자동 판별',
    readyTitle: '데이터 준비 현황',
    readySub: '데이터 요청 체크리스트 기준',
    receipt: '데이터 수령률',
    review: '검토 진행률',
    requiredMet: '필수 데이터 충족',
    evaluable: '평가 가능 여부',
    missing: '부족 데이터',
    yes: '충족',
    no: '미충족',
    evalYes: '평가 가능',
    evalNo: '평가 불가 — 추가 검토 필요',
    count: (n: number) => `${n}개`,
    sumTitle: '성능 및 경제성 요약',
    lossMw: '예상 발전 출력 손실',
    lossKrw: '예상 월간 발전 손실액',
    needTitle: '세정 필요성 검토 상태',
    needMore: '추가 검토 필요',
    needMoreDesc: (n: number) => `필수 데이터 ${n}개 미수령 — 배압 하나만으로 세정 필요성을 확정하지 않습니다.`,
    needReady: '평가 조건 충족 — 검증된 모델로 판단 필요',
    needReadyDesc: '필수 데이터는 갖춰졌지만 이 프로토타입의 계산은 예시 계산입니다.',
    effectTitle: '세정 전후 예상 효과',
    effectBp: '배압 (가상 시나리오)',
    effectRecovered: '회수 출력 (입력 가정)',
    effectBreakeven: '손익분기 (예시 계산)',
    effectStatus: '평가 상태: 가상 시나리오 · 실측 미검증',
    toDetail: '세정 전후 상세 분석으로 이동',
    methodTitle: '공법별 비용·편익 요약',
    methodSub: '가상 데이터 · 실제 견적 아님',
    payback: '회수',
    months: '개월',
    histTitle: '최근 분석 내역',
    histSub: '이 케이스에서 저장한 계산 결과 스냅샷',
    histEmpty: '저장된 분석이 없습니다. 계산기에서 "분석 스냅샷 저장" 또는 "이 결과 질문하기"를 누르면 여기에 기록됩니다.',
    histStale: '이전 입력 기준',
    histCurrent: '현재 입력과 동일',
    caseTitle: '현재 평가 케이스',
    created: '생성',
    updated: '최근 수정',
    mode: '평가 모드',
    demo: 'DEMO 시나리오',
    user: '사용자 입력',
    snapshots: '분석 스냅샷',
    measurements: '실측 스냅샷',
    messages: 'AI 대화',
    nextTitle: '다음 추천 작업',
    nextNone: '현재 추천할 작업이 없습니다.',
    tFixInputs: (n: number) => `계산기 입력 오류 ${n}건을 보완하세요.`,
    tMarkRequest: (n: number) => `필수 데이터 ${n}개를 "요청 필요"로 지정하고 자료 요청 이메일 초안을 만드세요.`,
    tSendEmail: (n: number) => `"요청 필요" ${n}개 항목으로 이메일 초안을 생성·복사하세요 (발송은 직접).`,
    tReview: (n: number) => `체크리스트 미검토 항목 ${n}개를 검토하세요.`,
    tSnapshot: '계산 결과 스냅샷을 저장하거나 AI에 결과를 질문하세요.',
    tMeasure: '데이터 수령 후 세정 전후 실측 스냅샷을 입력하세요.',
    go: '이동',
    toMissing: '누락 데이터 확인',
    won: '원',
    moreTitle: '상세 내역 — 데이터 준비 · 세정 검토 · 공법 비교 · 분석 이력 · 케이스 · 다음 작업',
  },
  en: {
    stOp: 'Mock operating state',
    stAlarms: 'Active alarms',
    stAlarmRules: 'DEMO alarm rules',
    stAlarmNone: 'No active alarms among defined rules',
    stDataTime: 'Data reference time',
    stDataTimeVal: 'Undefined — mock data has no measurement time',
    stCalcTime: 'Last input / calculation',
    stNotLive: 'Not live',
    opTitle: 'Operating status',
    opSub: 'Calculator inputs of the current case (mock data)',
    model: 'Gas turbine model',
    capacity: 'Capacity',
    dp: 'ΔP',
    bp: 'Current back pressure',
    stack: 'Stack temperature',
    opStatus: 'Operating state',
    scenarioSel: 'Scenario',
    autoStatus: 'Auto (back pressure)',
    readyTitle: 'Data readiness',
    readySub: 'From the data request checklist',
    receipt: 'Data receipt rate',
    review: 'Review progress',
    requiredMet: 'Required data met',
    evaluable: 'Evaluable',
    missing: 'Missing data',
    yes: 'Met',
    no: 'Not met',
    evalYes: 'Evaluable',
    evalNo: 'Not evaluable — further review needed',
    count: (n: number) => `${n}`,
    sumTitle: 'Performance & economics summary',
    lossMw: 'Est. power output loss',
    lossKrw: 'Est. monthly generation loss',
    needTitle: 'Cleaning-need review status',
    needMore: 'Further review needed',
    needMoreDesc: (n: number) => `${n} required items not received — back pressure alone does not confirm cleaning need.`,
    needReady: 'Conditions met — judge with a validated model',
    needReadyDesc: 'Required data is in place, but calculations here are example calculations.',
    effectTitle: 'Expected pre/post cleaning effect',
    effectBp: 'Back pressure (mock scenario)',
    effectRecovered: 'Recovered output (assumed input)',
    effectBreakeven: 'Break-even (example calc)',
    effectStatus: 'Status: mock scenario · not validated by measurement',
    toDetail: 'Open pre/post cleaning analysis',
    methodTitle: 'Cleaning method cost/benefit',
    methodSub: 'Mock data · not real quotes',
    payback: 'Payback',
    months: 'months',
    histTitle: 'Recent analyses',
    histSub: 'Calculation snapshots saved in this case',
    histEmpty: 'No saved analyses. Press "Save analysis snapshot" or "Ask about this result" in the calculator to record one here.',
    histStale: 'Older inputs',
    histCurrent: 'Matches current inputs',
    caseTitle: 'Current case',
    created: 'Created',
    updated: 'Updated',
    mode: 'Mode',
    demo: 'DEMO scenario',
    user: 'User input',
    snapshots: 'Analysis snapshots',
    measurements: 'Measured snapshots',
    messages: 'AI messages',
    nextTitle: 'Recommended next steps',
    nextNone: 'Nothing to recommend right now.',
    tFixInputs: (n: number) => `Fix ${n} calculator input error(s).`,
    tMarkRequest: (n: number) => `Mark ${n} required items as "request needed" and draft the request email.`,
    tSendEmail: (n: number) => `Generate and copy the email draft for ${n} "request needed" items (send it yourself).`,
    tReview: (n: number) => `Review ${n} unreviewed checklist items.`,
    tSnapshot: 'Save a calculation snapshot or ask the AI about the result.',
    tMeasure: 'Enter pre/post measured snapshots once data is received.',
    go: 'Go',
    toMissing: 'Check missing data',
    won: 'KRW',
    moreTitle: 'Details — data readiness · cleaning review · methods · analyses · case · next steps',
  },
};

/**
 * 대시보드 — 최상단 핵심 KPI 4개 + 컴팩트 AI 패널 + 현재 케이스 요약 허브.
 * 계산 결과는 계산기와 같은 중앙 상태를 참조한다(화면별 재계산 없음).
 */
export function DashboardPage({ navCount }: { navCount: number }) {
  const { lang, t } = useAppSettings();
  const x = TXT[lang];
  const c = useCalcText();
  const calc = useCalculator();
  const cl = useChecklist();
  const cases = useCases();
  const history = useHistory();
  const { entries } = useMeasurements();
  const cur = cases.current;
  const v = calc.values;
  const m = calc.metrics;
  const alarms = activeAlarms({ currentBp: v.currentBp, scenario: calc.mode === 'demo' ? calc.scenario : 'custom' });
  const scenarioLabel = SCENARIO_LABEL[calc.mode === 'demo' ? calc.scenario : 'custom'][lang];
  const r = cl.readiness;
  const n = (val: number | null, d = 0) => (val === null ? '—' : formatNumber(val, lang, d));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const bpCh = calcChange(VALIDATION_SCENARIO.backPressure.before, VALIDATION_SCENARIO.backPressure.after);
  const unreviewed = cl.summary.total - cl.summary.reviewedCount;
  // DEMO 시나리오일 때만 KPI 카드 우측 상단에 표시
  const demoBadge = calc.mode === 'demo' ? <span className="badge badge--demo-mini">DEMO</span> : undefined;
  // 다른 화면에서 AI 질의응답(예: 계산기 '이 결과 질문하기')으로 이동해 온 경우
  useEffect(() => {
    const section = consumePendingSection();
    if (section) window.requestAnimationFrame(() => scrollToSection(section));
  }, [navCount]);

  const goMissing = () => {
    const first = r.missingIds[0];
    if (first) cl.requestFocus(first);
    goToTab('checklist');
  };

  const tasks: { text: string; action: () => void }[] = [];
  if (calc.errorIds.length) tasks.push({ text: x.tFixInputs(calc.errorIds.length), action: () => goToTab('calculator') });
  if (cl.summary.byStatus.requestNeeded === 0 && r.missingIds.length) tasks.push({ text: x.tMarkRequest(r.missingIds.length), action: goMissing });
  if (cl.summary.byStatus.requestNeeded > 0) tasks.push({ text: x.tSendEmail(cl.summary.byStatus.requestNeeded), action: () => goToTab('checklist') });
  if (unreviewed > 0) tasks.push({ text: x.tReview(unreviewed), action: () => goToTab('checklist') });
  if (history.snapshots.length === 0) tasks.push({ text: x.tSnapshot, action: () => goToTab('calculator') });
  if (entries.length === 0) tasks.push({ text: x.tMeasure, action: () => goToTab('validation') });

  return (
    <PageScaffold tabId="dashboard" pageDataTypes={['mock', 'example', 'noMeasured', 'planned']}>
      {/* 최상단: 핵심 KPI 4개 — 값·배지는 아래 상세 카드와 같은 중앙 상태 */}
      <div className="dash-overview" role="group" aria-label={t.keyIndicators}>
        <Card className="ov-kpi" title={x.bp} badges={demoBadge}>
          <p className="ov-kpi__value">
            <span className="num">{n(v.currentBp)}</span> <small>mmH₂O</small>
            <span className="ov-kpi__status">
              {calc.level ? <StatusBadge status={LEVEL_STATUS[calc.level]} label={levelLabel(calc.level, c)} /> : '—'}
            </span>
          </p>
          <div className="ov-kpi__foot">
            <DataTypeBadges types={['unconfirmed']} />
          </div>
        </Card>
        <Card className="ov-kpi ov-kpi--key" title={x.lossKrw} badges={demoBadge}>
          <p className="ov-kpi__value">
            <span className="num" data-testid="dash-loss-krw">
              {fmtMetric(m.monthlyLossKrw, lang)}
            </span>{' '}
            <small>{x.won}</small>
          </p>
          <div className="ov-kpi__foot">
            <MetricStatusTag state={calc} id="monthlyLossKrw" lang={lang} />
            <DataTypeBadges types={m.monthlyLossKrw.status === 'model' ? ['planned'] : ['example']} />
          </div>
        </Card>
        <Card className="ov-kpi" title={x.lossMw} badges={demoBadge}>
          <p className="ov-kpi__value">
            <span className="num" data-testid="dash-loss-mw">
              {fmtMetric(m.powerLossMw, lang, 2)}
            </span>{' '}
            <small>MW</small>
          </p>
          <div className="ov-kpi__foot">
            <MetricStatusTag state={calc} id="powerLossMw" lang={lang} />
            <DataTypeBadges types={m.powerLossMw.status === 'model' ? ['planned'] : ['example']} />
          </div>
        </Card>
        <Card className="ov-kpi" title={x.readyTitle} badges={demoBadge}>
          <p className="ov-kpi__value">
            <span className="num">{cl.summary.receivedCount}</span> <small className="num">/ {cl.summary.total}</small>
          </p>
          <div className="meter meter--receipt ov-kpi__meter">
            <span style={{ width: `${cl.summary.receivedPct}%` }} />
          </div>
          <div className="ov-kpi__foot">
            <span className="ov-kpi__caption">
              {x.receipt} <span className="num">{formatNumber(cl.summary.receivedPct, lang, 0)}%</span>
            </span>
            <DataTypeBadges types={['noMeasured']} />
          </div>
        </Card>
      </div>

      {/* 전체 폭 AI 카드: [대화+입력 | 추천 질문] */}
      <AiQaSection />

      {/* 운전 현황 · 세정 전후 요약 — 2열 */}
      <div className="dash-cols">
        <Card title={x.opTitle} subtitle={x.opSub} badges={<DataTypeBadges types={calc.mode === 'demo' ? ['mock'] : ['userInput']} />}>
          <dl className="kv-grid">
            <div>
              <dt>{x.model}</dt>
              <dd data-testid="dash-model">{calc.model}</dd>
            </div>
            <div>
              <dt>{x.capacity}</dt>
              <dd className="num">{n(v.capacityMw)} MW</dd>
            </div>
            <div>
              <dt>{x.dp}</dt>
              <dd className="num">
                {n(v.diffPressure, 1)} {pick(INPUT_DEF.diffPressure.unit, lang)}
              </dd>
            </div>
            <div>
              <dt>{x.bp}</dt>
              <dd className="num">{n(v.currentBp)} mmH₂O</dd>
            </div>
            <div>
              <dt>{x.stack}</dt>
              <dd className="num">{n(v.exhaustTemp)} °C</dd>
            </div>
            <div>
              <dt>{x.opStatus}</dt>
              <dd>
                <span className="kv-grid__sub">
                  {x.scenarioSel}: {scenarioLabel}
                </span>
                <span className="kv-grid__sub">
                  {x.autoStatus}: {calc.level ? <StatusBadge status={LEVEL_STATUS[calc.level]} label={levelLabel(calc.level, c)} /> : '—'}{' '}
                  <DataTypeBadges types={['unconfirmed']} />
                </span>
              </dd>
            </div>
          </dl>
        </Card>
        <Card title={x.effectTitle} badges={<DataTypeBadges types={['scenario', 'example']} />}>
          <dl className="kv-list-compact">
            <div>
              <dt>{x.effectBp}</dt>
              <dd className="num">
                {VALIDATION_SCENARIO.backPressure.before} → {VALIDATION_SCENARIO.backPressure.after} mmH₂O{' '}
                {bpCh?.pct != null && <small>({formatNumber(bpCh.pct, lang, 1)}%)</small>}
              </dd>
            </div>
            <div>
              <dt>{x.effectRecovered}</dt>
              <dd className="num">+{n(v.recoveredPowerMw, 2)} MW</dd>
            </div>
            <div>
              <dt>{x.effectBreakeven}</dt>
              <dd className="num" data-testid="dash-breakeven">
                {fmtMetric(m.breakEvenDays, lang, 1)} {lang === 'ko' ? '일' : 'd'} <MetricStatusTag state={calc} id="breakEvenDays" lang={lang} />
              </dd>
            </div>
          </dl>
          <p className="note">{x.effectStatus}</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => goToTab('validation')}>
            {x.toDetail}
          </button>
        </Card>
      </div>

      {/* 상태 표시 — 실시간 정보가 아님 */}
      <div className="status-strip card" role="group" aria-label={x.stOp} data-testid="status-strip">
        <div className="status-strip__item">
          <span className="status-strip__label">{x.stOp}</span>
          <span className="status-strip__value">
            {scenarioLabel}
            {calc.level && <StatusBadge status={LEVEL_STATUS[calc.level]} label={levelLabel(calc.level, c)} />}
          </span>
        </div>
        <details className="status-strip__item status-strip__alarms">
          <summary>
            <span className="status-strip__label">{x.stAlarms}</span>
            <strong className="status-strip__value num" data-testid="alarm-count">
              {alarms.length}
            </strong>
          </summary>
          <ul className="alarm-rules">
            {DEMO_ALARM_RULES.map((rule) => (
              <li key={rule.id} className={alarms.includes(rule) ? 'is-active' : undefined}>
                {alarms.includes(rule) ? '● ' : '○ '}
                {rule.label[lang]}
              </li>
            ))}
            {alarms.length === 0 && <li>{x.stAlarmNone}</li>}
          </ul>
          <span className="note">{x.stAlarmRules}</span>
        </details>
        <div className="status-strip__item">
          <span className="status-strip__label">{x.stDataTime}</span>
          <span className="status-strip__value status-strip__value--muted">{x.stDataTimeVal}</span>
        </div>
        <div className="status-strip__item">
          <span className="status-strip__label">{x.stCalcTime}</span>
          <span className="status-strip__value num">{fmtTime(cur.updatedAt)}</span>
        </div>
        <span className="badge badge--mock">DEMO · MOCK DATA</span>
        <span className="note">{x.stNotLive}</span>
      </div>

      {/* 하단: 상세 내역 — 기본 접힘 (카드 내용은 그대로) */}
      <details className="dash-more">
        <summary className="dash-more__summary">{x.moreTitle}</summary>
        <div className="dash-more__body">
          <h3 className="section-title">{x.sumTitle}</h3>
          <div className="dash-cols dash-cols--3">
            <Card title={x.needTitle} badges={<DataTypeBadges types={['unconfirmed']} />}>
              <p className="dash-need" data-testid="dash-need">
                {r.evaluable ? x.needReady : x.needMore}
              </p>
              <p className="note">{r.evaluable ? x.needReadyDesc : x.needMoreDesc(r.missingIds.length)}</p>
            </Card>
            <Card title={x.methodTitle} subtitle={x.methodSub} badges={<DataTypeBadges types={['mock']} />}>
              <ul className="method-list">
                {MOCK_CLEANING_METHODS.map((mt) => {
                  const pb = calcSimplePaybackMonths(mt.costKrw, mt.monthlyBenefitKrw);
                  return (
                    <li key={mt.id}>
                      <span>{mt.label[lang]}</span>
                      <span className="num">
                        {formatNumber(mt.costKrw / 1e6, lang, 0)} / {formatNumber(mt.monthlyBenefitKrw / 1e6, lang, 0)} {lang === 'ko' ? '백만원' : 'KRW M'}
                      </span>
                      <span className="num note">
                        {x.payback} {pb === null ? '—' : formatNumber(pb, lang, 2)} {x.months}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title={x.readyTitle} subtitle={x.readySub} badges={<DataTypeBadges types={['noMeasured']} />}>
              <dl className="kv-grid">
                <div>
                  <dt>{x.receipt}</dt>
                  <dd className="num" data-testid="dash-receipt">
                    {formatNumber(cl.summary.receivedPct, lang, 0)}% <small>({cl.summary.receivedCount}/{cl.summary.total})</small>
                  </dd>
                </div>
                <div>
                  <dt>{x.review}</dt>
                  <dd className="num" data-testid="dash-review">
                    {formatNumber(cl.summary.reviewPct, lang, 0)}% <small>({cl.summary.reviewedCount}/{cl.summary.total})</small>
                  </dd>
                </div>
                <div>
                  <dt>{x.requiredMet}</dt>
                  <dd>
                    {r.requiredMet ? x.yes : x.no}{' '}
                    <small className="num">
                      ({r.requiredTotal - r.missingIds.length}/{r.requiredTotal})
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{x.evaluable}</dt>
                  <dd data-testid="dash-evaluable">{r.evaluable ? x.evalYes : x.evalNo}</dd>
                </div>
                <div>
                  <dt>{x.missing}</dt>
                  <dd className="num" data-testid="dash-missing">
                    {x.count(r.missingIds.length)}
                  </dd>
                </div>
              </dl>
              <button type="button" className="btn btn--ghost btn--sm" onClick={goMissing}>
                {x.toMissing}
              </button>
            </Card>
          </div>
          <div className="dash-cols dash-cols--3">
            <Card title={x.histTitle} subtitle={x.histSub}>
              {history.snapshots.length === 0 ? (
                <p className="empty-state" data-testid="history-empty">
                  {x.histEmpty}
                </p>
              ) : (
                <ul className="history-list" data-testid="history-list">
                  {history.snapshots.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <strong className="num">#{s.seq}</strong>
                      <span className="num">{fmtTime(s.createdAt)}</span>
                      <span>
                        {s.model} · {s.mode === 'demo' ? x.demo : x.user}
                      </span>
                      <span className="num">
                        {s.bp.monthlyLossKrw === null ? '—' : `${formatNumber(s.bp.monthlyLossKrw, lang, 0)} ${x.won}`}
                      </span>
                      <span className={`src-tag${s.inputsKey === calc.inputsKey ? ' src-tag--user' : ''}`}>
                        {s.inputsKey === calc.inputsKey ? x.histCurrent : x.histStale}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title={x.caseTitle}>
              <dl className="kv-list-compact">
                <div>
                  <dt>{lang === 'ko' ? '이름' : 'Name'}</dt>
                  <dd data-testid="dash-case-name">{cur.name}</dd>
                </div>
                <div>
                  <dt>{x.created}</dt>
                  <dd className="num">{fmtTime(cur.createdAt)}</dd>
                </div>
                <div>
                  <dt>{x.updated}</dt>
                  <dd className="num">{fmtTime(cur.updatedAt)}</dd>
                </div>
                <div>
                  <dt>{x.mode}</dt>
                  <dd>{calc.mode === 'demo' ? x.demo : x.user}</dd>
                </div>
                <div>
                  <dt>{x.snapshots}</dt>
                  <dd className="num">{history.snapshots.length}</dd>
                </div>
                <div>
                  <dt>{x.measurements}</dt>
                  <dd className="num">{entries.length}</dd>
                </div>
                <div>
                  <dt>{x.messages}</dt>
                  <dd className="num">{cur.qa.messages.length}</dd>
                </div>
              </dl>
            </Card>
            <Card title={x.nextTitle}>
              {tasks.length === 0 ? (
                <p className="empty-state">{x.nextNone}</p>
              ) : (
                <ol className="task-list">
                  {tasks.map((t) => (
                    <li key={t.text}>
                      <span>{t.text}</span>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={t.action}>
                        {x.go}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      </details>

      {/* 질문 기록 — 기본 접힘 */}
      <QaHistoryPanel />
    </PageScaffold>
  );
}
