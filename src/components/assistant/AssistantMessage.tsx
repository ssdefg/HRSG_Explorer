import type { Lang } from '@/types';
import type { QaMessage } from '@/context/Workspace';
import { useToast } from '@/context/Workspace';
import type { AnswerContext } from '@/components/qa/answers';
import { AnswerView, DemoAnswerBadge, LEGACY_TXT, fmtTime } from '@/components/qa/LegacyAnswer';
import { QA_FALLBACK_TEXT } from '@/data/qaPresets';
import { contextToText, type ContextSnapshot } from '@/lib/aiContext';
import { copyText } from '@/lib/clipboard';
import { findUnsupportedNumbers } from '@/lib/privacy';
import { formatNumber } from '@/lib/format';
import { Markdown } from './Markdown';
import { SourceCards, sourceAnchor } from './SourceCards';
import { ASSISTANT_TXT } from './strings';

type RagMsg = Extract<QaMessage, { kind: 'rag' }>;

function ContextChip({ ctx, lang }: { ctx: ContextSnapshot; lang: Lang }) {
  const x = ASSISTANT_TXT[lang];
  const v = (val: ContextSnapshot['items'][number]['value']) =>
    val === null ? '—' : typeof val === 'number' ? formatNumber(val, lang, Number.isInteger(val) ? 0 : 2) : val;
  return (
    <details className="asst-ctx">
      <summary>📎 {x.attached(ctx.title, ctx.items.length)}</summary>
      <dl className="asst-ctx__list">
        {ctx.items.map((it, i) => (
          <div key={i}>
            <dt>{it.label}</dt>
            <dd className="num">
              {v(it.value)}
              {it.unit ? ` ${it.unit}` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** [n] 인용을 누르면 해당 근거 카드를 펼치고 스크롤한다 */
function openSource(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('details')?.setAttribute('open', '');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

const NO_ANSWER: Record<Lang, Record<Exclude<RagMsg['llmStatus'], 'ok'>, string>> = {
  ko: {
    unavailable: 'Gemini API 키가 설정되지 않았습니다.',
    refusal: 'AI 모델이 답변을 거절했습니다.',
    error: 'AI 답변 생성 중 오류가 발생했습니다.',
  },
  en: {
    unavailable: 'The Gemini API key is not configured.',
    refusal: 'The AI model declined to answer.',
    error: 'An error occurred while generating the AI answer.',
  },
};

function RagAnswer({ msg, lang, question, convId }: { msg: RagMsg; lang: Lang; question?: string; convId: string }) {
  const x = ASSISTANT_TXT[lang];
  const toast = useToast();
  const key = `${convId}-${msg.id}`;
  const direct = msg.mode === 'direct';
  // 환각 가드 — 검색 상위 문단 · 첨부 화면 데이터 · 질문에 없는 수치 (가이드 §3.2)
  const unsupported = msg.answer
    ? findUnsupportedNumbers(msg.answer, [...msg.sources.map((s) => s.text), contextToText(msg.context), question ?? ''])
    : [];
  const copy = async () => {
    const src = msg.sources.map((s) => `[${s.rank}] ${s.title ?? s.file} p.${s.page}${s.doi ? ` doi:${s.doi}` : ''}`).join('\n');
    const ok = await copyText(`Q: ${question ?? ''}\n\nA: ${msg.answer ?? x.searchOnly}\n\n${src}`);
    toast.push(ok ? x.copied : x.copyFail, ok ? 'success' : 'error');
  };
  return (
    <article className="asst-ans" data-answer={direct ? 'direct' : 'rag'}>
      <header className="asst-ans__head">
        <span className="asst-ans__who">{x.ai}</span>
        <span className="asst-ans__meta">
          {direct
            ? `${msg.model ?? 'Gemini'} · ${x.directMeta(msg.sources.length)} · ${Math.round(msg.retrievalMs)}ms`
            : `${msg.model ?? (lang === 'ko' ? '검색 전용' : 'search only')} · ${x.sources(msg.sources.length)} · ${Math.round(msg.retrievalMs)}ms`}
        </span>
        <time className="asst-time" dateTime={msg.at}>
          {fmtTime(msg.at, lang)}
        </time>
      </header>
      {direct && msg.sources.length === 0 && msg.answer && <p className="asst-note asst-note--warn">{x.directNote}</p>}
      {unsupported.length > 0 && (
        <p className="asst-warn" role="alert" data-testid="unsupported-numbers">
          ⚠ {lang === 'ko' ? '출처 외 수치 포함 주의' : 'Contains figures not in sources'}: <span className="num">{unsupported.join(', ')}</span>
        </p>
      )}
      {msg.answer ? (
        <Markdown
          text={msg.answer}
          cite={(n) =>
            n >= 1 && n <= msg.sources.length ? (
              <button type="button" className="asst-cite" onClick={() => openSource(sourceAnchor(key, n))} aria-label={`${x.passage} ${n}`}>
                {n}
              </button>
            ) : (
              `[${n}]`
            )
          }
        />
      ) : (
        <p className="asst-note asst-note--warn">
          {!direct && x.searchOnly} {NO_ANSWER[lang][msg.llmStatus === 'ok' ? 'error' : msg.llmStatus]}
          {msg.llmMessage && ` (${msg.llmMessage})`}
        </p>
      )}
      {msg.sources.length > 0 && (
        <section className="asst-ans__sources" aria-label={x.sources(msg.sources.length)}>
          <p className="asst-ans__sources-title">{x.sources(msg.sources.length)}</p>
          <SourceCards sources={msg.sources} answer={msg.answer} lang={lang} msgKey={key} />
        </section>
      )}
      <footer className="asst-ans__foot">
        <button type="button" className="asst-link" onClick={copy}>
          {x.copy}
        </button>
      </footer>
    </article>
  );
}

export function AssistantMessage({
  msg,
  prevQuestion,
  lang,
  convId,
  legacyCtx,
  onRetry,
  retryDisabled,
}: {
  msg: QaMessage;
  prevQuestion?: string;
  lang: Lang;
  convId: string;
  legacyCtx: (snapshotId?: string) => AnswerContext;
  onRetry: (id: number) => void;
  retryDisabled: boolean;
}) {
  const x = ASSISTANT_TXT[lang];
  switch (msg.kind) {
    case 'question':
      return (
        <div className="asst-q">
          <div className="asst-q__bubble">
            <span className="sr-only">{x.you}: </span>
            {msg.text}
          </div>
          {msg.context && <ContextChip ctx={msg.context} lang={lang} />}
          <time className="asst-time" dateTime={msg.at}>
            {fmtTime(msg.at, lang)}
          </time>
        </div>
      );
    case 'rag':
      return <RagAnswer msg={msg} lang={lang} question={prevQuestion} convId={convId} />;
    case 'error':
      return (
        <article className="asst-ans asst-ans--error" role="alert">
          <p className="asst-note asst-note--warn">
            {msg.reason === 'server' ? LEGACY_TXT[lang].errorServer : LEGACY_TXT[lang].errorSnapshot}
          </p>
          {msg.reason === 'server' && msg.question && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRetry(msg.id)} disabled={retryDisabled}>
              {x.retry}
            </button>
          )}
        </article>
      );
    case 'answer':
      // 이전 버전의 사전 작성 시연용 답변 — 기록 보존용 표시
      return <AnswerView msg={msg} ctx={legacyCtx(msg.snapshotId)} x={LEGACY_TXT[lang]} />;
    case 'fallback':
      return (
        <article className="asst-ans asst-ans--legacy">
          <DemoAnswerBadge text={LEGACY_TXT[lang].demoBadge} />
          <p className="asst-note">{QA_FALLBACK_TEXT[lang]}</p>
        </article>
      );
  }
}
