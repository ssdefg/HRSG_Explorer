import { useState } from 'react';
import { Card, DataTypeBadges, SegmentedToggle, StatusBadge } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useHistory, useQa, useToast, type CalculatorState } from '@/context/Workspace';
import { useCalcText } from '@/i18n/calculatorStrings';
import { usePageContext } from '@/components/assistant/usePageContext';
import type { EvaluationMode } from '@/lib/calc';
import { DEMO_SCENARIOS, SCENARIO_LABEL, type ScenarioId } from '@/data/calculatorInputs';
import { LEVEL_STATUS, levelLabel } from './level';

const TXT = {
  ko: {
    title: '평가 설정',
    mode: '평가 모드',
    demo: 'DEMO 시나리오',
    user: '사용자 입력',
    demoDesc: '고정 예시 시나리오와 예시 계산 엔진으로 계산합니다. 입력을 바꾸면 "재평가 실행" 전까지 결과가 가려집니다. 모든 값은 가상 데이터입니다.',
    userDesc:
      '직접 입력한 값으로 계산합니다. 단위 환산·산술로 정의되는 경제성 항목만 계산하고, 검증되지 않은 배압→출력 손실 모델은 "모델 미연동"으로 보류합니다. 입력했다고 공학적으로 검증된 결과가 되지는 않습니다.',
    scenario: '운전 시나리오 (선택)',
    scenarioNote: 'DEMO 프리셋 · 공학 기준 아님 — 배압·차압 값이 입력란에 반영되며, 수동으로 바꾸면 "사용자 지정"이 됩니다.',
    current: '선택된 시나리오',
    auto: '배압 기반 자동 판별 (DEMO 임계값)',
    autoNone: '판별 불가 (입력 확인)',
    scenarioUserMode: '사용자 입력 모드에서는 시나리오 프리셋을 쓰지 않습니다.',
    run: '계산 실행',
    rerun: '재평가 실행',
    staleNote: '입력값이 바뀌었습니다 — 결과는 재평가 전까지 가려집니다.',
    staleAsk: '재평가 후에 질문할 수 있습니다 — 먼저 "재평가 실행"을 눌러 주세요.',
    ask: 'AI에게 질문하기',
    save: '분석 스냅샷 저장',
    saved: (n: number) => `분석 스냅샷 #${n}을 저장했습니다.`,
    invalid: '계산 결과가 없습니다 — 입력값 오류를 먼저 보완해 주세요. 숫자를 AI로 전달하지 않았습니다.',
    draft: (n: number, model: string, mode: string) =>
      `첨부한 계산 결과(스냅샷 #${n}, ${model}, ${mode})의 의미와 판단 전에 추가로 필요한 데이터를 문헌 근거와 함께 알려 주세요.`,
  },
  en: {
    title: 'Evaluation settings',
    mode: 'Evaluation mode',
    demo: 'DEMO scenario',
    user: 'User input',
    demoDesc: 'Calculates with fixed example scenarios and the example engine. After an input change, results stay hidden until you re-evaluate. All values are mock data.',
    userDesc:
      'Calculates from values you enter. Only arithmetic/unit-conversion economics are computed; the unverified back-pressure→loss model is held as "model not connected". Entering values does not make results engineering-validated.',
    scenario: 'Operating scenario (selection)',
    scenarioNote: 'DEMO presets · not engineering criteria — sets back pressure and ΔP inputs; manual edits switch to "Custom".',
    current: 'Selected scenario',
    auto: 'Auto status from back pressure (DEMO thresholds)',
    autoNone: 'Not determinable (check input)',
    scenarioUserMode: 'Scenario presets are not used in user-input mode.',
    run: 'Run calculation',
    rerun: 'Re-evaluate',
    staleNote: 'Inputs changed — results stay hidden until you re-evaluate.',
    staleAsk: 'Re-evaluate first, then ask about the result.',
    ask: 'Ask AI about this result',
    save: 'Save analysis snapshot',
    saved: (n: number) => `Saved analysis snapshot #${n}.`,
    invalid: 'No calculation result — fix the input errors first. No numbers were sent to the AI.',
    draft: (n: number, model: string, mode: string) =>
      `What do the attached results (snapshot #${n}, ${model}, ${mode}) mean, and what additional data is needed before judging? Cite the literature.`,
  },
};

const SCENARIOS: ScenarioId[] = ['normal', 'alarm', 'trip'];

export function CalculatorControls({ state }: { state: CalculatorState }) {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const c = useCalcText();
  const history = useHistory();
  const qa = useQa();
  const pageContext = usePageContext();
  const toast = useToast();
  const [askError, setAskError] = useState(false);

  const askAi = () => {
    if (state.stale) {
      toast.push(x.staleAsk, 'error');
      return;
    }
    const snap = history.saveSnapshot();
    if (!snap) {
      setAskError(true);
      toast.push(x.invalid, 'error');
      return;
    }
    setAskError(false);
    // 분석 이력에도 남기고, 계산기 화면 데이터(입력·결과·경제성·핀치)를 어시스턴트에 첨부해 연다 — 페이지 이동 없음
    qa.openAssistant({ context: pageContext('calculator'), draft: x.draft(snap.seq, snap.model, state.mode === 'demo' ? x.demo : x.user) });
  };

  const save = () => {
    if (state.stale) {
      toast.push(x.staleAsk, 'error');
      return;
    }
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
          <button
            type="button"
            className={`btn ${state.stale ? 'btn--primary' : 'btn--ghost'}`}
            onClick={state.commit}
            data-testid="run-calc"
          >
            {state.stale ? x.rerun : x.run}
          </button>
          {state.stale && (
            <p className="field__warn" role="status" data-testid="stale-note">
              <DataTypeBadges types={['stale']} /> {x.staleNote}
            </p>
          )}
          <button type="button" className="btn btn--primary" onClick={askAi} data-testid="ask-ai" disabled={state.stale}>
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
