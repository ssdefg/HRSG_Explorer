import { useAppSettings } from '@/context/AppSettings';
import { useCases, useToast } from '@/context/Workspace';

const TXT = {
  ko: {
    dismiss: '닫기',
    invalid: '저장된 데이터를 불러오지 못했습니다 (형식 오류). 기본 상태로 시작합니다. 원본은 hrsg.workspace.corrupt 키에 보관했습니다.',
    migrated: '이전 형식의 저장 데이터를 현재 구조로 변환해 불러왔습니다.',
    unavailable: '브라우저 저장소를 사용할 수 없어 데이터를 불러오거나 저장할 수 없습니다. 새로고침 시 작업 내용이 사라집니다.',
  },
  en: {
    dismiss: 'Dismiss',
    invalid: 'Could not load saved data (invalid format). Starting from defaults. The original was kept under hrsg.workspace.corrupt.',
    migrated: 'Saved data in an older format was converted to the current structure.',
    unavailable: 'Browser storage is unavailable, so data cannot be loaded or saved. Work will be lost on reload.',
  },
};

/** 토스트 알림 + 저장 데이터 불러오기 결과 안내 */
export function ToastHost() {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const { toasts, dismiss } = useToast();
  const { loadNotice, dismissLoadNotice } = useCases();
  return (
    <>
      {loadNotice && (
        <div className={`load-notice load-notice--${loadNotice}`} role="alert">
          <span>{x[loadNotice]}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={dismissLoadNotice}>
            {x.dismiss}
          </button>
        </div>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((tst) => (
          <div key={tst.id} className={`toast toast--${tst.kind}`} role={tst.kind === 'error' ? 'alert' : 'status'}>
            <span>{tst.text}</span>
            <button type="button" className="toast__close" aria-label={x.dismiss} onClick={() => dismiss(tst.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
