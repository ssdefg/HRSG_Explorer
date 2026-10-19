import { useState } from 'react';
import { PageScaffold } from '@/components/layout/PageScaffold';
import { Card, DataTypeBadges } from '@/components/ui';
import { ReceiptStatusBadge, RECEIPT_LABEL, RECEIPT_STATUSES, isReceiptStatus } from '@/components/ui/ReceiptStatusBadge';
import { useAppSettings } from '@/context/AppSettings';
import { useChecklist } from '@/context/Workspace';
import { CHECKLIST_CATEGORY_LABEL, CHECKLIST_ITEMS, type ChecklistCategory, type Priority } from '@/data/checklistItems';
import { buildRequestEmail } from '@/lib/emailDraft';
import { formatNumber } from '@/lib/format';

const TXT = {
  ko: {
    notice:
      '체크박스는 팀의 "검토 여부"만 나타냅니다. 실제 데이터 수령 여부는 별도의 "데이터 상태"로 관리하며, 아직 수령한 실측 데이터는 없습니다.',
    sessionNote: '상태는 현재 브라우저 탭에서만 유지되며 새로고침 시 초기화됩니다. 팀원 간 공유되지 않습니다.',
    reviewTitle: '검토 진행률',
    reviewDesc: '검토 완료 항목 수 ÷ 전체 항목 수 × 100 — 체크박스 기준',
    receiptTitle: '데이터 수령률',
    receiptDesc: '데이터 상태가 "수령 완료"인 항목 ÷ 전체 — 검토 진행률과 별개',
    statusTitle: '데이터 상태 분포',
    items: '항목',
    colReview: '검토',
    colItem: '데이터 항목 · 필요한 이유',
    colFormat: '단위 / 형식',
    colPriority: '우선순위',
    colStatus: '데이터 상태',
    colNote: '비고',
    reviewAria: (n: string) => `${n} 검토 완료`,
    statusAria: (n: string) => `${n} 데이터 상태`,
    noteAria: (n: string) => `${n} 비고`,
    priority: { high: '높음', medium: '중간', low: '낮음' } satisfies Record<Priority, string>,
    emailTitle: '자료 요청 이메일 초안',
    emailSub: '데이터 상태를 "요청 필요"로 지정한 항목으로 초안을 만듭니다.',
    emailNoSend: '발송 기능 없음 — 초안을 복사해 사용하는 메일 프로그램에서 직접 확인·발송하세요.',
    emailIncluded: (n: number) => `초안 포함 항목 ${n}건`,
    emailNone: '"요청 필요" 상태인 항목이 없습니다. 위 표에서 요청할 항목의 데이터 상태를 "요청 필요"로 바꿔 주세요.',
    generate: '이메일 초안 생성',
    regenerate: '선택 항목으로 다시 생성',
    regenWarn: '다시 생성하면 직접 편집한 내용이 덮어쓰기됩니다.',
    subject: '제목',
    body: '본문',
    copy: '제목·본문 복사',
    copied: '클립보드에 복사했습니다. (발송되지 않았습니다)',
    copyFail: '자동 복사에 실패했습니다. 본문을 직접 선택해 복사해 주세요.',
    draftBadge: '초안 · 미발송',
    edited: '편집됨',
    stale: '초안 생성 이후 "요청 필요" 항목이 바뀌었습니다.',
  },
  en: {
    notice:
      'Checkboxes record only the team’s review. Actual data receipt is tracked separately as the data status; no measured data has been received yet.',
    sessionNote: 'State lives only in this browser tab and resets on reload. It is not shared between team members.',
    reviewTitle: 'Review progress',
    reviewDesc: 'Reviewed items ÷ total items × 100 — by checkbox',
    receiptTitle: 'Data receipt rate',
    receiptDesc: 'Items with status “Received” ÷ total — separate from review progress',
    statusTitle: 'Data status breakdown',
    items: 'items',
    colReview: 'Reviewed',
    colItem: 'Data item · why needed',
    colFormat: 'Unit / format',
    colPriority: 'Priority',
    colStatus: 'Data status',
    colNote: 'Note',
    reviewAria: (n: string) => `${n} reviewed`,
    statusAria: (n: string) => `${n} data status`,
    noteAria: (n: string) => `${n} note`,
    priority: { high: 'High', medium: 'Medium', low: 'Low' } satisfies Record<Priority, string>,
    emailTitle: 'Data request email draft',
    emailSub: 'Builds a draft from items whose data status is “Request needed”.',
    emailNoSend: 'No sending feature — copy the draft and review/send it from your own mail client.',
    emailIncluded: (n: number) => `${n} item(s) in draft`,
    emailNone: 'No items are marked “Request needed”. Change the data status of items to request in the table above.',
    generate: 'Generate email draft',
    regenerate: 'Regenerate from selection',
    regenWarn: 'Regenerating overwrites your edits.',
    subject: 'Subject',
    body: 'Body',
    copy: 'Copy subject & body',
    copied: 'Copied to clipboard. (Not sent)',
    copyFail: 'Automatic copy failed. Please select the text and copy it manually.',
    draftBadge: 'Draft · not sent',
    edited: 'Edited',
    stale: '“Request needed” items have changed since the draft was generated.',
  },
};

