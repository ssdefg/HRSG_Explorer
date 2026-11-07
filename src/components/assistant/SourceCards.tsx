import type { Lang } from '@/types';
import type { RagSource } from '@/lib/ragClient';
import { ASSISTANT_TXT } from './strings';

/** 답변 본문에 [n] 이 있으면 인용됨 */
export function citedRanks(answer: string | null): Set<number> {
  const set = new Set<number>();
  if (!answer) return set;
  for (const m of answer.matchAll(/\[(\d+)\]/g)) set.add(Number(m[1]));
  return set;
}

export function sourceAnchor(msgKey: string, rank: number): string {
  return `src-${msgKey}-${rank}`;
}

/** 근거 문헌 카드 — 기본: 제목·페이지 / 펼치면: DOI·검색 방식·인용 검증·원문 문단 */
export function SourceCards({ sources, answer, lang, msgKey }: { sources: RagSource[]; answer: string | null; lang: Lang; msgKey: string }) {
  const x = ASSISTANT_TXT[lang];
  const cited = citedRanks(answer);
  return (
    <ol className="asst-sources">
      {sources.map((s) => {
        const isCited = cited.has(s.rank);
        const title = s.title ?? s.file ?? s.doc_id;
        return (
          <li key={s.id} id={sourceAnchor(msgKey, s.rank)} className="asst-source">
            <details>
              <summary className="asst-source__head">
                <span className="asst-source__rank">{s.rank}</span>
                <span className="asst-source__title" title={s.citation ?? title}>
                  {title}
                </span>
                <span className="asst-source__page num">{x.page(s.page)}</span>
                <span className={`asst-source__cite${isCited ? ' is-cited' : ''}`} title={isCited ? x.cited : x.notCited}>
                  {isCited ? '✓' : '·'}
                </span>
              </summary>
              <div className="asst-source__body">
                <dl className="asst-source__meta">
                  <div>
                    <dt>{s.doc_id}</dt>
                    <dd>{s.file}</dd>
                  </div>
                  {s.doi && (
                    <div>
                      <dt>DOI</dt>
                      <dd>
                        <a href={`https://doi.org/${s.doi}`} target="_blank" rel="noreferrer noopener">
                          {s.doi}
                        </a>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>{x.method}</dt>
                    <dd className="num">
                      {[s.dense_rank ? x.dense(s.dense_rank) : null, s.bm25_rank ? x.bm25(s.bm25_rank) : null, x.rrf(s.rrf_score.toFixed(4))]
                        .filter(Boolean)
                        .join(' · ')}
                    </dd>
                  </div>
                  <div>
                    <dt>{lang === 'ko' ? '인용 검증' : 'Citation'}</dt>
                    <dd className={isCited ? 'asst-ok' : 'asst-muted'}>{isCited ? x.cited : x.notCited}</dd>
                  </div>
                </dl>
                <p className="asst-source__label">{x.passage}</p>
                <blockquote className="asst-source__text">{s.text}</blockquote>
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
