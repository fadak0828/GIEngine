import React, { useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';
import { useEditorStore } from '@/store/editor-store';
import type { ActivePanel } from '@/store/editor-store';

export function App(): React.ReactElement {
  const project = useEditorStore((s) => s.project);
  const isDirty = useEditorStore((s) => s.meta.isDirty);
  const autoSaveEnabled = useEditorStore((s) => s.ui.autoSaveEnabled);
  const autoSaveIntervalMs = useEditorStore((s) => s.ui.autoSaveIntervalMs);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
    };

    const PANEL_KEYS: Record<string, ActivePanel> = {
      '1': 'scene',
      '2': 'assets',
      '3': 'words',
      '4': 'puzzle',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          useEditorStore.getState().undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          useEditorStore.getState().redo();
        } else if (e.key === 's') {
          e.preventDefault();
          useEditorStore.getState().saveProject();
        } else if (e.key === 'n') {
          e.preventDefault();
          useEditorStore.getState().newProject();
        } else if (e.key === '/') {
          e.preventDefault();
          const store = useEditorStore.getState();
          store.setShortcutHelpOpen(!store.ui.shortcutHelpOpen);
        } else if (PANEL_KEYS[e.key]) {
          e.preventDefault();
          useEditorStore.getState().setActivePanel(PANEL_KEYS[e.key]);
        }
        return;
      }

      // Alt+Arrow: scene navigation within selected case
      if (e.altKey && !isTyping()) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const state = useEditorStore.getState();
          const { project, selection } = state;
          if (!project || !selection.caseId || !selection.sceneId) return;
          for (const act of project.acts) {
            const caze = act.cases.find(cs => cs.id === selection.caseId);
            if (!caze) continue;
            const idx = caze.scenes.findIndex(s => s.id === selection.sceneId);
            if (idx === -1) continue;
            e.preventDefault();
            const delta = e.key === 'ArrowLeft' ? -1 : 1;
            const newIdx = (idx + delta + caze.scenes.length) % caze.scenes.length;
            state.setSelectedScene(caze.scenes[newIdx].id);
            return;
          }
        }
        return;
      }

      // Non-modifier shortcuts — suppress when typing
      if (e.key === '?' && !isTyping()) {
        e.preventDefault();
        const store = useEditorStore.getState();
        store.setShortcutHelpOpen(!store.ui.shortcutHelpOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Beforeunload warning on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Auto-save
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (autoSaveEnabled) {
      autoSaveTimerRef.current = setInterval(() => {
        const state = useEditorStore.getState();
        if (state.meta.isDirty && state.project) {
          state.saveProject();
        }
      }, autoSaveIntervalMs);
    }
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [autoSaveEnabled, autoSaveIntervalMs]);

  if (!project) {
    return <WelcomeScreen />;
  }

  return <MainLayout />;
}
