import { useState } from 'react';
import type { ReviewStatus } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { useReview } from '@/context/Workspace';
import { REVIEW_CATEGORIES } from '@/data/reviewItems';
import { calcRatioPct } from '@/lib/calc';
import { formatNumber } from '@/lib/format';

const TXT = {
  ko: {
    title: '팀 내부 검토',
    toggleOpen: '펼치기',
    toggleClose: '접기',
    summary: (done: number, total: number, issue: number) => `완료 ${done}/${total} · 이슈 ${issue}`,
    session:
      '검토 상태는 현재 브라우저 탭에만 임시로 기록됩니다. 서버 저장이 없어 새로고침 시 초기화되며, 다른 팀원에게 공유되지 않습니다. 실제로 검토한 항목만 상태를 바꾸세요.',
    reset: '모두 미검토로 되돌리기',
    status: { todo: '미검토', inProgress: '검토 중', done: '완료', issue: '이슈 있음' } satisfies Record<ReviewStatus, string>,
  },
  en: {
    title: 'Team internal review',
    toggleOpen: 'Expand',
    toggleClose: 'Collapse',
    summary: (done: number, total: number, issue: number) => `Done ${done}/${total} · Issues ${issue}`,
    session:
      'Review status is recorded only in this browser tab. With no server storage it resets on reload and is not shared with other team members. Change only items you have actually reviewed.',
    reset: 'Reset all to not reviewed',
    status: { todo: 'Not reviewed', inProgress: 'In review', done: 'Done', issue: 'Issue' } satisfies Record<ReviewStatus, string>,
  },
};

const STATUSES: ReviewStatus[] = ['todo', 'inProgress', 'done', 'issue'];
const isReviewStatus = (v: string): v is ReviewStatus => (STATUSES as string[]).includes(v);

export function TeamReviewPanel() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const rv = useReview();
  const [open, setOpen] = useState(false);

  const all = REVIEW_CATEGORIES.flatMap((c) => c.items);
  const done = all.filter((i) => rv.statuses[i.id] === 'done').length;
  const issue = all.filter((i) => rv.statuses[i.id] === 'issue').length;

  return (
    <section className="review container" aria-labelledby="review-title">
      <div className="card review__card">
        <button
          type="button"
          className="review__toggle"
          aria-expanded={open}
          aria-controls="review-body"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="review__title" id="review-title">
            {x.title}
          </span>
          <span className="review__summary num">{x.summary(done, all.length, issue)}</span>
          <span className="review__meter" aria-hidden="true">
            <span style={{ width: `${calcRatioPct(done, all.length)}%` }} />
          </span>
          <span className="review__chev">{open ? `${x.toggleClose} ▲` : `${x.toggleOpen} ▼`}</span>
        </button>

        <div id="review-body" className="review__body" hidden={!open}>
          <p className="note note--warn">{x.session}</p>
          <div className="review__grid">
            {REVIEW_CATEGORIES.map((cat) => {
              const cDone = cat.items.filter((i) => rv.statuses[i.id] === 'done').length;
              return (
                <fieldset key={cat.id} className="review__cat">
                  <legend>
                    {cat.label[lang]}{' '}
                    <span className="review__cat-count num">
                      {cDone}/{cat.items.length} · {formatNumber(calcRatioPct(cDone, cat.items.length), lang, 0)}%
                    </span>
                  </legend>
                  {cat.items.map((it) => {
                    const st = rv.statuses[it.id];
                    return (
                      <div key={it.id} className={`review__item review__item--${st}`}>
                        <span className="review__item-label">{it.label[lang]}</span>
                        <select
                          className="select select--sm"
                          value={st}
                          onChange={(e) => isReviewStatus(e.target.value) && rv.setStatus(it.id, e.target.value)}
                          aria-label={it.label[lang]}
                          data-review={it.id}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {x.status[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={rv.reset}>
            {x.reset}
          </button>
        </div>
      </div>
    </section>
  );
}
