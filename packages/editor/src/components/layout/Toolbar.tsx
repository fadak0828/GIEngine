import React, { useEffect, useState } from 'react';
import { useEditorStore, useCanUndo, useCanRedo } from '@/store/editor-store';
import { ExportModal } from '@/components/export/ExportModal';
import { AISettingsModal } from '@/components/ai/AISettings';
import { InterviewChatModal } from '@/components/ai/InterviewChatModal';
import { CaseBlueprintPreview } from '@/components/ai/CaseBlueprintPreview';
import { QuickCreateModal } from '@/components/ai/QuickCreateModal';

export function Toolbar(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const meta = useEditorStore(s => s.meta);
  const ui = useEditorStore(s => s.ui);
  const { newProject, saveProject, setEditorLocale, undo, redo, openInterview, openQuickCreate, setFullscreen, showNotification } = useEditorStore();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const fullscreenSupported = document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [setFullscreen]);

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

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      showNotification('Failed to switch fullscreen mode.', 'error');
    }
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
          <rect width="32" height="32" rx="6" fill="var(--bg-card)"/>
          <rect x="4" y="4" width="10" height="10" rx="2" fill="var(--accent)"/>
          <rect x="18" y="18" width="10" height="10" rx="2" fill="var(--accent)"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', letterSpacing: '0.02em' }}>GIEngine</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Editor</span>
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

      {/* Actions */}
      <button onClick={newProject} style={btnStyle} title="새 프로젝트 (Ctrl+N)" aria-label="새 프로젝트 만들기 (Ctrl+N)">
        ＋ 새 프로젝트
      </button>
      <button onClick={handleOpen} style={btnStyle} title="열기" aria-label="프로젝트 파일 열기">
        📂 열기
      </button>
      <button
        onClick={() => saveProject()}
        disabled={!project}
        style={{ ...btnStyle, color: meta.isDirty ? 'var(--accent)' : undefined }}
        title="저장 (Ctrl+S)"
        aria-label={`프로젝트 저장 (Ctrl+S)${meta.isDirty ? ' — 저장되지 않은 변경사항 있음' : ''}`}
      >
        💾 저장{meta.isDirty ? ' *' : ''}
      </button>
      <button
        onClick={() => setExportModalOpen(true)}
        disabled={!project}
        style={{ ...btnStyle, opacity: !project ? 0.5 : 1 }}
        title="HTML 파일로 익스포트"
        aria-label="HTML 파일로 익스포트"
      >
        📤 익스포트
      </button>

      <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} aria-hidden="true" />

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        style={{ ...btnStyle, opacity: canUndo ? 1 : 0.4 }}
        title="실행 취소 (Ctrl+Z)"
        aria-label="실행 취소 (Ctrl+Z)"
        aria-disabled={!canUndo}
      >
        ↩ 취소
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        style={{ ...btnStyle, opacity: canRedo ? 1 : 0.4 }}
        title="다시 실행 (Ctrl+Y)"
        aria-label="다시 실행 (Ctrl+Y)"
        aria-disabled={!canRedo}
      >
        ↪ 복구
      </button>

      <button
        onClick={handleToggleFullscreen}
        disabled={!fullscreenSupported}
        style={{ ...btnStyle, opacity: fullscreenSupported ? 1 : 0.4 }}
        title={ui.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-label={ui.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-pressed={ui.isFullscreen}
      >
        {ui.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      </button>

      <div style={{ flex: 1 }} />

      {/* Project title */}
      {project && (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.title[ui.editorLocale] || project.id}
        </span>
      )}

      {/* Quick Create */}
      <button
        onClick={() => openQuickCreate(undefined)}
        style={{
          ...btnStyle,
          background: 'var(--accent)',
          borderColor: 'var(--accent)',
          color: '#000',
          fontWeight: 600,
        }}
        title="1문장으로 빠르게 사건 생성"
        aria-label="Quick Create — 1문장으로 빠르게 사건 생성"
      >
        ⚡ Quick Create
      </button>

      {/* AI Interview — redirects to QuickCreate since InterviewEngine is deprecated (FADAA-107) */}
      <button
        onClick={() => openQuickCreate(undefined)}
        style={{
          ...btnStyle,
          background: 'var(--accent-dim)',
          borderColor: 'rgba(212,150,58,0.4)',
          color: 'var(--accent)',
        }}
        title="AI 인터뷰로 새 사건 생성 (상세)"
        aria-label="AI 인터뷰로 새 사건 생성"
      >
        🕵️ AI 인터뷰
      </button>

      {/* AI settings */}
      <button
        onClick={() => setAiSettingsOpen(true)}
        style={btnStyle}
        title="AI 모델 설정"
        aria-label="AI 모델 설정"
      >
        AI 설정
      </button>

      <div style={{ width: 1, height: 24, background: 'var(--border-color)' }} />

      {/* Locale toggle */}
      <div role="group" aria-label="편집 언어 선택" style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => setEditorLocale('ko')}
          aria-label="한국어로 편집"
          aria-pressed={ui.editorLocale === 'ko'}
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
          aria-label="영어로 편집"
          aria-pressed={ui.editorLocale === 'en'}
          style={{
            ...btnStyle,
            background: ui.editorLocale === 'en' ? 'var(--accent)' : 'transparent',
            color: ui.editorLocale === 'en' ? '#000' : 'var(--text-secondary)',
          }}
        >
          EN
        </button>
      </div>

      {/* Modals */}
      <ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />
      <AISettingsModal open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
      <InterviewChatModal />
      <CaseBlueprintPreview />
      <QuickCreateModal />

      {/* Notification toast */}
      {ui.notification && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 18px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          background: ui.notification.type === 'success' ? 'var(--success)' : 'var(--danger)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          {ui.notification.message}
        </div>
      )}
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
