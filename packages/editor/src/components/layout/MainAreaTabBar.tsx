import React from 'react';
import { useEditorStore } from '@/store/editor-store';

export function MainAreaTabBar(): React.ReactElement {
  const activePanel = useEditorStore(s => s.ui.activePanel);
  const wordCount = useEditorStore(s => {
    const caseId = s.selection.caseId;
    return caseId ? s.words.filter(w => w.caseId === caseId).length : 0;
  });
  const { setActivePanel } = useEditorStore();

  const subPuzzleCount = useEditorStore(s => {
    const caseId = s.selection.caseId;
    if (!caseId || !s.project) return 0;
    for (const act of s.project.acts) {
      const c = act.cases.find(cs => cs.id === caseId);
      if (c) return c.puzzles.sub.length;
    }
    return 0;
  });

  const isSceneActive = activePanel === 'scene' || activePanel === 'assets' || activePanel === 'settings';
  const isWordsActive = activePanel === 'words';
  const isPuzzleActive = activePanel === 'puzzle';
  const isSubPuzzleActive = activePanel === 'subPuzzle';

  const containerStyle: React.CSSProperties = {
    height: 36,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 4,
    flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
  };

  const tabBaseStyle: React.CSSProperties = {
    padding: '0 14px',
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
  };

  const tabActiveStyle: React.CSSProperties = {
    ...tabBaseStyle,
    color: 'var(--accent)',
    fontWeight: 700,
    borderBottom: '3px solid var(--accent)',
  };

  const badgeStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    minWidth: 18,
    height: 16,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    padding: '0 4px',
  };

  return (
    <div style={containerStyle}>
      <button
        style={isSceneActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('scene')}
      >
        씬 편집
      </button>
      <button
        style={isWordsActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('words')}
      >
        단어 관리
        <span style={badgeStyle}>{wordCount}</span>
      </button>
      <button
        style={isPuzzleActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('puzzle')}
      >
        퍼즐 편집
      </button>
      <button
        style={isSubPuzzleActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('subPuzzle')}
      >
        서브 퍼즐
        <span style={badgeStyle}>{subPuzzleCount}</span>
      </button>
    </div>
  );
}
