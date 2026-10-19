import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Lang } from '@/types';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useCalculator, useChecklist, useMeasurements, useQa, type QaMessage } from '@/context/Workspace';
import { QA_PRESETS } from '@/data/qaPresets';
import { TABS } from '@/data/tabs';
import { goToTab } from '@/lib/useHashTab';
import { buildAnswer, type AnswerContext, type SourceKind } from '@/components/qa/answers';

const TXT = {
  ko: {
    notice:
      '실제 AI, RAG, 기업 문서 검색은 연결되어 있지 않습니다. 추천 질문 또는 입력 문장과 일치하는 사전 작성 시연용 답변만 표시합니다.',
    demoBadge: '시연용 답변 · 실제 AI/RAG 미연동',
    convTitle: '대화',
    convEmpty: '오른쪽 추천 질문을 선택하거나 아래에 질문을 입력하세요.',
    placeholder: '질문을 입력하세요 (예: 배압이 오르면 성능에 어떤 영향이 있나요?)',
    send: '전송',
    sendHint: 'Enter 전송 · Shift+Enter 줄바꿈',
    clear: '대화 지우기',
    you: '질문',
    viaPreset: '추천 질문에 대한 사전 작성 답변',
    viaExact: '준비된 질문과 일치하는 사전 작성 답변',
    viaKeyword: (q: string) => `입력 문장과 가장 가까운 준비 질문에 대한 답변: “${q}”`,
    fallbackTitle: '준비된 시연용 답변이 없습니다',
    fallbackBody:
      '이 질문과 일치하는 사전 작성 답변을 찾지 못했습니다. 실제 AI가 연결되어 있지 않아 새로운 질문에 대한 답변을 생성할 수 없습니다. 아래 준비된 질문 중 하나를 선택해 주세요.',
    facts: '관련 수치',
    needs: '추가로 필요한 데이터',
    sources: '답변 근거 및 신뢰성',
    open: (tab: string) => `${tab} 열기 →`,
    presetsTitle: '추천 질문',
    presetsSub: '선택하면 사전 작성된 시연용 답변이 표시됩니다.',
    reliTitle: '데이터 출처 및 신뢰성',
    reliRows: [
      ['AI 모델', '미연동'],
      ['RAG · 문서 검색', '미연동'],
      ['클라우드라 제공 기술 문서', '미수령 · 인용 없음'],
      ['답변 방식', '사전 작성 답변 + 키워드 매칭'],
      ['답변 속 수치', '계산기·체크리스트 상태 실시간 참조'],
    ] as [string, string][],
    dataTitle: '추가 데이터 안내',
    dataBody: (rec: number, total: number, req: number) =>
      `데이터 요청 체크리스트 기준 수령 완료 ${rec}/${total}개, 요청 필요로 표시된 항목 ${req}개입니다. 실측 데이터가 확보되기 전까지 답변의 수치는 가상 데이터와 예시 계산입니다.`,
    sessionNote: '대화 이력은 현재 브라우저 탭에서만 유지되며 새로고침 시 초기화됩니다.',
    src: {
      general: '일반적인 HRSG 개념 설명 — 클라우드라 제공 문서 아님',
      calcInputs: '계산기 입력값 — 가상 데이터',
      engine: '중앙 계산 엔진 (src/lib/calc.ts) — 예시 계산',
      cleaningMock: '세정 방식 비교 데이터 — 가상 데이터',
      checklist: '데이터 요청 체크리스트 — 현재 세션 상태',
      scenario: '세정 전후 검증 시나리오 — 가상 시나리오',
    } satisfies Record<SourceKind, string>,
  },
  en: {
    notice:
      'No real AI, RAG or partner document search is connected. Only pre-written demo answers matching a suggested question or your sentence are shown.',
    demoBadge: 'Demo answer · AI/RAG not connected',
    convTitle: 'Conversation',
    convEmpty: 'Pick a suggested question on the right or type a question below.',
    placeholder: 'Type a question (e.g., How does rising back pressure affect performance?)',
    send: 'Send',
    sendHint: 'Enter to send · Shift+Enter for newline',
    clear: 'Clear conversation',
    you: 'Question',
    viaPreset: 'Pre-written answer to a suggested question',
    viaExact: 'Pre-written answer matching a prepared question',
    viaKeyword: (q: string) => `Answer to the closest prepared question: “${q}”`,
    fallbackTitle: 'No prepared demo answer',
    fallbackBody:
      'No pre-written answer matches this question. Because no real AI is connected, answers to new questions cannot be generated. Please choose one of the prepared questions below.',
    facts: 'Related figures',
    needs: 'Additional data required',
    sources: 'Basis & reliability',
    open: (tab: string) => `Open ${tab} →`,
    presetsTitle: 'Suggested questions',
    presetsSub: 'Selecting one shows a pre-written demo answer.',
    reliTitle: 'Data source & reliability',
    reliRows: [
      ['AI model', 'Not connected'],
      ['RAG · document search', 'Not connected'],
      ['클라우드라 technical documents', 'Not received · not cited'],
      ['Answer method', 'Pre-written answers + keyword matching'],
      ['Figures in answers', 'Live reference to calculator / checklist state'],
    ] as [string, string][],
    dataTitle: 'Additional data',
    dataBody: (rec: number, total: number, req: number) =>
      `Checklist: ${rec}/${total} items received, ${req} marked as request needed. Until measured data arrives, figures in answers are mock data and example calculations.`,
    sessionNote: 'Conversation history lives only in this browser tab and resets on reload.',
    src: {
      general: 'General HRSG concepts — not a 클라우드라 document',
      calcInputs: 'Calculator inputs — mock data',
      engine: 'Central calculation engine (src/lib/calc.ts) — example calc',
      cleaningMock: 'Cleaning comparison data — mock data',
      checklist: 'Data request checklist — current session state',
      scenario: 'Pre/post validation scenario — mock scenario',
    } satisfies Record<SourceKind, string>,
  },
};

