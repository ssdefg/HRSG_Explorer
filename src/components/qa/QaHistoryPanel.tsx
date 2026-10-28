import { useState } from 'react';
import type { Lang } from '@/types';
import { Card, DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';
import { useToast } from '@/context/Workspace';
import { qaHistory, useQaHistory, type QaHistoryRecord } from '@/lib/qaHistory';
import { RagBadge } from '@/components/qa/RagAnswerView';

const TXT = {
  ko: {
    title: '질문 기록',
    sub: '질문과 답변을 답변 당시 내용 그대로 저장합니다 · 최신순',
    demoBadge: '시연용 답변 · 실제 AI/RAG 미연동',
    storage:
      '질문 기록은 이 브라우저(localStorage)에만 저장됩니다. 새로고침하거나 다시 실행해도 유지되지만, 다른 브라우저·기기·사용자와 공유되지 않습니다. 기업 기밀 데이터는 입력하지 마십시오.',
    count: (n: number) => `${n}건`,
    show: '기록 펼치기',
    hide: '기록 접기',
    empty: '저장된 질문 기록이 없습니다. 위에서 질문하면 답변과 함께 여기에 기록됩니다.',
    clearAll: '전체 삭제',
    confirmAll: (n: number) => `질문 기록 ${n}건을 모두 삭제할까요? 되돌릴 수 없습니다.`,
    confirmYes: '전체 삭제 확인',
    cancel: '취소',
    remove: '삭제',
    removeAria: (q: string) => `질문 기록 삭제: ${q}`,
    removed: '질문 기록을 삭제했습니다.',
    clearedAll: '질문 기록을 모두 삭제했습니다.',
    asked: '질문 일시',
    answered: '답변 일시',
    caseLabel: '케이스',
    question: '질문',
    answer: 'AI 답변',
    noQuestion: '(질문 문장 없음)',
    langNote: (l: Lang) => (l === 'ko' ? '' : '기록 당시 화면 언어: English'),
    recordedNote: '기록 시점의 답변입니다. 이후 계산 입력이 바뀌어도 이 내용은 바뀌지 않습니다.',
  },
  en: {
    title: 'Question history',
    sub: 'Questions and answers saved as shown at the time · newest first',
    demoBadge: 'Demo answer · AI/RAG not connected',
    storage:
      'History is stored only in this browser (localStorage). It survives refresh and restart but is not shared with other browsers, devices or users. Do not enter confidential company data.',
    count: (n: number) => `${n}`,
    show: 'Show history',
    hide: 'Hide history',
    empty: 'No saved questions yet. Ask a question above and it will be recorded here with its answer.',
    clearAll: 'Delete all',
    confirmAll: (n: number) => `Delete all ${n} history records? This cannot be undone.`,
    confirmYes: 'Confirm delete all',
    cancel: 'Cancel',
    remove: 'Delete',
    removeAria: (q: string) => `Delete history record: ${q}`,
    removed: 'History record deleted.',
    clearedAll: 'All history records deleted.',
    asked: 'Asked',
    answered: 'Answered',
    caseLabel: 'Case',
    question: 'Question',
    answer: 'AI answer',
    noQuestion: '(no question text)',
    langNote: (l: Lang) => (l === 'en' ? '' : 'Recorded in: 한국어'),
    recordedNote: 'Answer as recorded at the time. Later input changes do not alter it.',
  },
};

function fmtDateTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

function RecordDetail({ r, lang }: { r: QaHistoryRecord; lang: Lang }) {
  const x = TXT[lang];
  const langNote = x.langNote(r.lang);
  return (
    <div className="qa-hist__detail" data-testid="qa-hist-detail">
      <dl className="kv-list-compact">
        <div>
          <dt>{x.asked}</dt>
          <dd className="num">{fmtDateTime(r.askedAt, lang)}</dd>
        </div>
        <div>
          <dt>{x.answered}</dt>
          <dd className="num">{fmtDateTime(r.answeredAt, lang)}</dd>
        </div>
        <div>
          <dt>{x.caseLabel}</dt>
          <dd>{r.caseName}</dd>
        </div>
      </dl>

      <p className="qa-hist__label">{x.question}</p>
      <p className="qa-hist__question">{r.question || x.noQuestion}</p>

      <p className="qa-hist__label">{x.answer}</p>
      <article className={`qa-answer${r.answer.kind === 'fallback' ? ' qa-answer--fallback' : r.answer.kind === 'error' ? ' qa-answer--error' : ''}`}>
        <header className="qa-answer__head">
          {r.answer.kind === 'rag' ? (
            <RagBadge lang={lang} />
          ) : (
            <span className="badge badge--demo-ai" title={x.demoBadge}>
              <span aria-hidden="true">!</span>
              {x.demoBadge}
            </span>
          )}
          {r.answer.via && <span className="qa-answer__via">{r.answer.via}</span>}
        </header>
        <h4 className="qa-answer__title">{r.answer.title}</h4>
        {r.answer.blocks.map((b, i) => (
          <section key={`${b.title}-${i}`} className="qa-answer__block">
            {b.title && (
              <p className="qa-answer__block-title">
                {b.title}
                {b.caption && <span className="qa-answer__caption"> · {b.caption}</span>}
              </p>
            )}
            {b.notice && <p className="note note--warn">{b.notice}</p>}
            {b.facts && b.facts.length > 0 && (
              <ul className="qa-facts">
                {b.facts.map((f) => (
                  <li key={f.label}>
                    <span className="qa-facts__label">{f.label}</span>
                    <strong className="qa-facts__value num">{f.value}</strong>
                    <span className="badge-row">
                      {f.status && <span className="metric-tag metric-tag--invalid">{f.status}</span>}
                      <DataTypeBadges types={f.types} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {b.lines && b.lines.length > 0 && (
              <ul className="qa-hist__lines">
                {b.lines.map((l, j) => (
                  <li key={`${j}-${l}`}>{l}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
      <p className="note">
        {x.recordedNote}
        {langNote && ` · ${langNote}`}
      </p>
    </div>
  );
}

/** AI 질의응답 아래에 붙는 질문 기록 — 목록은 접기/펼치기, 길어지면 스크롤 */
export function QaHistoryPanel() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const toast = useToast();
  const records = useQaHistory();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const remove = (r: QaHistoryRecord) => {
    qaHistory.remove(r.id);
    if (selected === r.id) setSelected(null);
    toast.push(x.removed, 'info');
  };

  const clearAll = () => {
    qaHistory.clear();
    setSelected(null);
    setConfirmAll(false);
    toast.push(x.clearedAll, 'info');
  };

  return (
    <Card
      className="qa-hist"
      id="qa-history"
      title={
        <>
          {x.title} <span className="qa-hist__count num">{x.count(records.length)}</span>
        </>
      }
      subtitle={x.sub}
      badges={<DataTypeBadges types={['userInput', 'mock']} />}
    >
      <p className="note">{x.storage}</p>

      <div className="qa-hist__toolbar">
        <button type="button" className="btn btn--ghost btn--sm" aria-expanded={open} aria-controls="qa-hist-list" onClick={() => setOpen((o) => !o)}>
          {open ? x.hide : x.show}
        </button>
        {records.length > 0 &&
          (confirmAll ? (
            <span className="qa-hist__confirm" role="alert">
              <span>{x.confirmAll(records.length)}</span>
              <button type="button" className="btn btn--danger btn--sm" onClick={clearAll} data-testid="qa-hist-confirm-all">
                {x.confirmYes}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmAll(false)}>
                {x.cancel}
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmAll(true)} data-testid="qa-hist-clear-all">
              {x.clearAll}
            </button>
          ))}
      </div>

      {open && (
        <div id="qa-hist-list">
          {records.length === 0 ? (
            <p className="empty-state" data-testid="qa-hist-empty">
              {x.empty}
            </p>
          ) : (
            <ul className="qa-hist__list" data-testid="qa-hist-list">
              {records.map((r) => {
                const isOpen = selected === r.id;
                return (
                  <li key={r.id} className={`qa-hist__item${isOpen ? ' is-open' : ''}`}>
                    <div className="qa-hist__row">
                      <button
                        type="button"
                        className="qa-hist__open"
                        aria-expanded={isOpen}
                        onClick={() => setSelected(isOpen ? null : r.id)}
                        data-testid="qa-hist-open"
                      >
                        <span className="qa-hist__q">{r.question || x.noQuestion}</span>
                        <span className="qa-hist__meta">
                          <time className="num" dateTime={r.askedAt}>
                            {fmtDateTime(r.askedAt, lang)}
                          </time>
                          <span>· {r.caseName}</span>
                          {r.answer.title !== r.question && <span>· {r.answer.title}</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => remove(r)}
                        aria-label={x.removeAria(r.question)}
                        data-testid="qa-hist-remove"
                      >
                        {x.remove}
                      </button>
                    </div>
                    {isOpen && <RecordDetail r={r} lang={lang} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
