import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { TabId } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { useCalculator, useCases, useChecklist, useHistory, useMeasurements, useQa, type QaMessage } from '@/context/Workspace';
import type { AnswerContext } from '@/components/qa/answers';
import { LEGACY_TXT, toHistoryAnswer } from '@/components/qa/LegacyAnswer';
import { ASSISTANT_SUGGESTIONS } from '@/data/assistantPrompts';
import { qaHistory, qaSourceKey } from '@/lib/qaHistory';
import { useHealth } from '@/lib/useHealth';
import { AssistantMessage } from './AssistantMessage';
import { usePageContext } from './usePageContext';
import { ASSISTANT_TXT } from './strings';

const Icon = {
  sparkle: (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zm6.5 10l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3zM6 15l.7 1.8 1.8.7-1.8.7L6 20l-.7-1.8-1.8-.7 1.8-.7L6 15z"
        fill="currentColor"
      />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  expand: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M9 3h4v4M7 13H3V9M13 3L9 7M3 13l4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  ),
  collapse: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M13 7H9V3M3 9h4v4M9 7l4-4M7 9l-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/**
 * 전역 AI 어시스턴트 — App 최상위에 한 번만 렌더링되어 페이지를 이동해도 다시 만들어지지 않는다.
 * 대화는 케이스별(useQa)로 저장되고, 답변은 기존 참고문헌 RAG 서버(/api/ask: BM25 + BGE-M3 가중 RRF → 상위 8문단 → Gemini)를 그대로 쓴다.
 */
export function FloatingAssistant({ tab }: { tab: TabId }) {
  const { lang } = useAppSettings();
  const x = ASSISTANT_TXT[lang];
  const qa = useQa();
  const cases = useCases();
  const health = useHealth();
  const pageContext = usePageContext();
  const calc = useCalculator();
  const checklist = useChecklist();
  const measurements = useMeasurements();
  const history = useHistory();
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const { chatOpen: open, chatMode: mode } = qa;

  // 새 메시지·대기 상태가 바뀌면 맨 아래로 (사용자가 위로 스크롤해 읽는 중이면 유지)
  const nearBottom = useRef(true);
  useEffect(() => {
    const el = logRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [qa.messages.length, qa.pending, qa.activeId, open, view]);

  // 열리거나 화면 데이터가 첨부되면 입력창에 포커스
  useEffect(() => {
    if (open && view === 'chat') inputRef.current?.focus();
  }, [open, view, qa.attachment]);

  // Esc 로 닫기 (모바일 전체 화면에서 특히 필요)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        qa.setChatOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, qa]);

  // 케이스를 바꾸면 그 케이스의 대화로 — 목록 화면이었다면 대화로 돌아간다
  useEffect(() => setView('chat'), [cases.current.id]);

  const legacyCtx = useCallback(
    (snapshotId?: string): AnswerContext => ({
      lang,
      calc,
      checklist,
      measurements,
      snapshot: snapshotId ? history.getSnapshot(snapshotId) : undefined,
    }),
    [lang, calc, checklist, measurements, history],
  );

  // 질문 기록(qaHistory) — 새 답변을 기록 시점 그대로 저장한다 (예전 대시보드 카드의 동작을 이어받음)
  const caseId = cases.current.id;
  const caseName = cases.current.name;
  useEffect(() => {
    const since = qaHistory.trackingSince();
    for (const conv of qa.conversations) {
      // 예전 단일 대화에서 옮긴 기록은 이전 키 그대로 써서 중복 저장하지 않는다
      const keyCase = conv.id.startsWith('conv-legacy-') ? caseId : `${caseId}/${conv.id}`;
      conv.messages.forEach((m, i) => {
        if (m.kind === 'question' || m.at < since) return;
        const key = qaSourceKey(keyCase, m.id, m.at);
        if (qaHistory.isRecorded(key)) return;
        const q = conv.messages
          .slice(0, i)
          .reverse()
          .find((p): p is Extract<QaMessage, { kind: 'question' }> => p.kind === 'question');
        qaHistory.add({
          id: `qh-${m.at}-${conv.id}-${m.id}`,
          sourceKey: key,
          caseId,
          caseName,
          lang,
          question: q?.text ?? '',
          askedAt: q?.at ?? m.at,
          answeredAt: m.at,
          answer: toHistoryAnswer(m, legacyCtx(m.kind === 'answer' ? m.snapshotId : undefined), LEGACY_TXT[lang]),
        });
      });
    }
    // 새 메시지가 생길 때만 확인한다 (언어·계산값 변경으로 기록을 다시 만들지 않음)
  }, [qa.conversations, caseId]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!qa.draft.trim() || qa.busy) return;
    nearBottom.current = true;
    qa.ask(qa.draft, lang);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const askSuggestion = (text: string) => {
    if (qa.busy) return;
    nearBottom.current = true;
    qa.ask(text, lang);
  };

  const statusText =
    health.status === 'up' && health.info
      ? x.statusUp(health.info.docs, health.info.passages)
      : health.status === 'down'
        ? x.statusDown
        : x.statusChecking;
  const lastQuestionBefore = (i: number) =>
    qa.messages
      .slice(0, i)
      .reverse()
      .find((p): p is Extract<QaMessage, { kind: 'question' }> => p.kind === 'question')?.text;
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(
      new Date(iso),
    );

  return (
    <>
      {!open && (
        <button
          ref={fabRef}
          type="button"
          className="asst-fab"
          onClick={() => qa.setChatOpen(true)}
          aria-label={x.fab}
          aria-expanded={false}
          aria-controls="hrsg-assistant"
          data-testid="assistant-fab"
        >
          {Icon.sparkle}
          <span className="asst-fab__hint" aria-hidden="true">
            {x.fabHint}
          </span>
        </button>
      )}

      {open && (
        <section
          id="hrsg-assistant"
          className={`asst asst--${mode}`}
          role="dialog"
          aria-modal={false}
          aria-labelledby="asst-title"
          data-testid="assistant"
        >
          <header className="asst__head">
            <span className="asst__logo" aria-hidden="true">
              {Icon.sparkle}
            </span>
            <div className="asst__titles">
              <h2 className="asst__title" id="asst-title">
                {x.title}
              </h2>
              <span className={`asst__status asst__status--${health.status}`} role="status" data-testid="assistant-status">
                <span className="asst__dot" aria-hidden="true" />
                {statusText}
              </span>
            </div>
            <div className="asst__tools">
              <button type="button" className="asst-icon" onClick={() => (qa.newConversation(), setView('chat'))} title={x.newChat} aria-label={x.newChat}>
                {Icon.plus}
              </button>
              <button
                type="button"
                className="asst-icon"
                onClick={() => setView(view === 'history' ? 'chat' : 'history')}
                title={view === 'history' ? x.back : x.history}
                aria-label={view === 'history' ? x.back : x.history}
                aria-pressed={view === 'history'}
                data-testid="assistant-history"
              >
                {Icon.list}
              </button>
              <button
                type="button"
                className="asst-icon asst-icon--mode"
                onClick={() => qa.setChatMode(mode === 'float' ? 'panel' : 'float')}
                title={mode === 'float' ? x.expand : x.collapse}
                aria-label={mode === 'float' ? x.expand : x.collapse}
                data-testid="assistant-mode"
              >
                {mode === 'float' ? Icon.expand : Icon.collapse}
              </button>
              <button
                type="button"
                className="asst-icon"
                onClick={() => qa.setChatOpen(false)}
                title={x.close}
                aria-label={x.close}
                data-testid="assistant-close"
              >
                {Icon.close}
              </button>
            </div>
          </header>

          {view === 'history' ? (
            <div className="asst__body asst-hist">
              <p className="asst-hist__title">
                {x.historyTitle} · {cases.current.name}
              </p>
              {qa.conversations.length === 0 ? (
                <p className="asst-note">{x.historyEmpty}</p>
              ) : (
                <ul className="asst-hist__list">
                  {qa.conversations.map((c) => (
                    <li key={c.id} className={`asst-hist__item${c.id === qa.activeId ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        className="asst-hist__open"
                        onClick={() => {
                          qa.selectConversation(c.id);
                          nearBottom.current = true;
                          setView('chat');
                        }}
                      >
                        <span className="asst-hist__name">{c.title || x.newChat}</span>
                        <span className="asst-hist__meta num">
                          {fmtDate(c.updatedAt)} · {x.msgCount(c.messages.length)}
                          {c.id === qa.activeId && ` · ${x.active}`}
                          {c.id.startsWith('conv-legacy-') && ` · ${x.legacy}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="asst-link asst-link--danger"
                        onClick={() => window.confirm(x.delConfirm(c.title || x.newChat)) && qa.deleteConversation(c.id)}
                      >
                        {x.del}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="asst-note">{x.storage}</p>
            </div>
          ) : (
            <>
              <div
                className="asst__body"
                ref={logRef}
                aria-live="polite"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
              >
                {qa.messages.length === 0 && (
                  <div className="asst-welcome">
                    <p className="asst-welcome__text">{x.welcome}</p>
                    <p className="asst-welcome__label">{x.suggested(x.pages[tab])}</p>
                    <div className="asst-chips">
                      {ASSISTANT_SUGGESTIONS[tab].map((q) => (
                        <button key={q.ko} type="button" className="asst-chip" onClick={() => askSuggestion(q[lang])} disabled={qa.busy}>
                          {q[lang]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {qa.messages.map((m, i) => (
                  <div key={m.id} className={`asst-msg asst-msg--${m.kind === 'question' ? 'user' : 'ai'}`}>
                    <AssistantMessage
                      msg={m}
                      prevQuestion={lastQuestionBefore(i)}
                      lang={lang}
                      convId={qa.activeId ?? 'none'}
                      legacyCtx={legacyCtx}
                      onRetry={(id) => qa.retry(id, lang)}
                      retryDisabled={qa.busy}
                    />
                  </div>
                ))}
                {qa.pending && (
                  <div className="asst-msg asst-msg--ai" role="status">
                    <div className="asst-typing">
                      <span className="asst-typing__dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      {x.pending}
                    </div>
                  </div>
                )}
              </div>

              <form className="asst__composer" onSubmit={submit}>
                {qa.attachment ? (
                  <div className="asst-attach" title={x.attachNote}>
                    <span>📎 {x.attached(qa.attachment.title, qa.attachment.items.length)}</span>
                    <button type="button" className="asst-link" onClick={() => qa.setAttachment(null)}>
                      {x.detach}
                    </button>
                  </div>
                ) : (
                  <button type="button" className="asst-attach-btn" onClick={() => qa.setAttachment(pageContext(tab))} title={x.attachNote}>
                    + {x.attachScreen} ({x.pages[tab]})
                  </button>
                )}
                {qa.busy && !qa.pending && <p className="asst-note">{x.busyOther}</p>}
                <div className="asst-input">
                  <label htmlFor="asst-input" className="sr-only">
                    {x.placeholder}
                  </label>
                  <textarea
                    id="asst-input"
                    ref={inputRef}
                    rows={2}
                    value={qa.draft}
                    placeholder={x.placeholder}
                    maxLength={500}
                    onChange={(e) => qa.setDraft(e.target.value)}
                    onKeyDown={onKey}
                  />
                  <button type="submit" className="asst-send" disabled={!qa.draft.trim() || qa.busy} aria-label={x.send} title={x.send}>
                    {Icon.send}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
