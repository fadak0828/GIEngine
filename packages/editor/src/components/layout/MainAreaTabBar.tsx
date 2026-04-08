import React, { useMemo } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { validateProjectDefinition } from '@gi-engine/core';

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

  const assetCount = useEditorStore(s =>
    s.project ? Object.keys(s.project.assets.items).length : 0
  );

  const validationResult = useMemo(() => {
    const project = useEditorStore.getState().project;
    const words = useEditorStore.getState().words;
    if (!project) return null;
    return validateProjectDefinition(project, words);
  }, []);

  const validationErrorCount = validationResult?.errorCount ?? 0;

  const isSceneActive = activePanel === 'scene' || activePanel === 'settings';
  const isAssetsActive = activePanel === 'assets';
  const isWordsActive = activePanel === 'words';
  const isPuzzleActive = activePanel === 'puzzle';
  const isSubPuzzleActive = activePanel === 'subPuzzle';
  const isValidationActive = activePanel === 'validation';

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
    outline: 'none',
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

  const errorBadgeStyle: React.CSSProperties = {
    ...badgeStyle,
    background: 'rgba(196,64,64,0.15)',
    color: 'var(--danger-text)',
    border: '1px solid rgba(196,64,64,0.3)',
  };

  return (
    <div role="tablist" aria-label="에디터 패널" style={containerStyle}>
      <button
        id="tab-scene"
        role="tab"
        aria-selected={isSceneActive}
        aria-controls="panel-scene"
        style={isSceneActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('scene')}
        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        씬 편집
      </button>
      <button
        id="tab-assets"
        role="tab"
        aria-selected={isAssetsActive}
        aria-controls="panel-assets"
        style={isAssetsActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('assets')}
        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        에셋 관리
        <span style={badgeStyle} aria-label={`에셋 ${assetCount}개`}>{assetCount}</span>
      </button>
      <button
        id="tab-words"
        role="tab"
        aria-selected={isWordsActive}
        aria-controls="panel-words"
        style={isWordsActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('words')}
        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        단어 관리
        <span style={badgeStyle} aria-label={`단어 ${wordCount}개`}>{wordCount}</span>
      </button>
      <button
        id="tab-puzzle"
        role="tab"
        aria-selected={isPuzzleActive}
        aria-controls="panel-puzzle"
        style={isPuzzleActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('puzzle')}
        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        퍼즐 편집
      </button>
      <button
        id="tab-subpuzzle"
        role="tab"
        aria-selected={isSubPuzzleActive}
        aria-controls="panel-subpuzzle"
        style={isSubPuzzleActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('subPuzzle')}
        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        서브 퍼즐
        <span style={badgeStyle} aria-label={`서브 퍼즐 ${subPuzzleCount}개`}>{subPuzzleCount}</span>
      </button>
      <button
        id="tab-validation"
        role="tab"
        aria-selected={isValidationActive}
        aria-controls="panel-validation"
        style={isValidationActive ? tabActiveStyle : tabBaseStyle}
        onClick={() => setActivePanel('validation')}
        onFocus={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 2px var(--accent)'; }}
        onBlur={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
      >
        검증
        {validationErrorCount > 0 && (
          <span style={errorBadgeStyle} aria-label={`${validationErrorCount}개의 오류`}>
            {validationErrorCount}
          </span>
        )}
      </button>
    </div>
  );
}
