import { useEffect, useMemo, useState } from 'react';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { Card, DataTypeBadges, SegmentedToggle } from '@/components/ui';
import {
  ReceiptStatusBadge,
  RECEIPT_LABEL,
  RECEIPT_STATUSES,
  VERIFY_LABEL_L,
  VERIFY_STATUSES,
  isReceiptStatus,
  isVerifyStatus,
} from '@/components/ui/ReceiptStatusBadge';
import { useAppSettings } from '@/context/AppSettings';
import { useChecklist, useToast } from '@/context/Workspace';
import { CHECKLIST_CATEGORIES, CHECKLIST_CATEGORY_LABEL, CHECKLIST_ITEMS, type Priority } from '@/data/checklistItems';
import { PENDING_STATUSES, RECEIVED_STATUSES, type ProgressStats } from '@/lib/checklistStats';
import { buildRequestEmail, emailBodyToHtml } from '@/lib/emailDraft';
import { copyText } from '@/lib/clipboard';
import { AskAiButton } from '@/components/assistant/AskAiButton';
import { formatNumber } from '@/lib/format';

type Filter = 'all' | 'pending' | 'received';

const TXT = {
  ko: {
    notice:
      '체크박스는 팀의 "검토 여부"만 나타냅니다. 데이터 수급 상태는 별도의 드롭다운으로 관리하며, 둘은 서로를 자동으로 바꾸지 않습니다.',
    storage: '입력 내용은 현재 케이스에 묶여 이 브라우저(localStorage)에만 저장됩니다. 기업 기밀 데이터는 별도 보안 검토 전에는 입력하지 마십시오.',
    reviewTitle: '검토 진행률',
    reviewDesc: '검토 체크된 항목 ÷ 전체 항목 × 100',
    receiptTitle: '데이터 수령률',
    receiptDesc: '(수령 완료 + 검증 필요) 항목 ÷ (전체 − 해당 없음) × 100 · 키트 kpis() 기준',
    statusTitle: '데이터 상태 분포',
    catTitle: '카테고리별 진행률',
    required: (met: number, total: number) => `필수 데이터 충족 ${met}/${total} (키트 기준: 수령 완료·검증 필요이며 검증 실패가 아님)`,
    items: '항목',
    search: '항목 검색',
    searchPh: '항목명·이유·형식으로 검색',
    filter: '보기',
    fAll: '전체 보기',
    fPending: '미수신/요청 필요',
    fReceived: '수령 완료 (검증 필요 포함)',
    selectAll: '표시된 항목 전체 검토 선택',
    clearAll: '표시된 항목 전체 검토 해제',
    bulkNote: '전체 선택/해제는 검토 체크박스에만 적용되며 데이터 상태는 바꾸지 않습니다.',
    shown: (n: number, t: number) => `${t}개 중 ${n}개 표시`,
    noMatch: '조건에 맞는 항목이 없습니다.',
    colReview: '검토',
    colItem: '항목명',
    colReason: '필요 이유 (우선순위)',
    colValue: '측정값 / 단위',
    colCond: '측정조건 및 일시',
    colStatus: '데이터 상태',
    colNote: '메모 / 비고',
    format: '형식',
    valuePh: '측정값',
    unitPh: '단위',
    locPh: '측정 위치',
    condPh: '측정 조건',
    reviewAria: (n: string) => `${n} 검토 완료`,
    statusAria: (n: string) => `${n} 데이터 상태`,
    verifyAria: (n: string) => `${n} 검증 상태`,
    docValue: '문서',
    noteAria: (n: string) => `${n} 메모`,
    valueAria: (n: string) => `${n} 측정값`,
    unitAria: (n: string) => `${n} 단위`,
    locAria: (n: string) => `${n} 측정 위치`,
    condAria: (n: string) => `${n} 측정 조건`,
    timeAria: (n: string) => `${n} 측정 일시`,
    requiredTag: '필수',
    priority: { high: '높음', medium: '중간', low: '낮음' } satisfies Record<Priority, string>,
    emailTitle: '자료 요청 이메일 초안',
    emailSub: '데이터 상태가 "요청 필요"인 항목을 자동으로 모아 초안을 만듭니다.',
    emailNoSend: '발송 기능 없음 — 초안을 복사해 사용하는 메일 프로그램에서 직접 확인·발송하세요.',
    client: '고객사 / 발전소명',
    clientPh: '예: ○○발전 △△본부 (비우면 자리표시자)',
    emailIncluded: (n: number) => `초안 포함 항목 ${n}건`,
    emailNone: '"요청 필요" 상태인 항목이 없습니다. 표에서 요청할 항목의 데이터 상태를 "요청 필요"로 바꿔 주세요.',
    generate: '이메일 초안 생성',
    regenerate: '현재 항목으로 다시 생성',
    regenWarn: '다시 생성하면 직접 편집한 내용이 덮어쓰기됩니다.',
    subject: '이메일 제목',
    body: '이메일 본문',
    copy: '제목·본문 복사',
    copied: '클립보드에 복사했습니다. (발송되지 않았습니다)',
    copyHtml: 'HTML로 복사',
    needValue: (item: string, st: string) => `${item}: 실측값을 먼저 입력해야 '${st}'(으)로 변경할 수 있습니다.`,
    copyFail: '자동 복사에 실패했습니다. 본문을 직접 선택해 복사해 주세요.',
    draftBadge: '초안 · 미발송',
    edited: '편집됨',
    stale: '초안 생성 이후 "요청 필요" 항목이나 고객사명이 바뀌었습니다.',
  },
  en: {
    notice:
      'Checkboxes record only the team’s review. Data receipt status is managed with a separate dropdown; neither changes the other automatically.',
    storage: 'Entries are tied to the current case and stored only in this browser (localStorage). Do not enter confidential company data without a security review.',
    reviewTitle: 'Review progress',
    reviewDesc: 'Reviewed items ÷ all items × 100',
    receiptTitle: 'Data receipt rate',
    receiptDesc: '(Received + Needs verification) ÷ (all − N/A) × 100 · kit kpis()',
    statusTitle: 'Data status breakdown',
    catTitle: 'Progress by category',
    required: (met: number, total: number) => `Required data met ${met}/${total} (kit rule: received or needs verification, and not failed)`,
    items: 'items',
    search: 'Search items',
    searchPh: 'Search name, reason or format',
    filter: 'View',
    fAll: 'All',
    fPending: 'Not received / request needed',
    fReceived: 'Received (incl. needs verification)',
    selectAll: 'Mark shown items reviewed',
    clearAll: 'Unmark shown items',
    bulkNote: 'Select/clear all applies only to review checkboxes; data status is not changed.',
    shown: (n: number, t: number) => `Showing ${n} of ${t}`,
    noMatch: 'No items match.',
    colReview: 'Reviewed',
    colItem: 'Item',
    colReason: 'Why needed (priority)',
    colValue: 'Measured value / unit',
    colCond: 'Condition & time',
    colStatus: 'Data status',
    colNote: 'Memo / note',
    format: 'Format',
    valuePh: 'Value',
    unitPh: 'Unit',
    locPh: 'Location',
    condPh: 'Condition',
    reviewAria: (n: string) => `${n} reviewed`,
    statusAria: (n: string) => `${n} data status`,
    verifyAria: (n: string) => `${n} verification status`,
    docValue: 'Document',
    noteAria: (n: string) => `${n} memo`,
    valueAria: (n: string) => `${n} measured value`,
    unitAria: (n: string) => `${n} unit`,
    locAria: (n: string) => `${n} location`,
    condAria: (n: string) => `${n} condition`,
    timeAria: (n: string) => `${n} measured at`,
    requiredTag: 'Required',
    priority: { high: 'High', medium: 'Medium', low: 'Low' } satisfies Record<Priority, string>,
    emailTitle: 'Data request email draft',
    emailSub: 'Automatically gathers items whose data status is “Request needed”.',
    emailNoSend: 'No sending feature — copy the draft and review/send it from your own mail client.',
    client: 'Client / plant name',
    clientPh: 'e.g., XX Power, YY site (blank = placeholder)',
    emailIncluded: (n: number) => `${n} item(s) in draft`,
    emailNone: 'No items are marked “Request needed”. Change the data status of items to request in the table.',
    generate: 'Generate email draft',
    regenerate: 'Regenerate from current items',
    regenWarn: 'Regenerating overwrites your edits.',
    subject: 'Email subject',
    body: 'Email body',
    copy: 'Copy subject & body',
    copied: 'Copied to clipboard. (Not sent)',
    copyHtml: 'Copy as HTML',
    needValue: (item: string, st: string) => `${item}: enter the measured value before changing to "${st}".`,
    copyFail: 'Automatic copy failed. Please select the text and copy it manually.',
    draftBadge: 'Draft · not sent',
    edited: 'Edited',
    stale: '“Request needed” items or client name changed since the draft was generated.',
  },
};

