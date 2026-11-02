import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Lang } from '@/types';
import { Card, DataTypeBadges } from '@/components/ui';
import { ReceiptStatusBadge, RECEIPT_LABEL } from '@/components/ui/ReceiptStatusBadge';
import { useAppSettings } from '@/context/AppSettings';
import {
  useCalculator,
  useCases,
  useChecklist,
  useHistory,
  useMeasurements,
  useQa,
  useToast,
  type QaMessage,
} from '@/context/Workspace';
import { QA_CATEGORIES, QA_CATEGORY_LABEL, QA_FALLBACK_TEXT, QA_PRESETS, type QaCategory } from '@/data/qaPresets';
import { CHECKLIST_ITEMS } from '@/data/checklistItems';
import { SECTION_IDS, TABS } from '@/data/tabs';
import { goToTab } from '@/lib/useHashTab';
import { qaHistory, qaSourceKey, type QaHistoryAnswer } from '@/lib/qaHistory';
import { buildAnswer, type AnswerContext, type SourceKind } from '@/components/qa/answers';
import { RagAnswerView, RagBadge, ragHistoryAnswer } from '@/components/qa/RagAnswerView';
import { fetchRagHealth, type RagHealth } from '@/lib/ragClient';

const TXT = {
  ko: {
    sectionTitle: 'AI 질의응답',
    sectionDesc: 'HRSG 운전 상태, 성능 저하, 세정 방식, 경제성, 추가 데이터 요청에 관해 질문합니다. 추천 질문과 직접 입력한 질문 모두 HRSG 참고문헌에서 관련 문단을 검색해 AI가 출처와 함께 답변합니다.',
    panelTitle: 'AI Engineering Assistant',
    panelSub: '운전 상태, 성능 저하 원인, 세정 경제성을 질문하세요.',
    notice: {
      on: (h: RagHealth) =>
        `추천 질문과 직접 입력한 질문 모두 HRSG 참고문헌 ${h.docs}편(${h.passages}개 문단)에서 관련 문단 8개를 검색해 AI가 실시간으로 답변하고 출처를 표시합니다. 기업 제공 문서는 아직 포함되지 않았습니다.`,
      off: 'RAG 서버(server/app.py)가 실행 중이 아니어서 참고문헌 검색·AI 답변을 쓸 수 없습니다. 추천 질문 또는 입력 문장과 일치하는 사전 작성 시연용 답변만 표시합니다.',
    },
    demoBadge: '시연용 답변 · 실제 AI/RAG 미연동',
    convTitle: '대화',
    convSub: '현재 케이스의 대화 기록 — 케이스마다 따로 저장됩니다.',
    convEmpty: '추천 질문을 선택하거나 아래에 질문을 입력하세요.',
    placeholder: '질문을 입력하세요 (예: 배압이 오르면 성능에 어떤 영향이 있나요?)',
    send: '전송',
    sendHint: 'Enter 전송 · Shift+Enter 줄바꿈',
    clear: '대화 초기화',
    you: '질문',
    pending: '답변을 준비하는 중…',
    attached: (n: number) => `첨부: 계산 결과 스냅샷 #${n}`,
    detach: '첨부 해제',
    viaPreset: '추천 질문에 대한 사전 작성 답변',
    viaExact: '준비된 질문과 일치하는 사전 작성 답변',
    viaKeyword: (q: string) => `입력 문장과 가장 가까운 준비 질문에 대한 답변: “${q}”`,
    viaSnapshot: (n: number) => `계산기에서 전달된 결과 스냅샷 #${n}에 대한 해설`,
    snapshotTitle: '계산 결과 해설',
    fallbackTitle: '준비된 시연용 답변 없음',
    errorTitle: '오류',
    errorSnapshot: '참조한 계산 결과 스냅샷을 찾을 수 없습니다. 계산기에서 다시 "이 결과 질문하기"를 눌러 주세요.',
    s1: '핵심 개념 및 요약',
    s2: '계산기 연동 수치 요약',
    s3: '공학적 원인 및 근거',
    s4: '추가 필요 데이터',
    s5: '출처 / 자료명',
    s6: '관련 화면 바로가기',
    noFacts: '이 질문에 연동되는 계산 수치가 없습니다.',
    viewItem: '체크리스트에서 보기',
    noNeeds: '현재 추가로 표시할 항목이 없습니다.',
    open: (tab: string) => `${tab} 열기 →`,
    presetsTitle: '추천 질문',
    presetsSub: {
      on: '선택하면 질문이 바로 전송되고, 참고문헌 RAG 검색으로 실시간 AI 답변을 생성합니다.',
      off: '선택하면 사전 작성된 시연용 답변이 표시됩니다 (RAG 서버 미연결).',
    },
    reliTitle: '데이터 출처 및 신뢰성',
    reliRows: (h: RagHealth | null): [string, string][] => [
      ['AI 모델', h ? h.model : '미연동 (RAG 서버 꺼짐)'],
      ['RAG · 문서 검색', h ? `HRSG 참고문헌 ${h.docs}편 · ${h.passages}개 문단 · BGE-M3 + BM25 (RRF)` : '미연동 (RAG 서버 꺼짐)'],
      ['클라우드라 제공 기술 문서', '미수령 · 인용 없음'],
      ['답변 방식', h ? '추천·직접 질문 모두 참고문헌 검색(RAG) + AI 생성' : '사전 작성 답변 + 키워드 매칭'],
      ['답변 속 수치', '현재 케이스의 최신 유효 계산 결과만 인용'],
    ],
    dataTitle: '추가 데이터 안내',
    dataBody: (rec: number, total: number, req: number) =>
      `데이터 요청 체크리스트 기준 수령 ${rec}/${total}개, 요청 필요로 표시된 항목 ${req}개입니다. 실측 데이터가 확보되기 전까지 답변의 수치는 가상 데이터와 예시 계산입니다.`,
    sessionNote: '대화 기록은 케이스별로 이 브라우저(localStorage)에만 저장되며 다른 사용자와 공유되지 않습니다.',
    notFound: '관련 체크리스트 항목을 찾을 수 없습니다.',
    src: {
      unregistered: '검증된 출처 미등록 — 자료명·페이지가 확인된 출처가 없습니다',
      general: '일반적인 HRSG 개념 설명 — 클라우드라 제공 문서 아님',
      calcInputs: '계산기 입력값 — 가상 데이터 또는 사용자 입력',
      engine: '중앙 계산 엔진 (src/lib/calc.ts) — 예시 계산',
      cleaningMock: '세정 공법 비교 데이터 — 가상 데이터',
      checklist: '데이터 요청 체크리스트 — 현재 케이스 상태',
      scenario: '세정 전후 시나리오 — 가상 시나리오',
      snapshot: '계산 결과 스냅샷 — 현재 케이스 분석 이력',
    } satisfies Record<SourceKind, string>,
  },
  en: {
    sectionTitle: 'AI Q&A',
    sectionDesc: 'Ask about HRSG operation, degradation, cleaning methods, economics and data requests. Both suggested and typed questions are answered by AI from retrieved HRSG reference passages, with sources.',
    panelTitle: 'AI Engineering Assistant',
    panelSub: 'Ask about operating status, causes of performance loss, and cleaning economics.',
    notice: {
      on: (h: RagHealth) =>
        `Both suggested and typed questions retrieve 8 passages from ${h.docs} HRSG references (${h.passages} passages) and are answered by AI in real time, with sources. Partner documents are not included yet.`,
      off: 'The RAG server (server/app.py) is not running, so reference search and AI answers are unavailable. Only pre-written demo answers matching a suggested question or your sentence are shown.',
    },
    demoBadge: 'Demo answer · AI/RAG not connected',
    convTitle: 'Conversation',
    convSub: 'Conversation of the current case — stored per case.',
    convEmpty: 'Pick a suggested question or type a question below.',
    placeholder: 'Type a question (e.g., How does rising back pressure affect performance?)',
    send: 'Send',
    sendHint: 'Enter to send · Shift+Enter for newline',
    clear: 'Clear conversation',
    you: 'Question',
    pending: 'Preparing the answer…',
    attached: (n: number) => `Attached: calculation snapshot #${n}`,
    detach: 'Remove attachment',
    viaPreset: 'Pre-written answer to a suggested question',
    viaExact: 'Pre-written answer matching a prepared question',
    viaKeyword: (q: string) => `Answer to the closest prepared question: “${q}”`,
    viaSnapshot: (n: number) => `Explanation of result snapshot #${n} sent from the calculator`,
    snapshotTitle: 'Calculation result explanation',
    fallbackTitle: 'No prepared demo answer',
    errorTitle: 'Error',
    errorSnapshot: 'The referenced calculation snapshot could not be found. Press "Ask about this result" again in the calculator.',
    s1: 'Key concept & summary',
    s2: 'Linked calculator figures',
    s3: 'Engineering cause & basis',
    s4: 'Additional data needed',
    s5: 'Sources',
    s6: 'Related screens',
    noFacts: 'No calculator figures are linked to this question.',
    viewItem: 'View in checklist',
    noNeeds: 'Nothing additional to show right now.',
    open: (tab: string) => `Open ${tab} →`,
    presetsTitle: 'Suggested questions',
    presetsSub: {
      on: 'Selecting one sends it right away and generates a real-time AI answer from reference search (RAG).',
      off: 'Selecting one shows a pre-written demo answer (RAG server not connected).',
    },
    reliTitle: 'Data source & reliability',
    reliRows: (h: RagHealth | null): [string, string][] => [
      ['AI model', h ? h.model : 'Not connected (RAG server off)'],
      ['RAG · document search', h ? `${h.docs} HRSG references · ${h.passages} passages · BGE-M3 + BM25 (RRF)` : 'Not connected (RAG server off)'],
      ['클라우드라 technical documents', 'Not received · not cited'],
      ['Answer method', h ? 'Suggested and typed: reference search (RAG) + AI' : 'Pre-written answers + keyword matching'],
      ['Figures in answers', 'Only the latest valid result of the current case'],
    ],
    dataTitle: 'Additional data',
    dataBody: (rec: number, total: number, req: number) =>
      `Checklist: ${rec}/${total} items received, ${req} marked as request needed. Until measured data arrives, figures in answers are mock data and example calculations.`,
    sessionNote: 'Conversations are stored per case only in this browser (localStorage) and are not shared with other users.',
    notFound: 'The related checklist item could not be found.',
    src: {
      unregistered: 'No verified source registered — no document title or page has been confirmed',
      general: 'General HRSG concepts — not a 클라우드라 document',
      calcInputs: 'Calculator inputs — mock data or user input',
      engine: 'Central calculation engine (src/lib/calc.ts) — example calc',
      cleaningMock: 'Cleaning method comparison data — mock data',
      checklist: 'Data request checklist — current case state',
      scenario: 'Pre/post cleaning scenario — mock scenario',
      snapshot: 'Calculation snapshot — current case analysis history',
    } satisfies Record<SourceKind, string>,
  },
};

