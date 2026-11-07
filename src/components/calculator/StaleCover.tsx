import type { ReactNode } from 'react';
import { DataTypeBadges } from '@/components/ui';
import { useAppSettings } from '@/context/AppSettings';

const TXT = {
  ko: { msg: '입력값이 변경되었습니다. 이전 결과를 가렸습니다.', run: '재평가 실행' },
  en: { msg: 'Inputs changed. Previous results are hidden.', run: 'Re-evaluate' },
};

/** 결과 영역 덮개 — stale 이면 블러 + '재평가 필요' 배지 + 재평가 버튼 (가이드 §2.3) */
export function StaleCover({ stale, onRun, children }: { stale: boolean; onRun: () => void; children: ReactNode }) {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  return (
    <div className={`stale-cover${stale ? ' is-stale' : ''}`} data-testid={stale ? 'stale-cover' : undefined}>
      <div className="stale-cover__content" aria-hidden={stale || undefined}>
        {children}
      </div>
      {stale && (
        <div className="stale-cover__overlay" role="status">
          <DataTypeBadges types={['stale']} />
          <span>{x.msg}</span>
          <button type="button" className="btn btn--primary btn--sm" onClick={onRun}>
            {x.run}
          </button>
        </div>
      )}
    </div>
  );
}
