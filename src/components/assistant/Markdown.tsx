import { Fragment, type ReactNode } from 'react';

/**
 * AI 답변용 최소 마크다운 렌더러 — 문단 · "- " 목록 · "1." 번호 목록 · ### 제목 · **굵게** · *기울임* · `코드` · [n] 인용.
 * HTML 을 해석하지 않고 React 텍스트로만 만든다 (dangerouslySetInnerHTML 없음 → 답변 속 태그가 실행되지 않음).
 */
export interface MarkdownProps {
  text: string;
  /** [n] 인용 렌더링 — 없으면 일반 텍스트 */
  cite?: (n: number) => ReactNode;
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number }
  | { kind: 'h'; text: string };

const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const H_RE = /^\s*#{1,4}\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const last = () => blocks[blocks.length - 1];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ kind: 'p', lines: [] }); // 빈 줄 = 블록 구분
      continue;
    }
    const h = H_RE.exec(line);
    const ul = UL_RE.exec(line);
    const ol = OL_RE.exec(line);
    const prev = last();
    if (h) blocks.push({ kind: 'h', text: h[1] });
    else if (ul) {
      if (prev?.kind === 'ul') prev.items.push(ul[1]);
      else blocks.push({ kind: 'ul', items: [ul[1]] });
    } else if (ol) {
      if (prev?.kind === 'ol') prev.items.push(ol[2]);
      else blocks.push({ kind: 'ol', items: [ol[2]], start: Number(ol[1]) });
    } else if (prev?.kind === 'p') prev.lines.push(line.trim());
    else blocks.push({ kind: 'p', lines: [line.trim()] });
  }
  return blocks.filter((b) => b.kind !== 'p' || b.lines.length > 0);
}

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|\[\d+\])/g;

function inline(text: string, cite?: (n: number) => ReactNode): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    const c = /^\[(\d+)\]$/.exec(part);
    if (c && cite) return <Fragment key={i}>{cite(Number(c[1]))}</Fragment>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ text, cite }: MarkdownProps) {
  return (
    <div className="md">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === 'h') return <p key={i} className="md__h">{inline(b.text, cite)}</p>;
        if (b.kind === 'ul')
          return (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, cite)}</li>
              ))}
            </ul>
          );
        if (b.kind === 'ol')
          return (
            <ol key={i} start={b.start}>
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, cite)}</li>
              ))}
            </ol>
          );
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l, cite)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
