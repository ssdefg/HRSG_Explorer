import { useEffect, useRef, useState } from 'react';
import { useAppSettings } from '@/context/AppSettings';
import { useCases, useToast } from '@/context/Workspace';

const TXT = {
  ko: {
    title: '케이스 관리',
    close: '닫기',
    newName: '새 케이스 이름',
    create: '새 케이스',
    current: '현재',
    select: '선택',
    rename: '이름 수정',
    save: '저장',
    cancel: '취소',
    duplicate: '복제',
    remove: '삭제',
    confirmRemove: '삭제 확인',
    lastCase: '마지막 케이스는 삭제할 수 없습니다.',
    copySuffix: ' (복제)',
    defaultName: (n: number) => `케이스 ${n}`,
    updated: '최근 수정',
    storage:
      '케이스 데이터는 이 브라우저의 localStorage에만 저장됩니다. 서버 저장이나 다른 사용자와의 동기화가 아닙니다. 기업 기밀 데이터는 별도 보안 검토 전에는 입력하지 마십시오.',
    isolated: '각 케이스의 입력값·체크리스트·실측 스냅샷·AI 대화·분석 이력은 서로 독립적으로 관리됩니다.',
    created: '새 케이스를 만들었습니다.',
    duplicated: '케이스를 복제했습니다.',
    removed: '케이스를 삭제했습니다.',
  },
  en: {
    title: 'Case manager',
    close: 'Close',
    newName: 'New case name',
    create: 'New case',
    current: 'Current',
    select: 'Select',
    rename: 'Rename',
    save: 'Save',
    cancel: 'Cancel',
    duplicate: 'Duplicate',
    remove: 'Delete',
    confirmRemove: 'Confirm delete',
    lastCase: 'The last case cannot be deleted.',
    copySuffix: ' (copy)',
    defaultName: (n: number) => `Case ${n}`,
    updated: 'Updated',
    storage:
      'Case data is stored only in this browser’s localStorage. It is not server storage or synced with other users. Do not enter confidential company data without a security review.',
    isolated: 'Inputs, checklist, measured snapshots, AI conversations and analysis history are kept separately per case.',
    created: 'New case created.',
    duplicated: 'Case duplicated.',
    removed: 'Case deleted.',
  },
};

export function CaseManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useAppSettings();
  const x = TXT[lang];
  const cs = useCases();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

  const create = () => {
    cs.create(newName.trim() || x.defaultName(cs.cases.length + 1));
    setNewName('');
    toast.push(x.created, 'success');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-manager-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2 id="case-manager-title" className="modal__title">
            {x.title}
          </h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            {x.close}
          </button>
        </header>
        <p className="note note--warn">{x.storage}</p>
        <p className="note">{x.isolated}</p>

        <form
          className="case-new"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input
            className="text-input"
            value={newName}
            maxLength={60}
            placeholder={x.defaultName(cs.cases.length + 1)}
            aria-label={x.newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className="btn btn--primary">
            {x.create}
          </button>
        </form>

        <ul className="case-list">
          {cs.cases.map((c) => {
            const isCurrent = c.id === cs.current.id;
            const isEditing = editing?.id === c.id;
            return (
              <li key={c.id} className={`case-row${isCurrent ? ' is-current' : ''}`} data-case-id={c.id}>
                <div className="case-row__main">
                  {isEditing ? (
                    <form
                      className="case-row__rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        cs.rename(c.id, editing.name);
                        setEditing(null);
                      }}
                    >
                      <input
                        className="text-input"
                        value={editing.name}
                        maxLength={60}
                        autoFocus
                        aria-label={x.rename}
                        onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                      />
                      <button type="submit" className="btn btn--primary btn--sm">
                        {x.save}
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>
                        {x.cancel}
                      </button>
                    </form>
                  ) : (
                    <>
                      <strong className="case-row__name">{c.name}</strong>
                      {isCurrent && <span className="badge badge--data badge--data-implemented">{x.current}</span>}
                      <span className="case-row__meta">
                        {x.updated} {fmtTime(c.updatedAt)}
                      </span>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="case-row__actions">
                    {!isCurrent && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => cs.select(c.id)}>
                        {x.select}
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing({ id: c.id, name: c.name })}>
                      {x.rename}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        cs.duplicate(c.id, `${c.name}${x.copySuffix}`);
                        toast.push(x.duplicated, 'success');
                      }}
                    >
                      {x.duplicate}
                    </button>
                    {confirmId === c.id ? (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          if (cs.remove(c.id)) toast.push(x.removed, 'info');
                          else toast.push(x.lastCase, 'error');
                          setConfirmId(null);
                        }}
                      >
                        {x.confirmRemove}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={cs.cases.length <= 1}
                        title={cs.cases.length <= 1 ? x.lastCase : undefined}
                        onClick={() => setConfirmId(c.id)}
                      >
                        {x.remove}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
