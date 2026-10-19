import type { DataType, Lang, TabId } from '@/types';
import type { QaAnswerId } from '@/data/qaPresets';
import type { CalculatorState } from '@/lib/useCalculatorState';
import type { ChecklistState, MeasurementState } from '@/context/Workspace';
import { formatNumber } from '@/lib/format';
import { POWER_LOSS_COEFF_MW_PER_MMH2O, calcBreakEvenDays, calcSimplePaybackMonths } from '@/lib/calc';
import { MOCK_CLEANING_METHODS } from '@/data/mockCleaning';
import { VALIDATION_SCENARIO } from '@/data/validationScenario';
import { STRINGS_CALC } from '@/i18n/calculatorStrings';
import { levelLabel } from '@/components/calculator/level';

/**
 * 사전 작성된 시연용 답변.
 * 문장은 일반적인 HRSG 개념 설명이며, 기업 제공 문서나 특정 기술 가이드를 인용하지 않는다.
 * 숫자는 반드시 공유 상태(계산기·체크리스트·측정값)와 중앙 계산 엔진에서 가져온다 — 별도 하드코딩 금지.
 */

export interface AnswerFact {
  label: string;
  value: string;
  types: DataType[];
}

export type SourceKind = 'general' | 'calcInputs' | 'engine' | 'cleaningMock' | 'checklist' | 'scenario';

export interface AnswerContent {
  paragraphs: string[];
  facts: AnswerFact[];
  factsCaption?: string;
  needs: string[];
  links: TabId[];
  sources: SourceKind[];
}

export interface AnswerContext {
  lang: Lang;
  calc: CalculatorState;
  checklist: ChecklistState;
  measurements: MeasurementState;
}

