import React, { useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';

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
      aria-label="키보드 단축키 도움말"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={() => setShortcutHelpOpen(false)}
    >
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '24px 28px',
          minWidth: 400,
          maxWidth: 520,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            ⌨ 키보드 단축키
          </h2>
          <button
            aria-label="닫기"
            onClick={() => setShortcutHelpOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
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
                      <kbd style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 4,
                        color: 'var(--accent)',
                      }}>
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
