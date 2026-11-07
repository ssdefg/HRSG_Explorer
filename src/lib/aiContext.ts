/**
 * AI 어시스턴트용 화면 데이터 스냅샷 — React와 무관한 순수 함수.
 *
 * 페이지 전체를 보내지 않는다. 화면별로 질문에 필요한 수치·상태만 라벨/값/단위 목록으로 골라
 * (최대 40항목) 서버로 보낸다. 서버(server/app.py ContextSnapshot)가 스키마·길이를 다시 검증하고
 * 문자열을 마스킹한 뒤 프롬프트에 '앱 계산값'으로만 넣는다. 고객사명·메모·이메일 초안 등 자유 텍스트는 넣지 않는다.
 */
import type { Lang, TabId } from '@/types';
import type { DerivedCalculator } from '@/lib/calculatorModel';
import type { MeasuredEntry, OperatingConditions } from '@/lib/caseStore';
import type { ProgressStats, Readiness } from '@/lib/checklistStats';
import type { ScenarioSelection } from '@/data/calculatorInputs';
import { SCENARIO_LABEL } from '@/data/calculatorInputs';
import { CHECKLIST_ITEMS } from '@/data/checklistItems';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';
import { roundTo } from '@/lib/calc';
import { assessConditionDeviation } from '@/lib/conditions';
import { buildActualPerformanceGap, buildCalcSummaryKpi, buildMethodPaybacks } from '@/lib/dashboardModel';
import type { ReceiptStatus } from '@/types';

export interface ContextItem {
  label: string;
  value: number | string | null;
  unit?: string;
}

export interface ContextSnapshot {
  id: string;
  page: TabId;
  title: string;
  createdAt: string;
  items: ContextItem[];
  /** 계산기 입력 키 — 이후 입력이 바뀌면 '이전 입력 기준' 표시 */
  inputsKey?: string;
}

/** 서버 스키마 한도 (server/app.py ContextSnapshot) */
export const CONTEXT_LIMITS = { items: 40, label: 80, text: 60, unit: 20, title: 80 } as const;

type L = Record<Lang, string>;
const T = (ko: string, en: string): L => ({ ko, en });

const num = (v: number | null | undefined, digits = 3): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? roundTo(v, digits) : null;

/** 한도에 맞춰 자르고 빈 값 정리 — 서버 검증에 걸리지 않게 클라이언트에서도 같은 규칙 적용 */
export function clampContext(items: ContextItem[]): ContextItem[] {
  return items.slice(0, CONTEXT_LIMITS.items).map((it) => ({
    label: it.label.slice(0, CONTEXT_LIMITS.label),
    value: typeof it.value === 'string' ? it.value.slice(0, CONTEXT_LIMITS.text) : it.value,
    ...(it.unit ? { unit: it.unit.slice(0, CONTEXT_LIMITS.unit) } : {}),
  }));
}