type Txt = (typeof TXT)[Lang];

export function DemoAnswerBadge({ text }: { text: string }) {
  return (
    <span className="badge badge--demo-ai" title={text}>
      <span aria-hidden="true">!</span>
      {text}
    </span>
  );
}

function fmtTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** 답변이 어떤 방식으로 선택됐는지 표시하는 문구 */
function viaText(msg: Extract<QaMessage, { kind: 'answer' }>, ctx: AnswerContext, x: Txt): string {
  const preset = QA_PRESETS.find((p) => p.id === msg.answerId);
  return msg.via === 'snapshot'
    ? x.viaSnapshot(ctx.snapshot?.seq ?? 0)
    : msg.via === 'preset'
      ? x.viaPreset
      : msg.via === 'exact'
        ? x.viaExact
        : x.viaKeyword(preset?.question[ctx.lang] ?? '');
}

/**
 * 질문 기록용 — 화면에 표시되는 답변을 같은 구성(①~⑥)의 텍스트로 옮긴다.
 * 답변 생성 로직(buildAnswer)은 그대로 쓰고, 결과를 기록 시점 값으로 고정해 저장한다.
 */
function toHistoryAnswer(msg: Exclude<QaMessage, { kind: 'question' }>, ctx: AnswerContext, x: Txt): QaHistoryAnswer {
  const { lang } = ctx;
  if (msg.kind === 'rag') return ragHistoryAnswer(msg, lang);
  if (msg.kind === 'fallback') return { kind: 'fallback', title: x.fallbackTitle, blocks: [{ title: '', lines: [QA_FALLBACK_TEXT[lang]] }] };
  if (msg.kind === 'error') return { kind: 'error', title: x.errorTitle, blocks: [{ title: '', lines: [x.errorSnapshot] }] };
  const a = buildAnswer(msg.answerId, ctx);
  const preset = QA_PRESETS.find((p) => p.id === msg.answerId);
  const blocks: QaHistoryAnswer['blocks'] = [
    { title: `1. ${x.s1}`, lines: a.summary },
    {
      title: `2. ${x.s2}`,
      caption: a.factsCaption,
      notice: a.factsNotice,
      facts: a.facts.map((f) => ({ label: f.label, value: f.value, status: f.status, types: f.types })),
      lines: a.facts.length === 0 && !a.factsNotice ? [x.noFacts] : undefined,
    },
  ];
  if (a.basis.length > 0) blocks.push({ title: `3. ${x.s3}`, lines: a.basis });
  blocks.push({
    title: `4. ${x.s4}`,
    lines:
      a.needs.length === 0
        ? [x.noNeeds]
        : a.needs.flatMap((n) => {
            const item = CHECKLIST_ITEMS.find((i) => i.id === n.itemId);
            return item ? [`${item.name[lang]} — ${RECEIPT_LABEL[lang][ctx.checklist.status[n.itemId] ?? 'noMeasured']}`] : [];
          }),
  });
  blocks.push({ title: `5. ${x.s5}`, lines: a.sources.map((s) => x.src[s]) });
  blocks.push({ title: `6. ${x.s6}`, lines: a.links.map((l) => l.label ?? TABS.find((t) => t.id === l.tab)?.label[lang] ?? l.tab) });
  return {
    kind: 'answer',
    title: msg.answerId === 'resultSummary' ? x.snapshotTitle : (preset?.question[lang] ?? ''),
    via: viaText(msg, ctx, x),
    blocks,
  };
}

