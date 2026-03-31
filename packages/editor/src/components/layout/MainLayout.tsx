import React from 'react';
import { Toolbar } from './Toolbar';
import { MainAreaTabBar } from './MainAreaTabBar';
import { ProjectTree } from '@/components/tree/ProjectTree';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { PropertiesPanel } from '@/components/properties/PropertiesPanel';
import { PreviewPane } from '@/components/preview/PreviewPane';
import { PuzzleEditorPanel } from '@/components/puzzle/PuzzleEditorPanel';
import { SubPuzzlePanel } from '@/components/puzzle/SubPuzzlePanel';
import { WordManagerPanel } from '@/components/words/WordManagerPanel';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { useEditorStore } from '@/store/editor-store';

export function MainLayout(): React.ReactElement {
  const ui = useEditorStore(s => s.ui);

  const renderCenterContent = () => {
    if (ui.activePanel === 'puzzle') return <PuzzleEditorPanel />;
    if (ui.activePanel === 'subPuzzle') return <SubPuzzlePanel />;
    if (ui.activePanel === 'words') return <WordManagerPanel />;
    if (ui.activePanel === 'validation') return <ValidationPanel />;
    return <SceneCanvas />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel */}
        <div style={{
          width: ui.leftPanelWidth,
          minWidth: 180,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <ProjectTree />
        </div>

        {/* Center panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <MainAreaTabBar />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            {renderCenterContent()}
          </div>
          <PreviewPane />
        </div>

        {/* Right panel */}
        <div style={{
          width: ui.rightPanelWidth,
          minWidth: 240,
          background: 'var(--bg-panel)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <PropertiesPanel />
        </div>
      </div>
    </div>
  );
}
