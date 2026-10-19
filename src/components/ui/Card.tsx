import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** 제목 우측 배지 영역 (데이터 유형 / 상태) */
  badges?: ReactNode;
  span?: 1 | 2;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
  as?: 'section' | 'article' | 'div';
}

/** 모든 데이터 영역·입력 폼·차트를 담는 흰색 카드 */
export function Card({
  title,
  subtitle,
  badges,
  span = 1,
  className = '',
  bodyClassName = '',
  children,
  as: Tag = 'section',
}: CardProps) {
  const hasHead = title !== undefined || badges !== undefined;
  return (
    <Tag className={`card ${span === 2 ? 'card--span-2' : ''} ${className}`.trim()}>
      {hasHead && (
        <header className="card__head">
          <div className="card__titles">
            {title !== undefined && <h3 className="card__title">{title}</h3>}
            {subtitle !== undefined && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {badges !== undefined && <div className="card__badges">{badges}</div>}
        </header>
      )}
      {children !== undefined && <div className={`card__body ${bodyClassName}`.trim()}>{children}</div>}
    </Tag>
  );
}
