import React, { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { ExportModal } from '@/components/export/ExportModal';

export function Toolbar(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const meta = useEditorStore(s => s.meta);
  const ui = useEditorStore(s => s.ui);
  const { newProject, saveProject, setEditorLocale } = useEditorStore();

  const [exportModalOpen, setExportModalOpen] = useState(false);

  const handleOpen = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gi-project,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as { definition: unknown; words?: unknown[] };
        const { loadProject } = useEditorStore.getState();
        if (data.definition) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          loadProject(data.definition as any, (data.words ?? []) as any, file.name);
        }
      } catch {
        alert('파일을 읽을 수 없습니다.');
      }
    };
    input.click();
  };

  return (
    <header style={{
      height: 48,
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="6" fill="#1a1a2e"/>
          <rect x="4" y="4" width="10" height="10" rx="2" fill="#f59e0b"/>
          <rect x="18" y="18" width="10" height="10" rx="2" fill="#f59e0b"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', letterSpacing: '0.02em' }}>GIEngine</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Editor</span>
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

      {/* Actions */}
      <button onClick={newProject} style={btnStyle} title="새 프로젝트">
        ＋ 새 프로젝트
      </button>
      <button onClick={handleOpen} style={btnStyle} title="열기">
        📂 열기
      </button>
      <button
        onClick={() => saveProject()}
        disabled={!project}
        style={{ ...btnStyle, color: meta.isDirty ? 'var(--accent)' : undefined }}
        title="저장"
      >
        💾 저장{meta.isDirty ? ' *' : ''}
      </button>
      <button
        onClick={() => setExportModalOpen(true)}
        disabled={!project}
        style={{ ...btnStyle, opacity: !project ? 0.5 : 1 }}
        title="HTML 파일로 익스포트"
      >
        📤 익스포트
      </button>

      <div style={{ flex: 1 }} />

      {/* Project title */}
      {project && (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title[ui.editorLocale] || project.id}
        </span>
      )}

      <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

      {/* Locale toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => setEditorLocale('ko')}
          style={{
            ...btnStyle,
            background: ui.editorLocale === 'ko' ? 'var(--accent)' : 'transparent',
            color: ui.editorLocale === 'ko' ? '#000' : 'var(--text-secondary)',
          }}
        >
          KO
        </button>
        <button
          onClick={() => setEditorLocale('en')}
          style={{
            ...btnStyle,
            background: ui.editorLocale === 'en' ? 'var(--accent)' : 'transparent',
            color: ui.editorLocale === 'en' ? '#000' : 'var(--text-secondary)',
          }}
        >
          EN
        </button>
      </div>

      {/* Export modal */}
      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
    </header>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 500,
  background: 'transparent',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'background 0.15s',
};