const CATS: ChecklistCategory[] = ['A', 'B', 'C'];

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 대체 경로 시도 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ChecklistPage() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const cl = useChecklist();
  const { summary } = cl;

  const requested = CHECKLIST_ITEMS.filter((i) => cl.status[i.id] === 'requestNeeded');
  const requestedKey = requested.map((i) => i.id).join(',');

  const [draft, setDraft] = useState<{ subject: string; body: string; key: string; edited: boolean } | null>(null);
  const [copyMsg, setCopyMsg] = useState<'ok' | 'fail' | null>(null);

  const generate = () => {
    const e = buildRequestEmail(requested, lang);
    setDraft({ ...e, key: requestedKey, edited: false });
    setCopyMsg(null);
  };

  const onCopy = async () => {
    if (!draft) return;
    const ok = await copyText(`${x.subject}: ${draft.subject}\n\n${draft.body}`);
    setCopyMsg(ok ? 'ok' : 'fail');
  };

  const pct = (v: number) => formatNumber(v, lang, 0);

  return (
    <PageScaffold tabId="checklist" pageDataTypes={['noMeasured', 'implemented']}>
      <p className="page-notice" role="note">
        <DataTypeBadges types={['noMeasured']} />
        <span>{x.notice}</span>
      </p>

      <div className="progress-grid">
        <Card className="progress-card" title={x.reviewTitle} subtitle={x.reviewDesc}>
          <div className="progress-card__value">
            <span className="num" data-testid="review-pct">
              {pct(summary.reviewPct)}
            </span>
            <small>%</small>
            <span className="progress-card__count num">
              {summary.reviewedCount} / {summary.total} {x.items}
            </span>
          </div>
          <div
            className="meter meter--review"
            role="progressbar"
            aria-label={x.reviewTitle}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.reviewPct)}
          >
            <span style={{ width: `${summary.reviewPct}%` }} />
          </div>
        </Card>

        <Card className="progress-card" title={x.receiptTitle} subtitle={x.receiptDesc}>
          <div className="progress-card__value">
            <span className="num" data-testid="receipt-pct">
              {pct(summary.receivedPct)}
            </span>
            <small>%</small>
            <span className="progress-card__count num">
              {summary.receivedCount} / {summary.total} {x.items}
            </span>
          </div>
          <div
            className="meter meter--receipt"
            role="progressbar"
            aria-label={x.receiptTitle}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.receivedPct)}
          >
            <span style={{ width: `${summary.receivedPct}%` }} />
          </div>
        </Card>

        <Card className="progress-card" title={x.statusTitle}>
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

      {CATS.map((cat) => {
        const items = CHECKLIST_ITEMS.filter((i) => i.category === cat);
        const done = items.filter((i) => cl.reviewed[i.id]).length;
        return (
          <Card
            key={cat}
            title={CHECKLIST_CATEGORY_LABEL[cat][lang]}
            badges={
              <span className="chk-cat-count num">
                {x.colReview} {done}/{items.length}
              </span>
            }
          >
            <div className="chk-table" role="table" aria-label={CHECKLIST_CATEGORY_LABEL[cat][lang]}>
              <div className="chk-row chk-row--head" role="row">
                <span role="columnheader">{x.colReview}</span>
                <span role="columnheader">{x.colItem}</span>
                <span role="columnheader">{x.colFormat}</span>
                <span role="columnheader">{x.colPriority}</span>
                <span role="columnheader">{x.colStatus}</span>
                <span role="columnheader">{x.colNote}</span>
              </div>
              {items.map((it) => {
                const name = it.name[lang];
                const st = cl.status[it.id];
                return (
                  <div key={it.id} className={`chk-row${cl.reviewed[it.id] ? ' is-reviewed' : ''}`} role="row">
                    <span role="cell" className="chk-row__check">
                      <input
                        type="checkbox"
                        checked={cl.reviewed[it.id]}
                        onChange={(e) => cl.setReviewed(it.id, e.target.checked)}
                        aria-label={x.reviewAria(name)}
                        data-item={it.id}
                      />
                    </span>
                    <span role="cell" className="chk-row__item">
                      <strong>{name}</strong>
                      <span className="chk-row__reason">{it.reason[lang]}</span>
                    </span>
                    <span role="cell" className="chk-row__format">
                      <span className="chk-row__label">{x.colFormat}</span>
                      {it.format[lang]}
                    </span>
                    <span role="cell" className="chk-row__prio">
                      <span className={`prio prio--${it.priority}`}>{x.priority[it.priority]}</span>
                    </span>
                    <span role="cell" className="chk-row__status">
                      <ReceiptStatusBadge status={st} />
                      <select
                        className="select"
                        value={st}
                        onChange={(e) => isReceiptStatus(e.target.value) && cl.setStatus(it.id, e.target.value)}
                        aria-label={x.statusAria(name)}
                        data-status-for={it.id}
                      >
                        {RECEIPT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {RECEIPT_LABEL[lang][s]}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span role="cell" className="chk-row__note">
                      <input
                        className="text-input"
                        type="text"
                        value={cl.notes[it.id] ?? it.note[lang]}
                        onChange={(e) => cl.setNote(it.id, e.target.value)}
                        aria-label={x.noteAria(name)}
                        maxLength={200}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card
        title={x.emailTitle}
        subtitle={x.emailSub}
        badges={<span className="concept-tag">{x.draftBadge}</span>}
      >
        <p className="note note--warn">{x.emailNoSend}</p>
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
              <button type="button" className="btn btn--ghost" onClick={onCopy}>
                {x.copy}
              </button>
              <span className={copyMsg === 'fail' ? 'field__error' : 'note'} role="status">
                {copyMsg === 'ok' ? x.copied : copyMsg === 'fail' ? x.copyFail : ''}
              </span>
            </div>
          </div>
        )}
      </Card>

      <p className="note">{x.sessionNote}</p>
    </PageScaffold>
  );
}
