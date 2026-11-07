import type { DataType, Lang, TabId } from '@/types';
import type { QaAnswerId } from '@/data/qaPresets';
import type { AnalysisSnapshot, CalculatorState, ChecklistState, MeasurementState } from '@/context/Workspace';
import type { MetricId } from '@/lib/calculatorModel';
import { formatNumber } from '@/lib/format';
import { KIT_CALC_DATA } from '@/lib/kit';

/** 키트 손실 계수 문구 — 계수를 문자열로 하드코딩하지 않는다 */
const KC = KIT_CALC_DATA.constants;
const K = `${KC.gt_loss_pct_per_mbar} %/mbar (GT) · ${KC.st_loss_pct_per_c} %/°C (ST)`;
import { VALIDATION_SCENARIO } from '@/data/validationScenario';
import { REQUIRED_ITEM_IDS } from '@/data/checklistItems';
import { SCENARIO_LABEL } from '@/data/calculatorInputs';
import { SECTION_IDS } from '@/data/tabs';
import { STRINGS_CALC } from '@/i18n/calculatorStrings';
import { levelLabel } from '@/components/calculator/level';
import { METRIC_STATUS_TEXT } from '@/components/calculator/metricText';

/**
 * 사전 작성된 시연용 답변 — 구조: ① 핵심 요약 ② 계산기 연동 수치 ③ 공학적 근거 ④ 추가 필요 데이터 ⑤ 출처 ⑥ 관련 화면.
 * 문장은 일반적인 HRSG 개념 설명이며 기업 제공 문서나 특정 기술 가이드를 인용하지 않는다.
 * 숫자는 반드시 현재 케이스의 중앙 계산 엔진 결과(유효한 것만)에서 가져온다 — 별도 하드코딩 금지.
 */

export interface AnswerFact {
  label: string;
  /** 유효하지 않으면 '—' */
  value: string;
  types: DataType[];
  /** 산출 불가·모델 미연동 등 */
  status?: string;
}

export interface AnswerNeed {
  /** 체크리스트 항목 id — 수령 상태 배지와 이동 버튼을 붙인다 */
  itemId: string;
}

export type SourceKind = 'unregistered' | 'general' | 'calcInputs' | 'engine' | 'cleaningMock' | 'checklist' | 'scenario' | 'snapshot';

export interface AnswerLink {
  tab: TabId;
  section?: string;
  label?: string;
}

export interface AnswerContent {
  summary: string[];
  facts: AnswerFact[];
  factsCaption?: string;
  /** 수치를 인용하지 않은 이유 */
  factsNotice?: string;
  basis: string[];
  needs: AnswerNeed[];
  sources: SourceKind[];
  links: AnswerLink[];
}

export interface AnswerContext {
  lang: Lang;
  calc: CalculatorState;
  checklist: ChecklistState;
  measurements: MeasurementState;
  snapshot?: AnalysisSnapshot;
}

const need = (...ids: string[]): AnswerNeed[] => ids.map((itemId) => ({ itemId }));

/** 중앙 계산 엔진 결과 → 인용용 사실. 유효하지 않으면 숫자 없이 상태만. */
function metricFact(ctx: AnswerContext, id: MetricId, label: string, unit: string, digits: number): AnswerFact {
  const m = ctx.calc.metrics[id];
  if (m.status === 'ok' && m.value !== null) {
    return { label, value: `${formatNumber(m.value, ctx.lang, digits)} ${unit}`.trim(), types: ['example'] };
  }
  return {
    label,
    value: '—',
    types: m.status === 'model' ? ['planned'] : ['example'],
    status: METRIC_STATUS_TEXT[ctx.lang][m.status === 'model' ? 'model' : 'invalid'],
  };
}

function inputFact(ctx: AnswerContext, label: string, v: number | null, unit: string, digits = 0): AnswerFact {
  return v === null
    ? { label, value: '—', types: ['mock'], status: METRIC_STATUS_TEXT[ctx.lang].invalid }
    : { label, value: `${formatNumber(v, ctx.lang, digits)} ${unit}`.trim(), types: [ctx.calc.mode === 'user' ? 'userInput' : 'mock'] };
}

function caption(ctx: AnswerContext): string {
  const ko = ctx.lang === 'ko';
  const sc = SCENARIO_LABEL[ctx.calc.mode === 'demo' ? ctx.calc.scenario : 'custom'][ctx.lang];
  const mode = ctx.calc.mode === 'demo' ? (ko ? 'DEMO 시나리오' : 'DEMO scenario') : ko ? '사용자 입력' : 'user input';
  return ko
    ? `현재 케이스 최신 유효 결과 · ${ctx.calc.model} · ${mode} · ${sc} (중앙 계산 엔진, 예시 계산)`
    : `Latest valid result of the current case · ${ctx.calc.model} · ${mode} · ${sc} (central engine, example calc)`;
}