export function buildAnswer(id: QaAnswerId, ctx: AnswerContext): AnswerContent {
  const { lang, calc, checklist, measurements } = ctx;
  const ko = lang === 'ko';
  const c = STRINGS_CALC[lang];
  const n = (v: number | null, d = 0) => (v === null ? '—' : formatNumber(v, lang, d));
  const won = (v: number | null) => (v === null ? '—' : `${formatNumber(v, lang, 0)}${ko ? '원' : ' KRW'}`);
  const { values: v, result: r } = calc;
  const levelText = r.level ? levelLabel(r.level, c) : c.invalidInput;
  const liveCaption = ko
    ? '현재 계산기 입력값 기준 · 실시간 참조 (중앙 계산 엔진)'
    : 'Based on current calculator inputs · live reference (central engine)';

  switch (id) {
    case 'bpImpact':
      return {
        paragraphs: ko
          ? [
              '배압(HRSG 가스측 압력손실)이 증가하면 가스터빈 출구의 배기 압력이 높아져, 일반적으로 가스터빈 출력과 효율이 낮아지는 방향으로 작용합니다. 튜브 표면의 파울링(부착물)은 가스 흐름 저항을 키우는 동시에 열전달을 떨어뜨려, 배기가스 출구 온도 상승이나 증기 생산량 감소로 함께 나타날 수 있습니다.',
              `다만 영향의 크기는 설비 설계, 운전 부하, 대기 조건에 따라 달라지며, 이 프로토타입은 이를 검증된 모델로 산정하지 않습니다. 아래 수치는 계산기의 임시 계산식(초과분 × ${POWER_LOSS_COEFF_MW_PER_MMH2O} MW/mmH₂O)을 그대로 참조한 예시 계산이며 실제 발전 손실이 아닙니다.`,
              '배압 하나만으로 세정이 반드시 필요하다고 판단할 수는 없습니다. 부하 보정된 추세, 배기가스 온도, 설비 이력을 함께 검토해야 합니다.',
            ]
          : [
              'Higher HRSG back pressure (gas-side pressure loss) raises the gas-turbine exhaust pressure, which generally pushes GT output and efficiency down. Tube fouling both increases flow resistance and reduces heat transfer, so it can also show up as higher stack temperature or lower steam production.',
              `The magnitude depends on unit design, load and ambient conditions, and this prototype does not estimate it with a validated model. The figures below reference the calculator’s provisional formula (excess × ${POWER_LOSS_COEFF_MW_PER_MMH2O} MW/mmH₂O) and are example calculations, not actual losses.`,
              'Back pressure alone cannot establish that cleaning is required. Load-corrected trends, stack temperature and equipment history must be reviewed together.',
            ],
        factsCaption: liveCaption,
        facts: [
          { label: c.kpiCurrentBp, value: `${n(v.currentBp)} mmH₂O`, types: ['mock'] },
          { label: c.gaugeReference, value: `${n(v.referenceBp)} mmH₂O`, types: ['mock', 'unconfirmed'] },
          { label: c.stepDelta, value: `${n(r.deltaBp)} mmH₂O`, types: ['example'] },
          { label: c.stepPower, value: `${n(r.powerLossMw, 2)} MW`, types: ['example'] },
          { label: c.stepMonthly, value: won(r.monthlyLossKrw), types: ['example'] },
          { label: ko ? '시연용 임계값 상태' : 'Demo-threshold status', value: levelText, types: ['unconfirmed'] },
        ],
        needs: ko
          ? ['부하별 배압·차압 시계열', '배기가스 온도·유량', '설계 기준 배압 및 기준 운전 조건', '세정·정비 이력']
          : ['Back pressure / ΔP time series by load', 'Exhaust gas temperature and flow', 'Design reference back pressure and conditions', 'Cleaning and maintenance history'],
        links: ['calculator'],
        sources: ['general', 'calcInputs', 'engine'],
      };

    case 'cleaningNeedData': {
      const { receivedCount, total, reviewPct } = checklist.summary;
      return {
        paragraphs: ko
          ? [
              `세정 필요성은 단일 지표가 아니라 여러 데이터를 함께 보고 판단해야 합니다. 현재 계산기 상태는 시연용 임계값 기준 '${levelText}'이지만, 이는 검증된 기준에 따른 진단 결과가 아닙니다.`,
              receivedCount === 0
                ? `데이터 요청 체크리스트에서 수령 완료로 표시된 항목은 ${total}개 중 0개입니다. 실측 데이터가 아직 없어 현재 조건에서 세정 필요성을 판단할 근거가 부족합니다.`
                : `데이터 요청 체크리스트에서 수령 완료로 표시된 항목은 ${total}개 중 ${receivedCount}개입니다. 수령한 자료도 검증을 거친 뒤 판단에 사용해야 합니다.`,
            ]
          : [
              `Cleaning necessity must be judged from several data sources, not one indicator. The calculator currently shows '${levelText}' by demo thresholds, which is not a diagnosis against validated criteria.`,
              receivedCount === 0
                ? `The data request checklist marks 0 of ${total} items as received. Without measured data there is not enough basis to judge cleaning necessity under current conditions.`
                : `The data request checklist marks ${receivedCount} of ${total} items as received. Received data still needs verification before use.`,
            ],
        factsCaption: ko ? '현재 세션의 계산기·체크리스트 상태' : 'Current session calculator & checklist state',
        facts: [
          { label: c.kpiCurrentBp, value: `${n(v.currentBp)} mmH₂O`, types: ['mock'] },
          { label: ko ? '시연용 임계값 상태' : 'Demo-threshold status', value: levelText, types: ['unconfirmed'] },
          { label: ko ? '데이터 수령 완료' : 'Data received', value: `${receivedCount} / ${total}`, types: receivedCount === 0 ? ['noMeasured'] : [] },
          { label: ko ? '체크리스트 검토 진행률' : 'Checklist review progress', value: `${n(reviewPct, 0)}%`, types: [] },
        ],
        needs: ko
          ? [
              '부하 보정된 배압·차압 추세',
              '배기가스 출구 온도 추세',
              '가스터빈 부하·출력 및 배기가스 유량',
              '설계/시운전 기준 운전 조건',
              '과거 세정 이력과 세정 후 효과 지속 기간',
              '세정 비용과 작업·정지 시간',
            ]
          : [
              'Load-corrected back pressure / ΔP trend',
              'Stack gas outlet temperature trend',
              'GT load/output and exhaust gas flow',
              'Design / commissioning reference conditions',
              'Past cleaning history and effect duration',
              'Cleaning cost and work / outage time',
            ],
        links: ['checklist', 'calculator'],
        sources: ['general', 'calcInputs', 'checklist'],
      };
    }

    case 'dryIceVsWater':
      return {
        paragraphs: ko
          ? [
              '드라이아이스 세정은 CO₂ 펠릿을 분사해 부착물을 떼어내는 방식입니다. 펠릿이 승화하므로 세정 매체로 인한 2차 폐수가 거의 발생하지 않는 것이 일반적인 특징입니다.',
              '고압수 세정은 고압의 물 분사로 부착물을 제거하는 방식입니다. 폐수 처리, 세정 후 건조, 수분에 의한 부식 영향 검토가 필요할 수 있습니다.',
              '실제 효과와 적합성은 부착물 성상, 튜브·핀 배열의 접근성, 작업 시간과 정지 시간에 따라 달라지므로 어느 방식이 우월하다고 단정할 수 없습니다. 아래 비용·편익은 계산기 세정 비교와 동일한 가상 데이터입니다.',
            ]
          : [
              'Dry-ice blasting propels CO₂ pellets to dislodge deposits. Because the pellets sublimate, it typically produces little secondary wastewater from the cleaning medium.',
              'High-pressure water cleaning removes deposits with water jets. Wastewater handling, drying afterwards and moisture-related corrosion may need to be considered.',
              'Actual effectiveness depends on deposit type, access to tube/fin banks, and work and outage time, so neither method can be declared superior. The costs and benefits below are the same mock data used in the calculator’s comparison.',
            ],
        factsCaption: ko ? '계산기 세정 비교와 동일한 가상 데이터 · 회수 기간은 예시 계산' : 'Same mock data as calculator comparison · payback is an example calc',
        facts: MOCK_CLEANING_METHODS.flatMap<AnswerFact>((m) => {
          const pb = calcSimplePaybackMonths(m.costKrw, m.monthlyBenefitKrw);
          return [
            {
              label: `${m.label[lang]} · ${c.cleanCost} / ${c.cleanBenefit}`,
              value: `${won(m.costKrw)} / ${won(m.monthlyBenefitKrw)}`,
              types: ['mock'],
            },
            { label: `${m.label[lang]} · ${c.cleanPayback}`, value: `${n(pb, 2)} ${c.cleanPaybackUnit}`, types: ['example'] },
          ];
        }),
        needs: ko
          ? ['부착물 성상 분석 결과', '세정 업체 견적', '작업 시간 및 정지 시간', '과거 세정 방식별 효과 기록']
          : ['Deposit analysis', 'Vendor quotes', 'Work and outage duration', 'Past effect records per method'],
        links: ['calculator', 'validation'],
        sources: ['general', 'cleaningMock', 'engine'],
      };

    case 'pinchApproach':
      return {
        paragraphs: ko
          ? [
              'Pinch Point는 일반적으로 증발기 출구의 배기가스 온도와 드럼 압력에서의 포화온도 차이를 말하며, 증발기에서 회수할 수 있는 열량과 관련됩니다.',
              'Approach Point는 일반적으로 드럼 압력에서의 포화온도와 Economizer 출구 급수 온도의 차이를 말하며, Economizer 내부에서 증발이 일어나지 않도록 하는 여유와 관련됩니다.',
              '이 프로토타입은 포화온도 산정 기준과 설계 기준값이 확정되지 않아 두 값을 계산하지 않습니다. 계산기의 Pinch/Approach 패널은 "분석 대기" 상태입니다.',
            ]
          : [
              'The pinch point generally means the difference between the evaporator outlet gas temperature and the saturation temperature at drum pressure; it relates to how much heat the evaporator can recover.',
              'The approach point generally means the difference between the saturation temperature at drum pressure and the economizer outlet water temperature; it relates to the margin that keeps the economizer from steaming.',
              'Because the saturation-temperature basis and design criteria are not confirmed, this prototype does not compute either value. The calculator’s pinch/approach panel shows “analysis pending”.',
            ],
        factsCaption: liveCaption,
        facts: [
          { label: 'Drum Pressure', value: `${n(v.drumPressure)} bar`, types: ['mock'] },
          { label: ko ? 'Economizer 출구 급수 온도' : 'Economizer outlet water temp.', value: `${n(v.econOutletWaterTemp)} °C`, types: ['mock'] },
          { label: ko ? '증발기 출구 가스 온도' : 'Evaporator outlet gas temp.', value: `${n(v.evapOutletGasTemp)} °C`, types: ['mock'] },
          { label: ko ? '분석 상태' : 'Analysis status', value: ko ? '분석 대기' : 'Pending', types: ['unconfirmed'] },
        ],
        needs: c.pinchNeedsList,
        links: ['calculator'],
        sources: ['general', 'calcInputs'],
      };

    case 'validationData': {
      const s = VALIDATION_SCENARIO;
      const be = calcBreakEvenDays(s.cleaningCostKrw, s.dailyNetBenefitKrw);
      const count = measurements.entries.length;
      return {
        paragraphs: ko
          ? [
              '세정 효과를 검증하려면 세정 전후를 가능한 한 같은 운전 조건(부하, 대기 온도)에서 비교해야 합니다. 조건이 다르면 개선량이 과대 또는 과소 평가될 수 있습니다.',
              `세정 전후 검증 탭은 현재 가상 시나리오로 화면 구조만 시연합니다. 사용자가 입력한 측정값은 ${count}건${count === 0 ? '이며, 실측 데이터 미입력 상태입니다.' : '이며, 검증 전 값입니다.'}`,
            ]
          : [
              'To validate the cleaning effect, compare pre- and post-cleaning periods under conditions as similar as possible (load, ambient temperature). Otherwise the improvement can be over- or under-estimated.',
              `The Validation tab currently demonstrates the screen with a mock scenario only. User-entered measurements: ${count}${count === 0 ? ' — no measured data yet.' : ' — not yet verified.'}`,
            ],
        factsCaption: ko ? '세정 전후 검증 탭의 가상 시나리오 (계산기 입력값과 별도)' : 'Validation-tab mock scenario (separate from calculator inputs)',
        facts: [
          { label: ko ? '배압 (전 → 후)' : 'Back pressure (pre → post)', value: `${n(s.backPressure.before)} → ${n(s.backPressure.after)} mmH₂O`, types: ['scenario'] },
          { label: ko ? '배기가스 출구 온도 (전 → 후)' : 'Stack temp. (pre → post)', value: `${n(s.exhaustTemp.before)} → ${n(s.exhaustTemp.after)} °C`, types: ['scenario'] },
          { label: ko ? '손익분기점 예시' : 'Break-even example', value: `${n(be, 0)}${ko ? '일' : ' days'}`, types: ['scenario', 'example'] },
          { label: ko ? '입력된 측정값' : 'Entered measurements', value: `${count}`, types: count === 0 ? ['noMeasured'] : ['measured'] },
        ],
        needs: ko
          ? [
              `세정 전 ${s.daysBefore}일 이상 · 세정 후 ${s.daysAfter}일 이상 운전 시계열`,
              '부하·대기 온도 등 비교 조건',
              '배압·차압 및 배기가스 출구 온도',
              '가스터빈 출력, 연료 유량, 증기 생산량',
              '세정 일자·방식·비용·정지 시간',
            ]
          : [
              `≥${s.daysBefore} days pre- and ≥${s.daysAfter} days post-cleaning time series`,
              'Comparison conditions such as load and ambient temperature',
              'Back pressure / ΔP and stack gas temperature',
              'GT output, fuel flow, steam production',
              'Cleaning date, method, cost, outage time',
            ],
        links: ['validation', 'checklist'],
        sources: ['general', 'scenario', 'engine'],
      };
    }
  }
}
