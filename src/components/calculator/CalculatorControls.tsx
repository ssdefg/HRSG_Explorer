import { useState } from 'react';
import { Card, DataTypeBadges, SegmentedToggle, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useHistory, useQa, useToast, type CalculatorState } from '@/context/Workspace';
import { useCalcText } from '@/i18n/calculatorStrings';
import { goToTab } from '@/lib/useHashTab';
import type { EvaluationMode } from '@/lib/calc';
import { DEMO_SCENARIOS, SCENARIO_LABEL, type ScenarioId } from '@/data/calculatorInputs';
import { SECTION_IDS } from '@/data/tabs';
import { LEVEL_STATUS, levelLabel } from './level';

const TXT = {
  ko: {
    title: '평가 설정',
    mode: '평가 모드',
    demo: 'DEMO 시나리오',
    user: '사용자 입력',
    demoDesc: '고정 예시 시나리오와 예시 계산 엔진으로 즉시 재계산합니다. 모든 값은 가상 데이터입니다.',
    userDesc:
      '직접 입력한 값으로 계산합니다. 단위 환산·산술로 정의되는 경제성 항목만 계산하고, 검증되지 않은 배압→출력 손실 모델은 "모델 미연동"으로 보류합니다. 입력했다고 공학적으로 검증된 결과가 되지는 않습니다.',
    scenario: '운전 시나리오 (선택)',
    scenarioNote: 'DEMO 프리셋 · 공학 기준 아님 — 배압·차압 값이 입력란에 반영되며, 수동으로 바꾸면 "사용자 지정"이 됩니다.',
    current: '선택된 시나리오',
    auto: '배압 기반 자동 판별 (DEMO 임계값)',
    autoNone: '판별 불가 (입력 확인)',
    scenarioUserMode: '사용자 입력 모드에서는 시나리오 프리셋을 쓰지 않습니다.',
    ask: '이 결과 질문하기',
    save: '분석 스냅샷 저장',
    saved: (n: number) => `분석 스냅샷 #${n}을 저장했습니다.`,
    invalid: '계산 결과가 없습니다 — 입력값 오류를 먼저 보완해 주세요. 숫자를 AI로 전달하지 않았습니다.',
    draft: (n: number, model: string, mode: string) =>
      `계산 결과 스냅샷 #${n} (${model}, ${mode})의 의미와 판단 전에 추가로 필요한 데이터를 알려 주세요.`,
  },
  en: {
    title: 'Evaluation settings',
    mode: 'Evaluation mode',
    demo: 'DEMO scenario',
    user: 'User input',
    demoDesc: 'Recalculates instantly with fixed example scenarios and the example engine. All values are mock data.',
    userDesc:
      'Calculates from values you enter. Only arithmetic/unit-conversion economics are computed; the unverified back-pressure→loss model is held as "model not connected". Entering values does not make results engineering-validated.',
    scenario: 'Operating scenario (selection)',
    scenarioNote: 'DEMO presets · not engineering criteria — sets back pressure and ΔP inputs; manual edits switch to "Custom".',
    current: 'Selected scenario',
    auto: 'Auto status from back pressure (DEMO thresholds)',
    autoNone: 'Not determinable (check input)',
    scenarioUserMode: 'Scenario presets are not used in user-input mode.',
    ask: 'Ask about this result',
    save: 'Save analysis snapshot',
    saved: (n: number) => `Saved analysis snapshot #${n}.`,
    invalid: 'No calculation result — fix the input errors first. No numbers were sent to the AI.',
    draft: (n: number, model: string, mode: string) =>
      `What does calculation snapshot #${n} (${model}, ${mode}) mean, and what additional data is needed before judging?`,
  },
};

const SCENARIOS: ScenarioId[] = ['normal', 'alarm', 'trip'];

export function CalculatorControls({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const c = useCalcText();
  const history = useHistory();
  const qa = useQa();
  const toast = useToast();
  const [askError, setAskError] = useState(false);

  const askAi = () => {
    const snap = history.saveSnapshot();
    if (!snap) {
      setAskError(true);
      toast.push(x.invalid, 'error');
      return;
    }
    setAskError(false);
    qa.setAttachment(snap.id);
    qa.setDraft(x.draft(snap.seq, snap.model, state.mode === 'demo' ? x.demo : x.user));
    goToTab('dashboard', { section: SECTION_IDS.ai });
  };

  const save = () => {
    const snap = history.saveSnapshot();
    if (!snap) {
      setAskError(true);
      toast.push(x.invalid, 'error');
      return;
    }
    setAskError(false);
    toast.push(x.saved(snap.seq), 'success');
  };

  return (
    <Card className="calc-controls" title={x.title} badges={<DataTypeBadges types={state.mode === 'demo' ? ['mock'] : ['userInput']} />}>
      <div className="calc-controls__grid">
        <div className="calc-controls__block">
          <span className="field__label">{x.mode}</span>
          <SegmentedToggle<EvaluationMode>
            className="seg--light"
            label={x.mode}
            value={state.mode}
            onChange={state.setMode}
            options={[
              { value: 'demo', label: x.demo },
              { value: 'user', label: x.user },
            ]}
          />
          <p className="field__hint">{state.mode === 'demo' ? x.demoDesc : x.userDesc}</p>
        </div>

        <div className="calc-controls__block">
          <span className="field__label">{x.scenario}</span>
          {state.mode === 'demo' ? (
            <>
              <div className="scenario-btns" role="group" aria-label={x.scenario}>
                {SCENARIOS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="chip"
                    aria-pressed={state.scenario === id}
                    onClick={() => state.applyScenario(id)}
                    data-scenario={id}
                  >
                    {DEMO_SCENARIOS[id].label[lang]}
                  </button>
                ))}
              </div>
              <p className="field__hint">{x.scenarioNote}</p>
            </>
          ) : (
            <p className="field__hint">{x.scenarioUserMode}</p>
          )}
          <dl className="status-pair">
            <div>
              <dt>{x.current}</dt>
              <dd data-testid="scenario-label">{SCENARIO_LABEL[state.mode === 'demo' ? state.scenario : 'custom'][lang]}</dd>
            </div>
            <div>
              <dt>{x.auto}</dt>
              <dd data-testid="auto-status">
                {state.level ? <StatusBadge status={LEVEL_STATUS[state.level]} label={levelLabel(state.level, c)} /> : x.autoNone}{' '}
                <DataTypeBadges types={['unconfirmed']} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="calc-controls__block calc-controls__actions">
          <button type="button" className="btn btn--primary" onClick={askAi} data-testid="ask-ai">
            {x.ask}
          </button>
          <button type="button" className="btn btn--ghost" onClick={save}>
            {x.save}
          </button>
          {askError && !state.valid && (
            <p className="field__error" role="alert">
              {x.invalid}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