function AnswerView({ msg, ctx, x }: { msg: Extract<QaMessage, { kind: 'answer' }>; ctx: AnswerContext; x: Txt }) {
  const { lang } = ctx;
  const cl = ctx.checklist;
  const toast = useToast();
  const a = buildAnswer(msg.answerId, ctx);
  const preset = QA_PRESETS.find((p) => p.id === msg.answerId);
  const via = viaText(msg, ctx, x);

  const openItem = (itemId: string) => {
    if (!CHECKLIST_ITEMS.some((i) => i.id === itemId)) {
      toast.push(x.notFound, 'error');
      return;
    }
    cl.requestFocus(itemId);
    goToTab('checklist');
  };

  return (
    <article className="qa-answer" data-answer={msg.answerId}>
      <header className="qa-answer__head">
        <DemoAnswerBadge text={x.demoBadge} />
        <span className="qa-answer__via">{via}</span>
        <time className="qa-time" dateTime={msg.at}>
          {fmtTime(msg.at, lang)}
        </time>
      </header>
      <h4 className="qa-answer__title">{msg.answerId === 'resultSummary' ? x.snapshotTitle : preset?.question[lang]}</h4>

      <section className="qa-answer__block">
        <p className="qa-answer__block-title">1. {x.s1}</p>
        {a.summary.map((p) => (
          <p key={p} className="qa-answer__p">
            {p}
          </p>
        ))}
      </section>

      <section className="qa-answer__block">
        <p className="qa-answer__block-title">
          2. {x.s2}
          {a.factsCaption && <span className="qa-answer__caption"> · {a.factsCaption}</span>}
        </p>
        {a.factsNotice && <p className="note note--warn">{a.factsNotice}</p>}
        {a.facts.length > 0 ? (
          <ul className="qa-facts">
            {a.facts.map((f) => (
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
        ) : (
          !a.factsNotice && <p className="note">{x.noFacts}</p>
        )}
      </section>

      {a.basis.length > 0 && (
        <details className="qa-answer__basis">
          <summary>3. {x.s3}</summary>
          <ul>
            {a.basis.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </details>
      )}

      <section className="qa-answer__block">
        <p className="qa-answer__block-title">4. {x.s4}</p>
        {a.needs.length === 0 ? (
          <p className="note">{x.noNeeds}</p>
        ) : (
          <ul className="qa-needs">
            {a.needs.map((n) => {
              const item = CHECKLIST_ITEMS.find((i) => i.id === n.itemId);
              if (!item) return null;
              return (
                <li key={n.itemId} className="qa-need">
                  <span className="qa-need__name">{item.name[lang]}</span>
                  <ReceiptStatusBadge status={cl.status[n.itemId] ?? 'noMeasured'} />
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => openItem(n.itemId)} data-goto-item={n.itemId}>
                    {x.viewItem}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="qa-answer__block">
        <p className="qa-answer__block-title">5. {x.s5}</p>
        <ul className="qa-sources">
          {a.sources.map((s) => (
            <li key={s} className={s === 'unregistered' ? 'qa-sources__warn' : undefined}>
              {x.src[s]}
            </li>
          ))}
        </ul>
      </section>

      <section className="qa-answer__block">
        <p className="qa-answer__block-title">6. {x.s6}</p>
        <div className="qa-answer__links">
          {a.links.map((l) => {
            const def = TABS.find((t) => t.id === l.tab);
            return (
              <button
                key={`${l.tab}-${l.section ?? ''}`}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => goToTab(l.tab, { section: l.section })}
              >
                {x.open(l.label ?? def?.label[lang] ?? l.tab)}
              </button>
            );
          })}
        </div>
      </section>
    </article>
  );
}

/**
 * AI 질의응답 — 대시보드 중단 우측의 컴팩트 AI 카드 (기존 독립 화면의 내용을 그대로 옮김).
 * 대화(케이스별)와 별도로, 새 답변이 나오면 질문·답변을 질문 기록(qaHistory)에 저장한다.
 */
export function AiQaSection() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const calc = useCalculator();
  const checklist = useChecklist();
  const measurements = useMeasurements();
  const history = useHistory();
  const qa = useQa();
  const cases = useCases();
  const logRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const attachedSnap = qa.attachment ? history.getSnapshot(qa.attachment) : undefined;
  // 추천 질문 카테고리 탭 선택 (화면 표시용 상태)
  const [presetCat, setPresetCat] = useState<QaCategory>(QA_CATEGORIES[0]);
  // RAG 서버 연결 상태 — 안내 문구와 '데이터 출처 및 신뢰성' 표에 반영 (null = 미연결)
  const [rag, setRag] = useState<RagHealth | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRagHealth().then((h) => alive && setRag(h));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [qa.messages.length, qa.pending]);

  // 계산기에서 넘어온 초안이 있으면 입력창에 포커스
  useEffect(() => {
    if (qa.draft) inputRef.current?.focus();
  }, [qa.draft]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = qa.draft.trim();
    if (!text || qa.pending) return;
    qa.askFree(text, lang);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const ctxFor = (snapshotId?: string): AnswerContext => ({
    lang,
    calc,
    checklist,
    measurements,
    snapshot: snapshotId ? history.getSnapshot(snapshotId) : undefined,
  });

  // 질문 기록 저장 — 기록 기능 도입 이후에 나온 답변 중 아직 기록되지 않은 것만 저장한다
  const caseId = cases.current.id;
  const caseName = cases.current.name;
  useEffect(() => {
    const since = qaHistory.trackingSince();
    const msgs = qa.messages;
    msgs.forEach((m, i) => {
      if (m.kind === 'question' || m.at < since) return;
      const key = qaSourceKey(caseId, m.id, m.at);
      if (qaHistory.isRecorded(key)) return;
      const q = msgs
        .slice(0, i)
        .reverse()
        .find((p): p is Extract<QaMessage, { kind: 'question' }> => p.kind === 'question');
      qaHistory.add({
        id: `qh-${m.at}-${m.id}`,
        sourceKey: key,
        caseId,
        caseName,
        lang,
        question: q?.text ?? '',
        askedAt: q?.at ?? m.at,
        answeredAt: m.at,
        answer: toHistoryAnswer(m, ctxFor(m.kind === 'answer' ? m.snapshotId : undefined), x),
      });
    });
    // 새 메시지가 생길 때만 확인한다 (언어·계산값 변경으로 기록을 다시 만들지 않음)
  }, [qa.messages, caseId]);

  // 추천 질문 — 사이드 패널. 카테고리 탭(기존 분류명) + 질문 원문 알약 버튼 (세로 정렬)
  const presetPills = () => (
    <div className="qa-pills">
      <div className="qa-pills__head">
        <span className="qa-pills__title" title={rag ? x.presetsSub.on : x.presetsSub.off}>
          {x.presetsTitle}
        </span>
        <div className="qa-pills__cats" role="group" aria-label={x.presetsTitle}>
          {QA_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className="qa-pills__cat"
              aria-pressed={presetCat === cat}
              onClick={() => setPresetCat(cat)}
            >
              {QA_CATEGORY_LABEL[cat][lang]}
            </button>
          ))}
        </div>
      </div>
      <div className="qa-pills__list" role="group" aria-label={QA_CATEGORY_LABEL[presetCat][lang]}>
        {QA_PRESETS.filter((p) => p.category === presetCat).map((p) => (
          <button
            key={p.id}
            type="button"
            className="qa-pill"
            disabled={qa.pending}
            onClick={() => qa.askPreset(p.id, p.question[lang], lang)}
            data-preset={p.id}
          >
            {p.question[lang]}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="dash-ai" id={SECTION_IDS.ai} aria-labelledby="dash-ai-title" data-testid="dash-ai">
      <Card className="ai-panel">
        <header className="ai-panel__head">
          <div className="ai-panel__titles">
            <h3 className="ai-panel__title" id="dash-ai-title" title={x.panelSub}>
              {x.panelTitle}
            </h3>
            <span className="ai-panel__badges">
              <DataTypeBadges types={['mock', 'example', 'planned']} />
            </span>
          </div>
          <div className="ai-panel__tools">
            {/* AI/RAG 연결 상태 — 6px 점 + 간결한 텍스트 (상세 안내는 아래 '데이터 출처 및 신뢰성') */}
            <span
              className={`ai-status ${rag ? 'ai-status--on' : 'ai-status--off'}`}
              role="note"
              title={rag ? x.notice.on(rag) : x.notice.off}
            >
              {rag ? <RagBadge lang={lang} /> : <DemoAnswerBadge text={x.demoBadge} />}
            </span>
            {qa.messages.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm dash-ai__clear" onClick={qa.clear}>
                {x.clear}
              </button>
            )}
          </div>
        </header>

        <div className="ai-panel__grid">
          {/* 메인 챗: 대화 표시창 바로 아래에 입력창을 붙여 하나의 챗 UI로 */}
          <div className="ai-chat">
            <ol className="qa-log" ref={logRef} aria-live="polite" aria-label={x.convTitle}>
              {qa.messages.length === 0 && !qa.pending && <li className="qa-log__empty">{x.convEmpty}</li>}
              {qa.messages.map((m) => (
                <li key={m.id} className={`qa-log__item qa-log__item--${m.kind}`}>
                  {m.kind === 'question' && (
                    <div className="qa-question">
                      <span className="sr-only">{x.you}: </span>
                      <span className="qa-question__text">{m.text}</span>
                      <time className="qa-time qa-time--q" dateTime={m.at}>
                        {fmtTime(m.at, lang)}
                      </time>
                    </div>
                  )}
                  {m.kind === 'answer' && <AnswerView msg={m} ctx={ctxFor(m.snapshotId)} x={x} />}
                  {m.kind === 'rag' && (
                    <RagAnswerView
                      msg={m}
                      lang={lang}
                      time={
                        <time className="qa-time" dateTime={m.at}>
                          {fmtTime(m.at, lang)}
                        </time>
                      }
                    />
                  )}
                  {m.kind === 'fallback' && (
                    <article className="qa-answer qa-answer--fallback">
                      <header className="qa-answer__head">
                        <DemoAnswerBadge text={x.demoBadge} />
                        <time className="qa-time" dateTime={m.at}>
                          {fmtTime(m.at, lang)}
                        </time>
                      </header>
                      <p className="qa-answer__title">{x.fallbackTitle}</p>
                      <p className="qa-answer__p" data-testid="fallback-text">
                        {QA_FALLBACK_TEXT[lang]}
                      </p>
                      <div className="qa-answer__links">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => goToTab('calculator')}>
                          {x.open(TABS.find((t) => t.id === 'calculator')?.label[lang] ?? '')}
                        </button>
                      </div>
                    </article>
                  )}
                  {m.kind === 'error' && (
                    <article className="qa-answer qa-answer--error" role="alert">
                      <header className="qa-answer__head">
                        <DemoAnswerBadge text={x.demoBadge} />
                        <span className="qa-answer__via">{x.errorTitle}</span>
                      </header>
                      <p className="qa-answer__p">{x.errorSnapshot}</p>
                    </article>
                  )}
                </li>
              ))}
              {qa.pending && (
                <li className="qa-log__item qa-log__pending" role="status">
                  <span className="qa-spinner" aria-hidden="true" />
                  {x.pending}
                </li>
              )}
            </ol>
            <form className="qa-form" onSubmit={submit}>
              {attachedSnap && (
                <p className="qa-attach">
                  <span>{x.attached(attachedSnap.seq)}</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => qa.setAttachment(null)}>
                    {x.detach}
                  </button>
                </p>
              )}
              <label htmlFor="qa-input" className="sr-only">
                {x.placeholder}
              </label>
              <div className="qa-input">
                <textarea
                  id="qa-input"
                  ref={inputRef}
                  className="qa-form__input"
                  rows={1}
                  value={qa.draft}
                  placeholder={x.placeholder}
                  onChange={(e) => qa.setDraft(e.target.value)}
                  onKeyDown={onKey}
                  maxLength={500}
                  aria-describedby="qa-input-hint"
                />
                <button type="submit" className="qa-send" disabled={!qa.draft.trim() || qa.pending} aria-label={x.send} title={x.send}>
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <p className="sr-only" id="qa-input-hint">
                {x.sendHint} · {x.convSub}
              </p>
            </form>
          </div>

          {/* 사이드: 추천 질문 패널 */}
          <aside className="ai-side">
            {presetPills()}
          </aside>
        </div>

        {/* 기존 안내·신뢰성 표·추가 데이터 안내 — 내용 그대로, 접어서 보관 */}
        <details className="ai-info">
          <summary className="ai-info__summary">
            {x.reliTitle}
            <DataTypeBadges types={['planned']} />
          </summary>
          <div className="ai-info__body">
            <p className="ai-info__text">{x.sectionDesc}</p>
            <p className="ai-info__text">{rag ? x.notice.on(rag) : x.notice.off}</p>
            <p className="ai-info__text">{rag ? x.presetsSub.on : x.presetsSub.off}</p>
            <dl className="reli-list">
              {x.reliRows(rag).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="note">{x.sessionNote}</p>
            <div className="ai-info__data">
              <h4 className="ai-info__heading">
                {x.dataTitle} <DataTypeBadges types={['noMeasured']} />
              </h4>
              <p className="qa-side__text">
                {x.dataBody(checklist.summary.receivedCount, checklist.summary.total, checklist.summary.byStatus.requestNeeded)}
              </p>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => goToTab('checklist')}>
                {x.open(TABS.find((t) => t.id === 'checklist')?.label[lang] ?? '')}
              </button>
            </div>
          </div>
        </details>
      </Card>

    </section>
  );
}
