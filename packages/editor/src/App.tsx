import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { WelcomeScreen } from '@/components/layout/WelcomeScreen';
import { useEditorStore } from '@/store/editor-store';

export function App(): React.ReactElement {
  const project = useEditorStore((s) => s.project);

  if (!project) {
    return <WelcomeScreen />;
  }

  return <MainLayout />;
}
