import React, { useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';
import { useEditorStore } from '@/store/editor-store';

export function App(): React.ReactElement {
  const project = useEditorStore((s) => s.project);
  const isDirty = useEditorStore((s) => s.meta.isDirty);
  const autoSaveEnabled = useEditorStore((s) => s.ui.autoSaveEnabled);
  const autoSaveIntervalMs = useEditorStore((s) => s.ui.autoSaveIntervalMs);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          useEditorStore.getState().undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          useEditorStore.getState().redo();
        } else if (e.key === 's') {
          e.preventDefault();
          useEditorStore.getState().saveProject();
        }
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