type Txt = (typeof TXT)[Lang];

export function DemoAnswerBadge({ text }: { text: string }) {
  return (
    <span className="badge badge--demo-ai" title={text}>
      <span aria-hidden="true">⚠</span>
      {text}
    </span>
  );
}

function AnswerView({ msg, ctx, x }: { msg: Extract<QaMessage, { kind: 'answer' }>; ctx: AnswerContext; x: Txt }) {
  const a = buildAnswer(msg.answerId, ctx);
  const preset = QA_PRESETS.find((p) => p.id === msg.answerId);
  const via =
    msg.via === 'preset' ? x.viaPreset : msg.via === 'exact' ? x.viaExact : x.viaKeyword(preset?.question[ctx.lang] ?? '');
  return (
    <article className="qa-answer">
      <header className="qa-answer__head">
        <DemoAnswerBadge text={x.demoBadge} />
        <span className="qa-answer__via">{via}</span>
      </header>
      {a.paragraphs.map((p) => (
        <p key={p} className="qa-answer__p">
          {p}
        </p>
      ))}

      {a.facts.length > 0 && (
        <div className="qa-answer__block">
          <p className="qa-answer__block-title">
            {x.facts}
            {a.factsCaption && <span className="qa-answer__caption"> · {a.factsCaption}</span>}
          </p>
          <ul className="qa-facts">
            {a.facts.map((f) => (
              <li key={f.label}>
                <span className="qa-facts__label">{f.label}</span>
                <strong className="qa-facts__value num">{f.value}</strong>
                <span className="badge-row">
                  <DataTypeBadges types={f.types} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="qa-answer__block">
        <p className="qa-answer__block-title">{x.needs}</p>
        <ul className="qa-needs">
          {a.needs.map((nd) => (
            <li key={nd}>{nd}</li>
          ))}
        </ul>
      </div>

      <div className="qa-answer__links">
        {a.links.map((tab) => {
          const def = TABS.find((t) => t.id === tab);
          return (
            <button key={tab} type="button" className="btn btn--ghost btn--sm" onClick={() => goToTab(tab)}>
              {x.open(def?.label[ctx.lang] ?? tab)}
            </button>
          );
        })}
      </div>

      <details className="qa-answer__sources">
        <summary>{x.sources}</summary>
        <ul>
          {a.sources.map((s) => (
            <li key={s}>{x.src[s]}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export function AiQaPage() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const calc = useCalculator();
  const checklist = useChecklist();
  const measurements = useMeasurements();
  const qa = useQa();
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLOListElement>(null);
  const ctx: AnswerContext = { lang, calc, checklist, measurements };

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [qa.messages.length]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    qa.askFree(text);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const presetButtons = (compact = false) => (
    <ul className={`qa-presets${compact ? ' qa-presets--compact' : ''}`}>
      {QA_PRESETS.map((p) => (
        <li key={p.id}>
          <button type="button" className="qa-preset" onClick={() => qa.askPreset(p.id, p.question[lang])}>
            {p.question[lang]}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <PageScaffold tabId="qa" pageDataTypes={['mock', 'example', 'planned']}>
      <p className="page-notice page-notice--ai" role="note">
        <DemoAnswerBadge text={x.demoBadge} />
        <span>{x.notice}</span>
      </p>

      <div className="qa-layout">
        <Card
          className="qa-conv"
          title={x.convTitle}
          badges={
            <>
              <DemoAnswerBadge text={x.demoBadge} />
              {qa.messages.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={qa.clear}>
                  {x.clear}
                </button>
              )}
            </>
          }
        >
          <ol className="qa-log" ref={logRef} aria-live="polite">
            {qa.messages.length === 0 && <li className="qa-log__empty">{x.convEmpty}</li>}
            {qa.messages.map((m) => (
              <li key={m.id} className={`qa-log__item qa-log__item--${m.kind}`}>
                {m.kind === 'question' && (
                  <div className="qa-question">
                    <span className="sr-only">{x.you}: </span>
                    {m.text}
                  </div>
                )}
                {m.kind === 'answer' && <AnswerView msg={m} ctx={ctx} x={x} />}
                {m.kind === 'fallback' && (
                  <article className="qa-answer qa-answer--fallback">
                    <header className="qa-answer__head">
                      <DemoAnswerBadge text={x.demoBadge} />
                    </header>
                    <p className="qa-answer__title">{x.fallbackTitle}</p>
                    <p className="qa-answer__p">{x.fallbackBody}</p>
                    {presetButtons(true)}
                  </article>
                )}
              </li>
            ))}
          </ol>

          <form className="qa-form" onSubmit={submit}>
            <label htmlFor="qa-input" className="sr-only">
              {x.placeholder}
            </label>
            <textarea
              id="qa-input"
              className="qa-form__input"
              rows={2}
              value={draft}
              placeholder={x.placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              maxLength={500}
            />
            <div className="qa-form__row">
              <span className="field__hint">{x.sendHint}</span>
              <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
                {x.send}
              </button>
            </div>
          </form>
        </Card>

        <div className="qa-side">
          <Card title={x.presetsTitle} subtitle={x.presetsSub}>
            {presetButtons()}
          </Card>

          <Card title={x.reliTitle} badges={<DataTypeBadges types={['planned']} />}>
            <dl className="reli-list">
              {x.reliRows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="note">{x.sessionNote}</p>
          </Card>

          <Card title={x.dataTitle} badges={<DataTypeBadges types={['noMeasured']} />}>
            <p className="qa-side__text">
              {x.dataBody(checklist.summary.receivedCount, checklist.summary.total, checklist.summary.byStatus.requestNeeded)}
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => goToTab('checklist')}>
              {x.open(TABS.find((t) => t.id === 'checklist')?.label[lang] ?? '')}
            </button>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}
