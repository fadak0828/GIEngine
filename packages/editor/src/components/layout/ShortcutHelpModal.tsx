import React, { useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import '@/styles/primitives.css';

const SHORTCUTS: { key: string; label: string }[][] = [
  [
    { key: 'Ctrl + S', label: '프로젝트 저장' },
    { key: 'Ctrl + N', label: '새 프로젝트' },
    { key: 'Ctrl + Z', label: '실행 취소' },
    { key: 'Ctrl + Y / Ctrl + Shift + Z', label: '다시 실행' },
  ],
  [
    { key: 'Ctrl + 1', label: '씬 편집 탭' },
    { key: 'Ctrl + 2', label: '에셋 관리 탭' },
    { key: 'Ctrl + 3', label: '단어 관리 탭' },
    { key: 'Ctrl + 4', label: '퍼즐 편집 탭' },
  ],
  [
    { key: 'Alt + ← / Alt + →', label: '이전/다음 씬 이동' },
    { key: 'F2', label: '선택 항목 이름 변경' },
    { key: 'Delete', label: '선택 항목 삭제' },
    { key: '? 또는 Ctrl + /', label: '단축키 도움말 열기/닫기' },
    { key: 'Esc', label: '모달 / 오버레이 닫기' },
  ],
];

export function ShortcutHelpModal(): React.ReactElement | null {
  const open = useEditorStore(s => s.ui.shortcutHelpOpen);
  const setShortcutHelpOpen = useEditorStore(s => s.setShortcutHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShortcutHelpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setShortcutHelpOpen]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
      aria-label="키보드 단축키 도움말"
      className="modal-backdrop"
      style={{ zIndex: 10000 }}
      onClick={() => setShortcutHelpOpen(false)}
    >
      <div
        className="modal-shell"
        style={{
          padding: '24px 28px',
          minWidth: 400,
          maxWidth: 520,
          zIndex: 10001,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="shortcut-help-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            ⌨ 키보드 단축키
          </h2>
          <button
            aria-label="닫기"
            onClick={() => setShortcutHelpOpen(false)}
            className="modal-close"
          >
            ✕
          </button>
        </div>

        {SHORTCUTS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: gi < SHORTCUTS.length - 1 ? 16 : 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {group.map(({ key, label }) => (
                  <tr key={key}>
                    <td style={{ paddingBottom: 8, width: '55%' }}>
                      <kbd
                        className="font-mono"
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          fontSize: 12,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--accent)',
                        }}
                      >
                        {key}
                      </kbd>
                    </td>
                    <td style={{ paddingBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                      {label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {gi < SHORTCUTS.length - 1 && (
              <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0 8px' }} />
            )}
          </div>
        ))}

        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Mac에서는 Ctrl 대신 ⌘ (Cmd) 를 사용하세요
        </div>
      </div>
    </div>
  );
}