const CATS = CHECKLIST_CATEGORIES;

function ProgressMeter({ title, desc, pct, count, total, lang, kind, testId }: {
  title: string;
  desc: string;
  pct: number;
  count: number;
  total: number;
  lang: 'ko' | 'en';
  kind: 'review' | 'receipt';
  testId: string;
}) {
  return (
    <Card className="progress-card" title={title} subtitle={desc}>
      <div className="progress-card__value">
        <span className="num" data-testid={testId}>
          {formatNumber(pct, lang, 0)}
        </span>
        <small>%</small>
        <span className="progress-card__count num">
          {count} / {total}
        </span>
      </div>
      <div className={`meter meter--${kind}`} role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

export function ChecklistPage() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const cl = useChecklist();
  const toast = useToast();
  const { summary } = cl;

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [highlight, setHighlight] = useState<string | null>(null);

  // AI 답변 등에서 특정 항목으로 이동해 온 경우: 필터를 풀고 해당 행으로 스크롤·강조
  useEffect(() => {
    const id = cl.focusItemId;
    if (!id) return;
    setQuery('');
    setFilter('all');
    const raf = window.requestAnimationFrame(() => {
      const el = document.getElementById(`chk-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlight(id);
        window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 2600);
      } else {
        toast.push(lang === 'ko' ? '관련 체크리스트 항목을 찾을 수 없습니다.' : 'The related checklist item could not be found.', 'error');
      }
      cl.requestFocus(null);
    });
    return () => window.cancelAnimationFrame(raf);
    // 포커스 요청이 바뀔 때만 실행 (나머지 참조는 안정적인 setter·현재 언어)
  }, [cl.focusItemId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CHECKLIST_ITEMS.filter((i) => {
      const st = cl.status[i.id];
      if (filter === 'pending' && !PENDING_STATUSES.includes(st)) return false;
      if (filter === 'received' && !RECEIVED_STATUSES.includes(st)) return false;
      if (!q) return true;
      return [i.name[lang], i.reason[lang], i.format[lang], cl.notes[i.id] ?? ''].some((s) => s.toLowerCase().includes(q));
    });
  }, [query, filter, cl.status, cl.notes, lang]);

  const requested = CHECKLIST_ITEMS.filter((i) => cl.status[i.id] === 'requested');
  const requestedKey = `${requested.map((i) => i.id).join(',')}|${cl.clientName}`;
  const [draft, setDraft] = useState<{ subject: string; body: string; key: string; edited: boolean } | null>(null);

  const generate = () => {
    const e = buildRequestEmail(requested, lang, { clientName: cl.clientName, meta: cl.meta, notes: cl.notes });
    setDraft({ ...e, key: requestedKey, edited: false });
  };

  const onCopy = async () => {
    if (!draft) return;
    const ok = await copyText(`${x.subject}: ${draft.subject}\n\n${draft.body}`);
    toast.push(ok ? x.copied : x.copyFail, ok ? 'success' : 'error');
  };

  /** 표가 유지되도록 text/html 로 복사 (지원하지 않는 브라우저는 마크다운 텍스트로 대체) */
  const onCopyHtml = async () => {
    if (!draft) return;
    const text = `${x.subject}: ${draft.subject}

${draft.body}`;
    let ok = false;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const html = `<p><strong>${x.subject}:</strong> ${draft.subject.replace(/</g, '&lt;')}</p>${emailBodyToHtml(draft.body)}`;
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
        ]);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = await copyText(text);
    toast.push(ok ? x.copied : x.copyFail, ok ? 'success' : 'error');
  };

  const met = cl.readiness.requiredTotal - cl.readiness.missingIds.length;
  const catStats = (s: ProgressStats) => `${s.receivedCount}/${s.total} · ${s.reviewedCount}/${s.total}`;

  return (
    <PageScaffold tabId="checklist" pageDataTypes={['noMeasured', 'implemented']}>
      <div className="page-actions">
        <AskAiButton tab="checklist" />
      </div>
      <p className="page-notice" role="note">
        <DataTypeBadges types={['noMeasured']} />
        <span>{x.notice}</span>
      </p>

      <div className="progress-grid">
        <ProgressMeter
          title={x.receiptTitle}
          desc={x.receiptDesc}
          pct={summary.receivedPct}
          count={summary.receivedCount}
          total={summary.total}
          lang={lang}
          kind="receipt"
          testId="receipt-pct"
        />
        <ProgressMeter
          title={x.reviewTitle}
          desc={x.reviewDesc}
          pct={summary.reviewPct}
          count={summary.reviewedCount}
          total={summary.total}
          lang={lang}
          kind="review"
          testId="review-pct"
        />
        <Card className="progress-card" title={x.statusTitle} subtitle={x.required(met, cl.readiness.requiredTotal)}>
          <ul className="status-dist">
            {RECEIPT_STATUSES.map((s) => (
              <li key={s}>
                <ReceiptStatusBadge status={s} />
                <strong className="num">{summary.byStatus[s]}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="chk-toolbar">
        <div className="chk-toolbar__row">
          <label className="chk-search">
            <span className="sr-only">{x.search}</span>
            <input
              type="search"
              className="text-input"
              value={query}
              placeholder={x.searchPh}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={x.search}
              data-testid="chk-search"
            />
          </label>
          <SegmentedToggle<Filter>
            className="seg--light"
            label={x.filter}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: x.fAll },
              { value: 'pending', label: x.fPending },
              { value: 'received', label: x.fReceived },
            ]}
          />
          <span className="chk-toolbar__count" aria-live="polite">
            {x.shown(visible.length, CHECKLIST_ITEMS.length)}
          </span>
        </div>
        <div className="chk-toolbar__row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => cl.setReviewedMany(visible.map((i) => i.id), true)} disabled={visible.length === 0}>
            {x.selectAll}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => cl.setReviewedMany(visible.map((i) => i.id), false)} disabled={visible.length === 0}>
            {x.clearAll}
          </button>
          <span className="note">{x.bulkNote}</span>
        </div>
      </Card>

      {visible.length === 0 && <p className="chart-empty">{x.noMatch}</p>}

      {CATS.map((cat) => {
        const items = visible.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const st = cl.byCategory[cat];
        return (
          <Card
            key={cat}
            title={CHECKLIST_CATEGORY_LABEL[cat][lang]}
            badges={
              <span className="chk-cat-count num">
                {x.colReview} {st.reviewedCount}/{st.total}
              </span>
            }
          >
            <div className="chk-table" role="table" aria-label={CHECKLIST_CATEGORY_LABEL[cat][lang]}>
              <div className="chk-row chk-row--head" role="row">
                <span role="columnheader">{x.colReview}</span>
                <span role="columnheader">{x.colItem}</span>
                <span role="columnheader">{x.colReason}</span>
                <span role="columnheader">{x.colValue}</span>
                <span role="columnheader">{x.colCond}</span>
                <span role="columnheader">{x.colStatus}</span>
                <span role="columnheader">{x.colNote}</span>
              </div>
              {items.map((it) => {
                const name = it.name[lang];
                const statusVal = cl.status[it.id];
                const meta = cl.meta[it.id];
                const isRequired = it.required;
                return (
                  <div
                    key={it.id}
                    id={`chk-${it.id}`}
                    className={`chk-row${cl.reviewed[it.id] ? ' is-reviewed' : ''}${highlight === it.id ? ' is-highlight' : ''}`}
                    role="row"
                    data-item={it.id}
                  >
                    <span role="cell" className="chk-row__check">
                      <input
                        type="checkbox"
                        checked={cl.reviewed[it.id]}
                        onChange={(e) => cl.setReviewed(it.id, e.target.checked)}
                        aria-label={x.reviewAria(name)}
                      />
                    </span>
                    <span role="cell" className="chk-row__item">
                      <strong>{name}</strong>
                      <span className="chk-row__reason">
                        {x.format}: {it.format[lang]}
                      </span>
                    </span>
                    <span role="cell" className="chk-row__why">
                      <span className="chk-row__reason">{it.reason[lang]}</span>
                      <span className="badge-row">
                        <span className={`prio prio--${it.priority}`}>{x.priority[it.priority]}</span>
                        {isRequired && <span className="prio prio--required">{x.requiredTag}</span>}
                      </span>
                    </span>
                    <span role="cell" className="chk-row__value">
                      <input
                        className="text-input"
                        value={meta.value}
                        placeholder={it.kind === 'document' ? x.docValue : x.valuePh}
                        maxLength={60}
                        onChange={(e) => cl.setMeta(it.id, { value: e.target.value })}
                        aria-label={x.valueAria(name)}
                      />
                      <input
                        className="text-input text-input--unit"
                        value={meta.unit}
                        placeholder={x.unitPh}
                        maxLength={20}
                        onChange={(e) => cl.setMeta(it.id, { unit: e.target.value })}
                        aria-label={x.unitAria(name)}
                      />
                    </span>
                    <span role="cell" className="chk-row__cond">
                      <input
                        className="text-input"
                        value={meta.location}
                        placeholder={x.locPh}
                        maxLength={80}
                        onChange={(e) => cl.setMeta(it.id, { location: e.target.value })}
                        aria-label={x.locAria(name)}
                      />
                      <input
                        className="text-input"
                        value={meta.condition}
                        placeholder={x.condPh}
                        maxLength={120}
                        onChange={(e) => cl.setMeta(it.id, { condition: e.target.value })}
                        aria-label={x.condAria(name)}
                      />
                      <input
                        className="text-input"
                        type="datetime-local"
                        value={meta.measuredAt}
                        onChange={(e) => cl.setMeta(it.id, { measuredAt: e.target.value })}
                        aria-label={x.timeAria(name)}
                      />
                    </span>
                    <span role="cell" className="chk-row__status">
                      <ReceiptStatusBadge status={statusVal} />
                      <select
                        className="select"
                        value={statusVal}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!isReceiptStatus(next)) return;
                          // 실측값 없이 수령 완료·검증 필요로 바꾸면 차단하고 이전 상태 유지 (가이드 §2.4)
                          if (!cl.setStatus(it.id, next)) toast.push(x.needValue(name, RECEIPT_LABEL[lang][next]), 'error');
                        }}
                        aria-label={x.statusAria(name)}
                        data-status-for={it.id}
                      >
                        {RECEIPT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {RECEIPT_LABEL[lang][s]}
                          </option>
                        ))}
                      </select>
                      {/* 키트 검증 상태 — 필수 충족 = 수령 + 검증 실패 아님 */}
                      <select
                        className="select select--sm"
                        value={cl.verify[it.id]}
                        onChange={(e) => isVerifyStatus(e.target.value) && cl.setVerify(it.id, e.target.value)}
                        aria-label={x.verifyAria(name)}
                        data-verify-for={it.id}
                      >
                        {VERIFY_STATUSES.map((v) => (
                          <option key={v} value={v}>
                            {VERIFY_LABEL_L[lang][v]}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span role="cell" className="chk-row__note">
                      <textarea
                        className="text-input"
                        rows={2}
                        value={cl.notes[it.id] ?? it.note[lang]}
                        onChange={(e) => cl.setNote(it.id, e.target.value)}
                        aria-label={x.noteAria(name)}
                        maxLength={300}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card title={x.catTitle}>
        <div className="cat-progress">
          {CATS.map((cat) => {
            const s = cl.byCategory[cat];
            return (
              <div key={cat} className="cat-progress__item" data-cat={cat}>
                <p className="cat-progress__name">{CHECKLIST_CATEGORY_LABEL[cat][lang]}</p>
                <div className="cat-progress__row">
                  <span>{x.receiptTitle}</span>
                  <div className="meter meter--receipt">
                    <span style={{ width: `${s.receivedPct}%` }} />
                  </div>
                  <span className="num">{formatNumber(s.receivedPct, lang, 0)}%</span>
                </div>
                <div className="cat-progress__row">
                  <span>{x.reviewTitle}</span>
                  <div className="meter meter--review">
                    <span style={{ width: `${s.reviewPct}%` }} />
                  </div>
                  <span className="num">{formatNumber(s.reviewPct, lang, 0)}%</span>
                </div>
                <p className="note num">{catStats(s)}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={x.emailTitle} subtitle={x.emailSub} badges={<span className="concept-tag">{x.draftBadge}</span>}>
        <p className="note note--warn">{x.emailNoSend}</p>
        <label className="field email-client">
          <span className="field__label">{x.client}</span>
          <input
            className="text-input"
            value={cl.clientName}
            placeholder={x.clientPh}
            maxLength={80}
            onChange={(e) => cl.setClientName(e.target.value)}
            data-testid="email-client"
          />
        </label>
        <div className="email-meta">
          <span className="num">{x.emailIncluded(requested.length)}</span>
          {requested.length === 0 ? (
            <span className="note">{x.emailNone}</span>
          ) : (
            <ul className="email-chips">
              {requested.map((i) => (
                <li key={i.id}>{i.name[lang]}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="email-actions">
          <button type="button" className="btn btn--primary" onClick={generate} disabled={requested.length === 0}>
            {draft ? x.regenerate : x.generate}
          </button>
          {draft?.edited && <span className="note">{x.regenWarn}</span>}
        </div>

        {draft && (
          <div className="email-draft">
            {draft.key !== requestedKey && <p className="note note--warn">{x.stale}</p>}
            <label className="field__label" htmlFor="email-subject">
              {x.subject}
            </label>
            <input
              id="email-subject"
              className="text-input"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value, edited: true })}
            />
            <label className="field__label" htmlFor="email-body">
              {x.body} {draft.edited && <span className="email-edited">· {x.edited}</span>}
            </label>
            <textarea
              id="email-body"
              className="email-draft__body"
              value={draft.body}
              rows={22}
              onChange={(e) => setDraft({ ...draft, body: e.target.value, edited: true })}
            />
            <div className="email-actions">
              <button type="button" className="btn btn--ghost" onClick={onCopy} data-testid="email-copy">
                {x.copy}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onCopyHtml} data-testid="email-copy-html">
                {x.copyHtml}
              </button>
            </div>
          </div>
        )}
      </Card>

      <p className="note">{x.storage}</p>
    </PageScaffold>
  );
}