function bpFacts(ctx: AnswerContext): AnswerFact[] {
  const c = STRINGS_CALC[ctx.lang];
  const ko = ctx.lang === 'ko';
  const lvl = ctx.calc.level;
  return [
    inputFact(ctx, c.kpiCurrentBp, ctx.calc.values.currentBp, 'mmH₂O'),
    inputFact(ctx, c.gaugeReference, ctx.calc.values.referenceBp, 'mmH₂O'),
    metricFact(ctx, 'deltaBp', c.stepDelta, 'mmH₂O', 0),
    metricFact(ctx, 'powerLossMw', c.stepPower, 'MW', 2),
    metricFact(ctx, 'monthlyLossKrw', c.stepMonthly, ko ? '원' : 'KRW', 0),
    {
      label: ko ? '시연용 임계값 상태' : 'Demo-threshold status',
      value: lvl ? levelLabel(lvl, c) : '—',
      types: ['unconfirmed'],
      status: lvl ? undefined : METRIC_STATUS_TEXT[ctx.lang].invalid,
    },
  ];
}

function cleaningFacts(ctx: AnswerContext): AnswerFact[] {
  const ko = ctx.lang === 'ko';
  const won = ko ? '원' : 'KRW';
  return [
    inputFact(ctx, ko ? '회수 출력 (가정)' : 'Recovered output (assumed)', ctx.calc.values.recoveredPowerMw, 'MW', 2),
    metricFact(ctx, 'monthlyIncrementalBenefitKrw', ko ? '월간 추가 편익' : 'Monthly added benefit', won, 0),
    metricFact(ctx, 'initialInvestmentKrw', ko ? '초기 투자' : 'Initial investment', won, 0),
    metricFact(ctx, 'netBenefitKrw', ko ? '세정 순편익 (첫 1개월)' : 'Net benefit (first month)', won, 0),
    metricFact(ctx, 'paybackMonths', ko ? '단순 회수 기간' : 'Simple payback', ko ? '개월' : 'months', 2),
    metricFact(ctx, 'breakEvenDays', ko ? '손익분기' : 'Break-even', ko ? '일' : 'd', 1),
  ];
}

