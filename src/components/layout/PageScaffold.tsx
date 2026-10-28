import type { ReactNode } from 'react';
import type { DataType, TabId } from '@/types';
import { useAppSettings } from '@/context/AppSettings';
import { PAGE_META } from '@/data/pageSections';
import { TABS } from '@/data/tabs';
import { DataTypeBadges } from '@/components/ui';
import { DisplayLegend } from './DisplayLegend';

interface PageScaffoldProps {
  tabId: TabId;
  /** 페이지 수준 데이터 유형 배지 */
  pageDataTypes: DataType[];
  /** 페이지 헤더 우측 액션 (실제로 동작하는 버튼만) */
  actions?: ReactNode;
  /** 페이지 고유 콘텐츠 */
  children?: ReactNode;
}

/** 화면 공통 골격: 페이지 헤더 → 페이지 콘텐츠 → 표시 규칙 범례 */
export function PageScaffold({ tabId, pageDataTypes, actions, children }: PageScaffoldProps) {
  const { lang } = useAppSettings();
  const meta = PAGE_META[tabId];
  const order = TABS.find((x) => x.id === tabId)?.order ?? 0;

  return (
    <section className="page" id={`page-${tabId}`} aria-labelledby={`page-title-${tabId}`}>
      <div className="page-head">
        <div className="page-head__text">
          <span className="page-head__eyebrow">Module {String(order).padStart(2, '0')}</span>
          <h2 className="page-head__title" id={`page-title-${tabId}`}>
            {meta.title[lang]}
          </h2>
          <p className="page-head__desc">{meta.description[lang]}</p>
          <div className="page-head__badges">
            <DataTypeBadges types={pageDataTypes} />
          </div>
        </div>
        {actions && <div className="page-head__actions">{actions}</div>}
      </div>

      {children}

      <DisplayLegend />
    </section>
  );
}