function snapshot(page: TabId, title: string, items: ContextItem[], now: Date, inputsKey?: string): ContextSnapshot {
  return {
    id: `ctx-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    page,
    title: title.slice(0, CONTEXT_LIMITS.title),
    createdAt: now.toISOString(),
    items: clampContext(items),
    inputsKey,
  };
}

export interface CalcContextInput {
  calc: DerivedCalculator;
  mode: 'demo' | 'user';
  scenario: ScenarioSelection;
  stale: boolean;
}

const LEVEL: Record<string, L> = { normal: T('정상', 'normal'), caution: T('주의', 'caution'), danger: T('위험', 'danger') };

function statusItems(c: CalcContextInput, lang: Lang): ContextItem[] {
  const items: ContextItem[] = [
    { label: T('평가 모드', 'Mode')[lang], value: c.mode === 'demo' ? T('DEMO 시나리오 (가상 데이터)', 'DEMO scenario (mock data)')[lang] : T('사용자 입력', 'User input')[lang] },
    { label: T('운전 시나리오', 'Scenario')[lang], value: SCENARIO_LABEL[c.mode === 'demo' ? c.scenario : 'custom'][lang] },
    { label: T('배압 자동 판별 (시연용 임계값)', 'Auto BP status (demo thresholds)')[lang], value: c.calc.level ? LEVEL[c.calc.level][lang] : null },
  ];
  if (c.stale) items.push({ label: T('계산 상태', 'Calculation state')[lang], value: T('재평가 필요 — 입력 변경 후 미계산', 'Re-evaluation needed')[lang] });
  return items;
}

/** 대시보드 — 운전 상태 · 배압 · 발전 손실 · 세정 필요도 · 데이터 준비율 */
export function buildDashboardContext(
  c: CalcContextInput,
  checklist: { summary: ProgressStats; readiness: Readiness },
  lang: Lang,
  now = new Date(),
): ContextSnapshot {
  const k = buildCalcSummaryKpi(c.calc);
  const r = checklist.readiness;
  return snapshot(
    'dashboard',
    T('대시보드 요약', 'Dashboard summary')[lang],
    [
      ...statusItems(c, lang),
      { label: T('현재 배압', 'Back pressure')[lang], value: num(k.backPressure, 1), unit: 'mmH₂O' },
      { label: T('기준 배압 대비 증감률', 'Change vs baseline')[lang], value: num(k.backPressureDeltaPct, 1), unit: '%' },
      { label: T('스택 온도', 'Stack temperature')[lang], value: num(k.stackTemp, 1), unit: '°C' },
      { label: T('발전 출력 손실 (예시 계산)', 'Power loss (example)')[lang], value: num(k.lossMW), unit: 'MW' },
      { label: T('월간 발전 손실액 (예시 계산)', 'Monthly loss (example)')[lang], value: num(k.lossMonthlyWon, 0), unit: T('원', 'KRW')[lang] },
      { label: T('세정 필요도 지수', 'Cleaning-need score')[lang], value: num(k.cleaningNeedScore, 1), unit: '/100' },
      { label: T('세정 시 예상 회수 효과', 'Expected recovery')[lang], value: num(k.recoveryBenefitPct, 2), unit: '%' },
      { label: T('데이터 수령률', 'Data receipt rate')[lang], value: num(checklist.summary.receivedPct, 1), unit: '%' },
      { label: T('필수 데이터 충족', 'Required data met')[lang], value: `${r.requiredTotal - r.missingIds.length}/${r.requiredTotal}` },
      { label: T('세정 필요성 판정', 'Cleaning-need verdict')[lang], value: r.evaluable ? T('평가 조건 충족', 'conditions met')[lang] : T('추가 검토 필요', 'further review needed')[lang] },
    ],
    now,
    c.calc.inputsKey,
  );
}

/** 계산기 — 입력 조건 · 계산 결과 · 경제성 · 핀치/어프로치 · 공법별 경제성 */
export function buildCalculatorContext(c: CalcContextInput, lang: Lang, now = new Date()): ContextSnapshot {
  const v = c.calc.values;
  const m = c.calc.metrics;
  const ok = (id: keyof typeof m) => (m[id].status === 'ok' ? m[id].value : null);
  const won = T('원', 'KRW')[lang];
  const methods = buildMethodPaybacks(c.calc).map((mp) => ({
    label: `${T('회수 기간', 'Payback')[lang]} · ${mp.method.name}`,
    value: num(mp.paybackMonths, 2),
    unit: T('개월', 'months')[lang],
  }));
  return snapshot(
    'calculator',
    T('계산기 입력 · 결과', 'Calculator inputs & results')[lang],
    [
      ...statusItems(c, lang),
      { label: T('정격 설비 용량', 'Capacity')[lang], value: num(v.capacityMw, 1), unit: 'MW' },
      { label: T('운전 부하율', 'Load factor')[lang], value: num(v.loadPct, 1), unit: '%' },
      { label: T('현재 배압', 'Back pressure')[lang], value: num(v.currentBp, 1), unit: 'mmH₂O' },
      { label: T('기준 배압', 'Baseline BP')[lang], value: num(v.referenceBp, 1), unit: 'mmH₂O' },
      { label: T('스택 온도', 'Stack temp.')[lang], value: num(v.exhaustTemp, 1), unit: '°C' },
      { label: T('HRSG 가스측 차압', 'HRSG gas-side ΔP')[lang], value: num(v.diffPressure, 1), unit: 'mbar' },
      { label: T('고압 드럼 압력', 'HP drum pressure')[lang], value: num(v.drumPressure, 1), unit: 'bar(g)' },
      { label: T('절탄기 출구 급수온도', 'Eco. outlet water')[lang], value: num(v.econOutletWaterTemp, 1), unit: '°C' },
      { label: T('증발기 출구 가스온도', 'Evap. outlet gas')[lang], value: num(v.evapOutletGasTemp, 1), unit: '°C' },
      { label: 'SMP', value: num(v.smp, 1), unit: T('원/kWh', 'KRW/kWh')[lang] },
      { label: T('목표 회수 출력', 'Target recovered output')[lang], value: num(v.recoveredPowerMw, 2), unit: 'MW' },
      { label: T('드라이아이스 세정비용', 'Dry-ice cleaning cost')[lang], value: num(v.cleaningCostKrw, 0), unit: won },
      { label: T('세정 정지 일수', 'Outage days')[lang], value: num(v.shutdownDays, 0), unit: T('일', 'd')[lang] },
      { label: T('초과 압력 (GT 배압·HRSG 차압 중 큰 값)', 'Excess pressure')[lang], value: num(ok('deltaBp'), 1), unit: 'mmH₂O' },
      { label: T('발전 출력 손실', 'Power loss')[lang], value: num(ok('powerLossMw')), unit: 'MW' },
      { label: T('세정 예상 회수 출력', 'Expected recovery')[lang], value: num(ok('recoveredMw')), unit: 'MW' },
      { label: T('기준 공법 (회수기간 최단, 추천 아님)', 'Basis method (shortest payback)')[lang], value: c.calc.cleaning.methodName },
      { label: T('월간 발전 손실액', 'Monthly loss')[lang], value: num(ok('monthlyLossKrw'), 0), unit: won },
      { label: T('정지 손실', 'Outage loss')[lang], value: num(ok('shutdownLossKrw'), 0), unit: won },
      { label: T('총투자', 'Total investment')[lang], value: num(ok('initialInvestmentKrw'), 0), unit: won },
      { label: T('월간 추가 편익', 'Monthly benefit')[lang], value: num(ok('monthlyIncrementalBenefitKrw'), 0), unit: won },
      { label: T('투자 회수기간', 'Payback')[lang], value: num(ok('paybackMonths'), 2), unit: T('개월', 'months')[lang] },
      { label: T('손익분기 (BEP)', 'Break-even')[lang], value: num(ok('breakEvenDays'), 1), unit: T('일', 'd')[lang] },
      { label: T('세정 필요도 지수', 'Cleaning-need score')[lang], value: num(ok('cleaningScore'), 1), unit: '/100' },
      { label: T('포화온도 Tsat (IF97)', 'Tsat (IF97)')[lang], value: num(c.calc.pinch.tSatC, 1), unit: '°C' },
      { label: `Pinch (${T('설계', 'design')[lang]} ${c.calc.pinch.design.pinch_c})`, value: num(c.calc.pinch.pinchC, 1), unit: '°C' },
      { label: `Approach (${T('설계', 'design')[lang]} ${c.calc.pinch.design.approach_c})`, value: num(c.calc.pinch.approachC, 1), unit: '°C' },
      { label: T('HP 핀치·어프로치 판정', 'HP pinch/approach')[lang], value: c.calc.pinch.message },
      ...methods,
    ],
    now,
    c.calc.inputsKey,
  );
}

/** 체크리스트 — 누락 데이터 · 필수 충족 · 검증 필요 항목 (항목명만, 측정값·메모·고객사명은 보내지 않음) */
export function buildChecklistContext(
  checklist: { summary: ProgressStats; readiness: Readiness; status: Record<string, ReceiptStatus> },
  lang: Lang,
  now = new Date(),
): ContextSnapshot {
  const r = checklist.readiness;
  const name = (id: string) => CHECKLIST_ITEMS.find((i) => i.id === id)?.name[lang] ?? id;
  const verify = CHECKLIST_ITEMS.filter((i) => checklist.status[i.id] === 'verify_needed').map((i) => i.id);
  return snapshot(
    'checklist',
    T('데이터 요청 체크리스트 현황', 'Data request checklist status')[lang],
    [
      { label: T('데이터 수령', 'Received')[lang], value: `${checklist.summary.receivedCount}/${checklist.summary.total}` },
      { label: T('검토 진행', 'Reviewed')[lang], value: `${checklist.summary.reviewedCount}/${checklist.summary.total}` },
      { label: T('필수 데이터 충족', 'Required data met')[lang], value: `${r.requiredTotal - r.missingIds.length}/${r.requiredTotal}` },
      { label: T('요청 필요 항목 수', 'Request-needed items')[lang], value: checklist.summary.byStatus.requested },
      ...r.missingIds.map((id) => ({ label: `${T('누락 필수 항목', 'Missing required')[lang]} ${id}`, value: name(id) })),
      ...verify.map((id) => ({ label: `${T('검증 필요 항목', 'Needs verification')[lang]} ${id}`, value: name(id) })),
    ],
    now,
  );
}

/** 세정 전후 — 비교값 · 회수 출력 · 누적 순편익 · 실측 · 운전 조건 편차 */
export function buildBeforeAfterContext(
  c: CalcContextInput,
  entries: MeasuredEntry[],
  conditions: OperatingConditions,
  lang: Lang,
  now = new Date(),
): ContextSnapshot {
  const m = c.calc.metrics;
  const ok = (id: keyof typeof m) => (m[id].status === 'ok' ? m[id].value : null);
  const s = VALIDATION_SCENARIO;
  const gap = buildActualPerformanceGap(entries, c.calc, ok('breakEvenDays'));
  const dev = assessConditionDeviation(conditions);
  const won = T('원', 'KRW')[lang];
  const items: ContextItem[] = [
    { label: T('세정 전 배압 (가상 시나리오)', 'BP before (mock scenario)')[lang], value: s.backPressure.before, unit: 'mmH₂O' },
    { label: T('세정 후 배압 (가상 시나리오)', 'BP after (mock scenario)')[lang], value: s.backPressure.after, unit: 'mmH₂O' },
    { label: T('세정 전 스택 온도 (가상)', 'Stack before (mock)')[lang], value: s.exhaustTemp.before, unit: '°C' },
    { label: T('세정 후 스택 온도 (가상)', 'Stack after (mock)')[lang], value: s.exhaustTemp.after, unit: '°C' },
    { label: T('회수 출력 (가정)', 'Recovered output (assumed)')[lang], value: num(c.calc.values.recoveredPowerMw, 2), unit: 'MW' },
    { label: T('초기 투자', 'Initial investment')[lang], value: num(ok('initialInvestmentKrw'), 0), unit: won },
    { label: T('일일 순증분 편익', 'Daily benefit')[lang], value: num(c.calc.cleaning.dailyIncrementalBenefitKrw, 0), unit: won },
    { label: T('손익분기 (누적 순편익 = 총 세정비용)', 'Break-even')[lang], value: num(ok('breakEvenDays'), 1), unit: T('일', 'd')[lang] },
    { label: T('실측 스냅샷 수', 'Measured entries')[lang], value: entries.length },
  ];
  if (entries.length) {
    items.push(
      { label: T('실측 D0 배압', 'Measured D0 BP')[lang], value: num(gap.d0BackPressure, 1), unit: 'mmH₂O' },
      { label: T('실측 최근 배압', 'Latest measured BP')[lang], value: num(gap.currentBackPressure, 1), unit: 'mmH₂O' },
      { label: T('실측 기준 회수 출력', 'Measured recovery')[lang], value: num(gap.actualRecoveryMW), unit: 'MW' },
      { label: T('손익분기 도달', 'Break-even reached')[lang], value: gap.bepAchieved === null ? null : gap.bepAchieved ? T('예', 'yes')[lang] : T('아니오', 'no')[lang] },
    );
  }
  if (dev.loadDiff !== null) items.push({ label: T('전후 부하율 편차', 'Load deviation')[lang], value: num(dev.loadDiff, 1), unit: '%p' });
  if (dev.ambientDiff !== null) items.push({ label: T('전후 외기온도 편차', 'Ambient deviation')[lang], value: num(dev.ambientDiff, 1), unit: '°C' });
  if (dev.exceeded) items.push({ label: T('운전 조건 편차 경고', 'Condition warning')[lang], value: T('편차 초과 — 세정 효과 단정 불가', 'exceeded — effect not conclusive')[lang] });
  return snapshot('validation', T('세정 전후 비교', 'Pre/post cleaning')[lang], items, now, c.calc.inputsKey);
}

/** 컨텍스트 값을 질문 근거 비교용 문자열로 (환각 가드에서 '근거 있음'으로 인정) */
export function contextToText(ctx: ContextSnapshot | undefined): string {
  if (!ctx) return '';
  return ctx.items.map((i) => `${i.label}: ${i.value ?? ''} ${i.unit ?? ''}`).join('\n');
}