export function buildAnswer(id: QaAnswerId, ctx: AnswerContext): AnswerContent {
  const { lang, checklist } = ctx;
  const T = (ko: string, en: string) => (lang === 'ko' ? ko : en);
  const won = T('원', 'KRW');

  switch (id) {
    /* ---------------- 열역학·성능 영향 ---------------- */
    case 'bpImpact':
      return {
        summary: [
          T(
            '배압(HRSG 가스측 압력손실)이 증가하면 가스터빈 출구의 배기 압력이 높아져 일반적으로 가스터빈 출력과 효율이 낮아지는 방향으로 작용합니다. 다만 배압 하나만으로 세정이 반드시 필요하다고 판단할 수는 없습니다.',
            'Higher HRSG back pressure raises the gas-turbine exhaust pressure, which generally pushes GT output and efficiency down. Back pressure alone, however, cannot establish that cleaning is required.',
          ),
        ],
        facts: bpFacts(ctx),
        factsCaption: caption(ctx),
        basis: [
          T('가스터빈은 출구 압력이 높을수록 팽창비가 줄어 같은 연료로 낼 수 있는 출력이 감소하는 경향이 있습니다.', 'A higher turbine exit pressure reduces the expansion ratio, so output for the same fuel tends to drop.'),
          T('튜브 표면 파울링은 가스 흐름 저항을 키우는 동시에 열전달을 떨어뜨려, 배기가스 출구 온도 상승이나 증기 생산량 감소로 함께 나타날 수 있습니다.', 'Tube fouling increases flow resistance and reduces heat transfer, so it can also show as higher stack temperature or lower steam output.'),
          T(`이 프로토타입의 손실 수치는 키트의 임시 계수(${K})를 쓴 예시 계산이며 실제 발전 손실이 아닙니다. 영향 크기는 설비 설계·부하·대기 조건에 따라 달라집니다.`, `Loss figures here use the kit's provisional coefficients (${K}) (example calc), not actual losses. Magnitude depends on design, load and ambient conditions.`),
        ],
        needs: need('A-02', 'A-03', 'A-01', 'B-01', 'C-01'),
        sources: ['unregistered', 'general', 'calcInputs', 'engine'],
        links: [{ tab: 'calculator' }, { tab: 'checklist' }],
      };

    case 'dpCause':
      return {
        summary: [
          T(
            'HRSG 가스측 차압(ΔP)은 일반적으로 튜브·핀 표면의 부착물(파울링), 가스 유량 증가, 부분 막힘 등으로 상승할 수 있습니다. 차압은 배압과 관련되지만 서로 다른 측정값이므로 구분해서 봐야 합니다.',
            'HRSG gas-side ΔP can generally rise from deposits on tubes/fins (fouling), higher gas flow, or partial blockage. ΔP relates to back pressure but is a different measurement and should be read separately.',
          ),
        ],
        facts: [
          inputFact(ctx, T('HRSG 가스측 차압 ΔP (입력값)', 'HRSG gas-side ΔP (input)'), ctx.calc.values.diffPressure, 'mbar', 1),
          inputFact(ctx, STRINGS_CALC[lang].kpiCurrentBp, ctx.calc.values.currentBp, 'mmH₂O'),
        ],
        factsCaption: caption(ctx),
        basis: [
          T('같은 부하에서도 가스 유량이 커지면 압력손실은 증가하므로, 차압 추세는 부하·유량 보정 후 비교해야 합니다.', 'Pressure loss rises with gas flow even at the same load, so ΔP trends should be compared after load/flow correction.'),
          T('파울링 여부는 차압 단독이 아니라 배기가스 온도, 증기 생산량, 정비 이력과 함께 판단합니다.', 'Fouling should be judged with stack temperature, steam production and maintenance history, not ΔP alone.'),
          T('이 프로토타입에는 차압으로 손실을 계산하는 모델이 없습니다 — 차압은 표시·기록용 입력입니다.', 'This prototype has no model that converts ΔP into loss — ΔP is a display/record input.'),
        ],
        needs: need('A-02', 'A-03', 'A-04', 'C-02', 'C-08'),
        sources: ['unregistered', 'general', 'calcInputs'],
        links: [{ tab: 'calculator' }, { tab: 'checklist' }],
      };

    case 'stackTemp':
      return {
        summary: [
          T(
            '스택(배기가스 출구) 온도가 같은 부하에서 상승한다면 HRSG가 배기가스 열을 덜 회수하고 있을 가능성을 의미할 수 있습니다. 파울링 외에도 부하·대기 조건·운전 모드 변화의 영향을 받습니다.',
            'A rising stack temperature at the same load can indicate that the HRSG is recovering less heat. Besides fouling, load, ambient and operating-mode changes also affect it.',
          ),
        ],
        facts: [
          inputFact(ctx, T('배기가스 출구(스택) 온도', 'Stack gas outlet temp.'), ctx.calc.values.exhaustTemp, '°C'),
          inputFact(ctx, T('가스터빈 부하율', 'GT load'), ctx.calc.values.loadPct, '%'),
          {
            label: T('세정 전후 시나리오 (가상)', 'Pre/post scenario (mock)'),
            value: `${VALIDATION_SCENARIO.exhaustTemp.before} → ${VALIDATION_SCENARIO.exhaustTemp.after} °C`,
            types: ['scenario'],
          },
        ],
        factsCaption: caption(ctx),
        basis: [
          T('전열면 오염은 열전달 계수를 낮춰 같은 가스 유량에서 출구 온도를 높이는 방향으로 작용합니다.', 'Fouled surfaces lower the heat-transfer coefficient, raising the outlet temperature for the same gas flow.'),
          T('온도 비교는 부하·대기 온도가 비슷한 구간끼리 해야 하며, 계측 위치도 확인해야 합니다.', 'Compare temperatures only across periods with similar load and ambient temperature, and confirm sensor location.'),
        ],
        needs: need('B-06', 'B-01', 'A-04', 'C-01'),
        sources: ['unregistered', 'general', 'calcInputs', 'scenario'],
        links: [{ tab: 'validation', section: SECTION_IDS.validation, label: T('세정 전후 상세 분석', 'Pre/post analysis') }, { tab: 'checklist' }],
      };

    case 'foulingImpact':
      return {
        summary: [
          T(
            'HRSG 오염(파울링)은 일반적으로 ① 열전달 저하로 증기 생산량 감소·스택 온도 상승, ② 가스측 압력손실 증가로 배압 상승이라는 두 경로로 성능에 영향을 줄 수 있습니다.',
            'HRSG fouling generally affects performance through two paths: (1) reduced heat transfer — lower steam output, higher stack temperature; (2) higher gas-side pressure loss — higher back pressure.',
          ),
        ],
        facts: [...bpFacts(ctx).slice(0, 3), inputFact(ctx, T('배기가스 출구(스택) 온도', 'Stack gas outlet temp.'), ctx.calc.values.exhaustTemp, '°C')],
        factsCaption: caption(ctx),
        basis: [
          T('두 경로의 기여도는 부착물 성상과 위치(섹션)에 따라 다르며, 이 프로토타입은 이를 분리해 계산하지 않습니다.', 'The share of each path depends on deposit type and location; this prototype does not separate them.'),
          T('세정 효과는 세정 전후를 같은 조건에서 비교해야 확인할 수 있습니다.', 'Cleaning effect can only be confirmed by comparing pre/post periods under the same conditions.'),
        ],
        needs: need('A-02', 'B-06', 'C-01', 'B-01', 'C-02'),
        sources: ['unregistered', 'general', 'calcInputs'],
        links: [{ tab: 'calculator' }, { tab: 'checklist' }],
      };

    /* ---------------- 세정 공법 및 경제성 ---------------- */
    case 'methodCompare':
      return {
        summary: [
          T(
            '드라이아이스 세정은 CO₂ 펠릿을 분사해 부착물을 떼어내며 매체가 승화해 2차 폐수가 거의 없는 것이 일반적 특징입니다. 고압수 세정은 물 분사로 제거해 폐수 처리·건조·부식 검토가 필요할 수 있고, 화학(약품) 세정은 약품으로 부착물을 녹이는 방식이라 약품 선정과 중화·폐액 처리가 필요합니다.',
            'Dry-ice blasting uses CO₂ pellets that sublimate, typically leaving little secondary wastewater. High-pressure water may need wastewater handling, drying and corrosion review. Chemical cleaning dissolves deposits and requires agent selection plus neutralization/waste handling.',
          ),
          T('효과와 적합성은 부착물 성상, 튜브·핀 접근성, 작업·정지 시간에 따라 달라지므로 어느 공법이 우월하다고 단정할 수 없습니다.', 'Effectiveness depends on deposit type, access and work/outage time, so no method can be declared superior.'),
        ],
        // 계산기 공법 비교와 같은 키트 compareMethods 결과 (드라이아이스 = 화면 입력, 나머지 = 키트 데이터)
        facts: ctx.calc.kit.methods.map((m) => ({
          label: `${m.name} · ${T('총투자 / 월간 편익', 'investment / monthly benefit')}`,
          value: m.available
            ? `${formatNumber(m.total_investment_krw ?? 0, lang, 0)} / ${formatNumber(m.monthly_benefit_krw ?? 0, lang, 0)} ${won}`
            : (m.message ?? '—'),
          types: ['mock', 'example'] as DataType[],
        })),
        factsCaption: T('계산기 세정 공법 비교와 같은 키트 DEMO 데이터 — 실제 견적 아님', 'Same kit DEMO data as the calculator comparison — not real quotes'),
        basis: [
          T('공법별 비교는 같은 오염 상태·같은 범위의 작업을 전제로 해야 의미가 있습니다.', 'Comparisons are meaningful only for the same fouling state and work scope.'),
          T('업체명·상표명이 아닌 일반 공법 명칭으로만 비교합니다.', 'Only generic method names are used, not vendor or brand names.'),
        ],
        needs: need('C-02', 'C-05', 'C-03'),
        sources: ['unregistered', 'general', 'cleaningMock'],
        links: [{ tab: 'calculator' }],
      };

    case 'costBasis':
      return {
        summary: [
          T(
            '공법별 비용은 같은 기준으로 맞춰 비교해야 합니다: 세정 작업비뿐 아니라 정지 손실·추가 비용(폐수·약품 처리 등)을 초기 투자로 합치고, 회수 출력에 따른 월간 순증분 편익으로 나눠 회수 기간을 봅니다.',
            'Compare costs on a common basis: combine cleaning cost, shutdown loss and additional costs (e.g., waste handling) as the initial investment, and divide by the monthly incremental benefit from recovered output.',
          ),
        ],
        facts: cleaningFacts(ctx),
        factsCaption: caption(ctx),
        basis: [
          T('일회성 비용은 초기 투자에만 넣고 월간 편익에서 다시 빼지 않아야 이중 반영을 막을 수 있습니다.', 'Put one-off costs only into the initial investment, not again into monthly benefit, to avoid double counting.'),
          T('정지 시간은 유효 가동시간에서 빠지고(회수 출력 없음), 정지 손실은 기저 출력의 기회비용으로 한 번만 반영합니다.', 'Shutdown time is excluded from effective hours (no recovered output); shutdown loss is counted once as the base-output opportunity cost.'),
          T('회수 출력은 입력 가정값이며 배압 기반 손실 추정치와 같은 값으로 취급하지 않습니다.', 'Recovered output is an input assumption, not treated as the BP-based loss estimate.'),
        ],
        needs: need('C-05', 'C-03', 'C-02', 'C-07'),
        sources: ['unregistered', 'calcInputs', 'engine', 'cleaningMock'],
        links: [{ tab: 'calculator', section: SECTION_IDS.economics, label: T('계산 결과 (경제성)', 'Calculation result (economics)') }],
      };

    case 'econData':
      return {
        summary: [
          T(
            '세정 경제성을 판단하려면 회수 출력의 근거(세정 전후 실측), SMP, 가동시간, 세정 비용, 정지일수·정지 손실, 추가 비용이 필요합니다. 현재 값은 모두 가상 데이터 또는 가정값입니다.',
            'Judging cleaning economics needs a basis for recovered output (pre/post measurements), SMP, operating hours, cleaning cost, shutdown days/loss and additional costs. Current values are all mock data or assumptions.',
          ),
        ],
        facts: cleaningFacts(ctx),
        factsCaption: caption(ctx),
        basis: [T('회수 출력이 실측으로 확인되지 않으면 순편익과 회수 기간도 예시 계산에 머뭅니다.', 'Without measured recovered output, net benefit and payback remain example calculations.')],
        needs: need('C-05', 'C-03', 'A-05', 'A-01', 'C-02', 'C-01'),
        sources: ['unregistered', 'calcInputs', 'engine'],
        links: [{ tab: 'calculator', section: SECTION_IDS.economics, label: T('계산 결과 (경제성)', 'Calculation result (economics)') }, { tab: 'checklist' }],
      };

    /* ---------------- 핀치/어프로치 ---------------- */
    case 'pinchDef':
    case 'approachDef':
    case 'pinchData': {
      const v = ctx.calc.values;
      const lead =
        id === 'pinchDef'
          ? T('핀치 포인트는 일반적으로 증발기 출구의 배기가스 온도와 드럼 압력에서의 포화온도 차이를 말하며, 증발기에서 회수할 수 있는 열량과 관련됩니다.', 'The pinch point generally means the difference between the evaporator outlet gas temperature and the saturation temperature at drum pressure; it relates to recoverable heat in the evaporator.')
          : id === 'approachDef'
            ? T('어프로치 포인트는 일반적으로 드럼 압력에서의 포화온도와 절탄기 출구 급수 온도의 차이를 말하며, 절탄기 내부 증발(steaming)을 피하기 위한 여유와 관련됩니다.', 'The approach point generally means the difference between the saturation temperature at drum pressure and the economizer outlet water temperature; it relates to the margin that avoids steaming in the economizer.')
            : T('핀치/어프로치 검토에는 설계 기준값, 포화온도 산정 기준(물성 기준), 섹션별 온도 실측, 가스 유량·부하 조건, 계측 위치 정보가 필요합니다.', 'Pinch/approach review needs design criteria, a saturation-temperature (property) basis, measured section temperatures, gas flow/load conditions and instrument locations.');
      return {
        summary: [lead, T('이 프로토타입은 물성 기준과 설계값이 확정되지 않아 두 값을 계산하지 않습니다 — "분석 대기" 상태입니다.', 'This prototype does not compute either value because the property basis and design values are not confirmed — "analysis pending".')],
        facts: [
          inputFact(ctx, T('드럼 압력', 'Drum pressure'), v.drumPressure, 'bar'),
          inputFact(ctx, T('절탄기 출구 급수 온도', 'Economizer outlet water temp.'), v.econOutletWaterTemp, '°C'),
          inputFact(ctx, T('증발기 출구 가스 온도', 'Evaporator outlet gas temp.'), v.evapOutletGasTemp, '°C'),
          { label: T('분석 상태', 'Analysis status'), value: T('분석 대기', 'Pending'), types: ['unconfirmed'], status: STRINGS_CALC[lang].pinchWaiting },
        ],
        factsCaption: caption(ctx),
        basis: [
          T('포화온도는 드럼 압력으로부터 증기표 등 물성 기준으로 구해야 하며, 기준 버전과 보정 방법을 먼저 정해야 합니다.', 'Saturation temperature must come from drum pressure via a property basis (e.g., steam tables); the version and corrections must be agreed first.'),
          T('설계값과 비교하려면 제작사 설계 기준이 필요합니다.', 'Comparison to design requires the OEM design basis.'),
        ],
        needs: need('B-07', 'B-08', 'B-02', 'B-05', 'B-06'),
        sources: ['unregistered', 'general', 'calcInputs'],
        links: [{ tab: 'calculator' }, { tab: 'checklist' }],
      };
    }

    /* ---------------- 필요 데이터 가이드 ---------------- */
    case 'cleaningNeedData': {
      const r = checklist.readiness;
      const got = r.requiredTotal - r.missingIds.length;
      return {
        summary: [
          T(
            `세정 필요성은 단일 지표가 아니라 여러 데이터를 함께 보고 판단합니다. 현재 필수 데이터 ${r.requiredTotal}개 중 ${got}개가 수령 완료이며, ${r.evaluable ? '평가 가능 조건을 충족했습니다.' : '평가 가능 조건을 충족하지 못해 "추가 검토 필요" 상태입니다.'}`,
            `Cleaning necessity is judged from several data sources together. ${got} of ${r.requiredTotal} required items are received; ${r.evaluable ? 'evaluation conditions are met.' : 'conditions are not met — "further review needed".'}`,
          ),
        ],
        facts: [
          { label: T('필수 데이터 수령', 'Required data received'), value: `${got} / ${r.requiredTotal}`, types: r.missingIds.length ? ['noMeasured'] : [] },
          { label: T('데이터 수령률 (전체)', 'Receipt rate (all)'), value: `${formatNumber(checklist.summary.receivedPct, lang, 0)}%`, types: [] },
          { label: T('검토 진행률 (전체)', 'Review progress (all)'), value: `${formatNumber(checklist.summary.reviewPct, lang, 0)}%`, types: [] },
          ...bpFacts(ctx).slice(-1),
        ],
        factsCaption: T('현재 케이스의 체크리스트·계산기 상태', 'Current case checklist & calculator state'),
        basis: [T('배압·차압·스택 온도 추세를 부하로 보정하고 설계 기준·세정 이력과 비교해야 합니다.', 'Load-correct BP, ΔP and stack temperature trends and compare with design basis and cleaning history.')],
        needs: need(...REQUIRED_ITEM_IDS),
        sources: ['unregistered', 'checklist', 'calcInputs'],
        links: [{ tab: 'checklist' }, { tab: 'dashboard' }],
      };
    }

    case 'checklistUse':
      return {
        summary: [
          T(
            '체크리스트는 데이터 수급 상태(실측 데이터 미입력·요청 필요·수령 완료·검증 필요)와 팀의 검토 여부(체크박스)를 따로 관리합니다. "요청 필요"로 지정한 항목은 자료 요청 이메일 초안에 자동으로 모입니다.',
            'The checklist tracks data receipt status (no measured data / request needed / received / needs verification) separately from team review (checkbox). Items marked "request needed" are gathered into the request email draft.',
          ),
        ],
        facts: [
          { label: T('데이터 수령률', 'Receipt rate'), value: `${checklist.summary.receivedCount} / ${checklist.summary.total} (${formatNumber(checklist.summary.receivedPct, lang, 0)}%)`, types: [] },
          { label: T('검토 진행률', 'Review progress'), value: `${checklist.summary.reviewedCount} / ${checklist.summary.total} (${formatNumber(checklist.summary.reviewPct, lang, 0)}%)`, types: [] },
          { label: T('요청 필요 항목', 'Request-needed items'), value: String(checklist.summary.byStatus.requested), types: [] },
        ],
        factsCaption: T('현재 케이스 체크리스트', 'Current case checklist'),
        basis: [
          T('검토 체크는 수령 완료를 뜻하지 않으며, 수령 완료도 검토 완료를 뜻하지 않습니다.', 'A review check does not mean received, and received does not mean reviewed.'),
          T('"검증 필요"는 수령 후 검증 대기 상태로, 수령률에는 포함되지만 필수 데이터 충족에는 포함되지 않습니다.', '"Needs verification" is post-receipt; it counts toward receipt rate but not toward required-data fulfilment.'),
        ],
        needs: [],
        sources: ['unregistered', 'checklist'],
        links: [{ tab: 'checklist' }],
      };

    case 'missingData': {
      const r = checklist.readiness;
      return {
        summary: [
          r.missingIds.length === 0
            ? T('필수 데이터는 모두 수령 완료 상태입니다. 검토 체크 여부와 검증 상태를 확인하세요.', 'All required data is received. Check review status and verification.')
            : T(`필수 데이터 ${r.missingIds.length}개가 아직 수령 완료가 아닙니다. 아래 항목을 체크리스트에서 확인하세요.`, `${r.missingIds.length} required items are not yet received. Check them in the checklist below.`),
        ],
        facts: [
          { label: T('부족 필수 데이터', 'Missing required data'), value: String(r.missingIds.length), types: r.missingIds.length ? ['noMeasured'] : [] },
          { label: T('검토 안 된 필수 항목', 'Unreviewed required items'), value: String(r.unreviewedIds.length), types: [] },
          { label: T('평가 가능 여부', 'Evaluable'), value: r.evaluable ? T('평가 가능', 'Evaluable') : T('추가 검토 필요', 'Further review needed'), types: [] },
        ],
        factsCaption: T('현재 케이스 체크리스트 (필수 = 우선순위 높음 항목, 시연용 정의)', 'Current case checklist (required = high-priority items, demo definition)'),
        basis: [T('필수 데이터 충족 = 필수 항목이 모두 "수령 완료"이며, 평가 가능 = 그 항목들이 모두 검토된 상태입니다.', 'Required met = all required items "received"; evaluable = those items are also reviewed.')],
        needs: need(...r.missingIds),
        sources: ['unregistered', 'checklist'],
        links: [{ tab: 'checklist' }],
      };
    }

    case 'validationData': {
      const count = ctx.measurements.entries.length;
      return {
        summary: [
          T(
            '세정 효과를 검증하려면 세정 전후를 가능한 한 같은 운전 조건(부하, 대기 온도)에서 비교해야 합니다. 조건이 다르면 개선량이 과대·과소 평가될 수 있습니다.',
            'To validate cleaning, compare pre/post periods under conditions as similar as possible (load, ambient). Otherwise improvement can be over- or under-estimated.',
          ),
        ],
        facts: [
          {
            label: T('배압 (전 → 후, 가상 시나리오)', 'Back pressure (pre → post, mock)'),
            value: `${VALIDATION_SCENARIO.backPressure.before} → ${VALIDATION_SCENARIO.backPressure.after} mmH₂O`,
            types: ['scenario'],
          },
          metricFact(ctx, 'breakEvenDays', T('손익분기 (계산기 입력 기준)', 'Break-even (from calculator inputs)'), T('일', 'd'), 1),
          { label: T('입력된 실측 스냅샷', 'Measured snapshots entered'), value: String(count), types: count ? ['measured'] : ['noMeasured'] },
        ],
        factsCaption: caption(ctx),
        basis: [
          T(
            `세정 전 ${VALIDATION_SCENARIO.daysBefore}일 이상·후 ${VALIDATION_SCENARIO.daysAfter}일 이상의 운전 시계열이 있어야 재오염 추세까지 확인할 수 있습니다.`,
            `≥${VALIDATION_SCENARIO.daysBefore} days pre and ≥${VALIDATION_SCENARIO.daysAfter} days post time series are needed to see re-fouling trends.`,
          ),
        ],
        needs: need('C-01', 'B-01', 'A-04', 'A-02', 'B-06', 'C-05', 'C-03'),
        sources: ['unregistered', 'scenario', 'engine'],
        links: [{ tab: 'validation', section: SECTION_IDS.validation, label: T('세정 전후 상세 분석', 'Pre/post analysis') }, { tab: 'checklist' }],
      };
    }

    /* ---------------- 계산기 결과 스냅샷 해설 ---------------- */
    case 'resultSummary': {
      const snap = ctx.snapshot;
      const r = checklist.readiness;
      if (!snap) {
        return {
          summary: [T('참조할 계산 결과 스냅샷이 없습니다.', 'No calculation snapshot to reference.')],
          facts: [],
          factsNotice: T('계산 결과가 없어 수치를 표시하지 않습니다.', 'No figures shown because there is no result.'),
          basis: [],
          needs: [],
          sources: ['unregistered'],
          links: [{ tab: 'calculator' }],
        };
      }
      // 스냅샷 이후 입력이 바뀌었으면 그 수치를 현재 결과처럼 인용하지 않는다
      const stale = snap.inputsKey !== ctx.calc.inputsKey;
      const fmt = (val: number | null, d: number, unit: string) => (val === null ? '—' : `${formatNumber(val, lang, d)} ${unit}`.trim());
      const heldStatus = snap.mode === 'user' ? METRIC_STATUS_TEXT[lang].model : METRIC_STATUS_TEXT[lang].invalid;
      const c = STRINGS_CALC[lang];
      const facts: AnswerFact[] = stale
        ? []
        : [
            { label: c.stepDelta, value: fmt(snap.bp.deltaBp, 0, 'mmH₂O'), types: ['example'] },
            {
              label: c.stepPower,
              value: fmt(snap.bp.powerLossMw, 2, 'MW'),
              types: snap.bp.powerLossMw === null ? ['planned'] : ['example'],
              status: snap.bp.powerLossMw === null ? heldStatus : undefined,
            },
            {
              label: c.stepMonthly,
              value: fmt(snap.bp.monthlyLossKrw, 0, won),
              types: snap.bp.monthlyLossKrw === null ? ['planned'] : ['example'],
              status: snap.bp.monthlyLossKrw === null ? heldStatus : undefined,
            },
            { label: T('월간 추가 편익', 'Monthly added benefit'), value: fmt(snap.cleaning.monthlyIncrementalBenefitKrw, 0, won), types: ['example'] },
            { label: T('세정 순편익 (첫 1개월)', 'Net benefit (first month)'), value: fmt(snap.cleaning.netBenefitKrw, 0, won), types: ['example'] },
            {
              label: T('단순 회수 기간', 'Simple payback'),
              value: fmt(snap.cleaning.paybackMonths, 2, T('개월', 'months')),
              types: ['example'],
              status: snap.cleaning.paybackMonths === null ? T('회수 불가', 'No payback') : undefined,
            },
            { label: T('손익분기', 'Break-even'), value: fmt(snap.cleaning.breakEvenDays, 1, T('일', 'd')), types: ['example'] },
          ];
      const when = new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(snap.createdAt));
      const elevated = snap.bp.level === 'danger' || snap.bp.level === 'caution';
      return {
        summary: [
          T(
            `계산 결과 스냅샷 #${snap.seq}(${snap.model}, ${when})은 ${snap.mode === 'demo' ? 'DEMO 시나리오' : '사용자 입력'}의 예시 계산입니다. 출력 손실은 키트 임시 계수(${K})를 쓴 값이고, 회수 출력·순편익은 입력 가정값에 따른 산술 결과로 실제 설비 평가 결과가 아닙니다.`,
            `Snapshot #${snap.seq} (${snap.model}, ${when}) is an example calculation in ${snap.mode === 'demo' ? 'DEMO scenario' : 'user-input'} mode. power loss uses the kit's provisional coefficients (${K}); recovered output and net benefit are arithmetic on input assumptions — not an actual plant evaluation.`,
          ),
          elevated
            ? T('키트 지표(GT 배압·HRSG 차압·스택 온도) 중 주의 이상 구간이 있지만, 이것만으로 세정이 필요하다고 확정하지 않습니다.', 'A kit indicator (GT BP, HRSG ΔP or stack) is in a caution band or worse, but this alone does not confirm cleaning is needed.')
            : T('키트 지표가 모두 정상 구간입니다. 이 역시 세정 불필요를 확정하지 않습니다.', 'All kit indicators are in the normal band; this does not confirm cleaning is unnecessary either.'),
        ],
        facts,
        factsCaption: stale ? undefined : T(`스냅샷 #${snap.seq} 기준 (현재 입력과 동일)`, `Snapshot #${snap.seq} (matches current inputs)`),
        factsNotice: stale
          ? T(
              '스냅샷 이후 입력값이 변경되어 이 스냅샷의 수치를 현재 결과로 인용하지 않습니다. 계산기에서 "이 결과 질문하기"를 다시 눌러 주세요.',
              'Inputs changed after this snapshot, so its figures are not quoted as the current result. Press "Ask about this result" again in the calculator.',
            )
          : undefined,
        basis: [
          T('사용자 입력 모드에서는 검증되지 않은 배압→손실 모델을 쓰지 않으므로 해당 항목이 "모델 미연동"으로 보류됩니다.', 'In user-input mode the unverified BP→loss model is not used, so those items are held as "model not connected".'),
          T(
            `필수 데이터 ${r.requiredTotal}개 중 ${r.missingIds.length}개가 미수령이라 ${r.evaluable ? '평가 조건은 충족' : '"추가 검토 필요"'} 상태입니다.`,
            `${r.missingIds.length} of ${r.requiredTotal} required items are not received — ${r.evaluable ? 'conditions met' : '"further review needed"'}.`,
          ),
        ],
        needs: need(...r.missingIds.slice(0, 6)),
        sources: ['unregistered', 'snapshot', 'engine', 'checklist'],
        links: [{ tab: 'calculator', section: SECTION_IDS.economics, label: T('계산 결과', 'Calculation result') }, { tab: 'checklist' }],
      };
    }
  }
}
