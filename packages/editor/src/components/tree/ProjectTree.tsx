import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Act, Case, Scene } from '@gi-engine/core';

// ── SceneNode ────────────────────────────────────────────────────

interface SceneNodeProps {
  scene: Scene;
  caseId: string;
  isSelected: boolean;
  onSelect: () => void;
}

const SceneNode = React.memo(function SceneNode({ scene, caseId, isSelected, onSelect }: SceneNodeProps): React.ReactElement {
  const editorLocale = useEditorStore(s => s.ui.editorLocale);
  const { updateScene } = useEditorStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const currentName = scene.name[editorLocale] || scene.id;

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) {
      updateScene(caseId, scene.id, { name: { ...scene.name, [editorLocale]: trimmed } });
    }
    setIsEditing(false);
  }, [editValue, updateScene, caseId, scene.id, scene.name, editorLocale]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(currentName);
  }, [currentName]);

  return (
    <div
      onClick={isEditing ? undefined : onSelect}
      style={{
        padding: '3px 12px 3px 40px',
        cursor: isEditing ? 'default' : 'pointer',
        fontSize: 12,
        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
        background: isSelected ? 'rgba(245,158,11,0.1)' : 'transparent',
        borderRadius: 3,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span>🎬</span>
      {isEditing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
          onBlur={commitEdit}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1,
            fontSize: 12,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--accent)',
            borderRadius: 2,
            padding: '1px 4px',
            outline: 'none',
            minWidth: 0,
          }}
        />
      ) : (
        <span
          onDoubleClick={handleDoubleClick}
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}
        >
          {currentName}
        </span>
      )}
    </div>
  );
});

// ── CaseNode ────────────────────────────────────────────────────

interface CaseNodeProps {
  caseData: Case;
  actId: string;
  isSelected: boolean;
  isExpanded: boolean;
  selectedSceneId: string | null;
  onSelect: () => void;
  onToggle: () => void;
  onSceneSelect: (sceneId: string) => void;
}

const CaseNode = React.memo(function CaseNode({ caseData, actId, isSelected, isExpanded, selectedSceneId, onSelect, onToggle, onSceneSelect }: CaseNodeProps): React.ReactElement {
  const editorLocale = useEditorStore(s => s.ui.editorLocale);
  const { addScene, deleteCase, updateCase } = useEditorStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const currentTitle = caseData.title[editorLocale] || caseData.id;

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) {
      updateCase(caseData.id, { title: { ...caseData.title, [editorLocale]: trimmed } });
    }
    setIsEditing(false);
  }, [editValue, updateCase, caseData.id, caseData.title, editorLocale]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(currentTitle);
  }, [currentTitle]);

  const handleAddScene = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addScene(caseData.id);
  }, [addScene, caseData.id]);

  const handleDeleteCase = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('사건을 삭제하시겠습니까?')) deleteCase(actId, caseData.id);
  }, [deleteCase, actId, caseData.id]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px 4px 24px',
          cursor: 'pointer',
          background: isSelected ? 'rgba(245,158,11,0.15)' : 'transparent',
          borderRadius: 3,
          gap: 4,
        }}
      >
        <button
          onClick={onToggle}
          aria-label={isExpanded ? '사건 접기' : '사건 펼치기'}
          aria-expanded={isExpanded}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, padding: 0, cursor: 'pointer', width: 14 }}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        <span style={{ marginRight: 2 }} aria-hidden="true">🔍</span>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onBlur={commitEdit}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              fontSize: 13,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--accent)',
              borderRadius: 2,
              padding: '1px 4px',
              outline: 'none',
              minWidth: 0,
            }}
          />
        ) : (
          <span
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
            style={{
              flex: 1,
              fontSize: 13,
              color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentTitle}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {caseData.scenes.length}씬
        </span>
        <button
          onClick={handleAddScene}
          style={iconBtn}
          title="씬 추가"
          aria-label="씬 추가"
        >
          +
        </button>
        <button
          onClick={handleDeleteCase}
          style={{ ...iconBtn, color: 'var(--danger)' }}
          title="사건 삭제"
          aria-label="사건 삭제"
        >
          ×
        </button>
      </div>
      {isExpanded && caseData.scenes.map(scene => (
        <SceneNode
          key={scene.id}
          scene={scene}
          caseId={caseData.id}
          isSelected={selectedSceneId === scene.id}
          onSelect={() => onSceneSelect(scene.id)}
        />
      ))}
    </div>
  );
});

// ── ActNode ─────────────────────────────────────────────────────

interface ActNodeProps {
  act: Act;
  isExpanded: boolean;
  selectedCaseId: string | null;
  selectedSceneId: string | null;
  onToggle: () => void;
}

const ActNode = React.memo(function ActNode({ act, isExpanded, selectedCaseId, selectedSceneId, onToggle }: ActNodeProps): React.ReactElement {
  const editorLocale = useEditorStore(s => s.ui.editorLocale);
  const { addCase, deleteAct, setSelection, updateAct, setActivePanel } = useEditorStore();
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const currentTitle = act.title[editorLocale] || act.id;

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed) {
      updateAct(act.id, { title: { ...act.title, [editorLocale]: trimmed } });
    }
    setIsEditing(false);
  }, [editValue, updateAct, act.id, act.title, editorLocale]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(currentTitle);
  }, [currentTitle]);

  const toggleCase = useCallback((caseId: string) => {
    setExpandedCases(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) next.delete(caseId); else next.add(caseId);
      return next;
    });
  }, []);

  const handleAddCase = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addCase(act.id);
  }, [addCase, act.id]);

  const handleDeleteAct = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('막을 삭제하시겠습니까?')) deleteAct(act.id);
  }, [deleteAct, act.id]);

  const handleCaseSelect = useCallback((c: Case) => {
    setSelection({ actId: act.id, caseId: c.id, sceneId: null, hotspotId: null });
    setActivePanel('words');
    if (!expandedCases.has(c.id)) toggleCase(c.id);
  }, [act.id, expandedCases, toggleCase, setSelection, setActivePanel]);

  const handleSceneSelect = useCallback((caseId: string, sceneId: string) => {
    setSelection({ caseId, sceneId, hotspotId: null });
    setActivePanel('scene');
  }, [setSelection, setActivePanel]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 8px',
          cursor: 'pointer',
          background: 'var(--bg-card)',
          borderRadius: 4,
          marginBottom: 2,
          gap: 4,
        }}
      >
        <button
          onClick={onToggle}
          aria-label={isExpanded ? '막 접기' : '막 펼치기'}
          aria-expanded={isExpanded}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, padding: 0, cursor: 'pointer', width: 14 }}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
        <span style={{ marginRight: 2 }} aria-hidden="true">📚</span>
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            }}
            onBlur={commitEdit}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--bg-card)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 2,
              padding: '1px 4px',
              outline: 'none',
              minWidth: 0,
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            onClick={onToggle}
            onDoubleClick={handleDoubleClick}
          >
            {currentTitle}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {act.cases.length}건
        </span>
        <button
          onClick={handleAddCase}
          style={iconBtn}
          title="사건 추가"
          aria-label="사건 추가"
        >
          +
        </button>
        <button
          onClick={handleDeleteAct}
          style={{ ...iconBtn, color: 'var(--danger)' }}
          title="막 삭제"
          aria-label="막 삭제"
        >
          ×
        </button>
      </div>
      {isExpanded && act.cases.map(c => (
        <CaseNode
          key={c.id}
          caseData={c}
          actId={act.id}
          isSelected={selectedCaseId === c.id}
          isExpanded={expandedCases.has(c.id)}
          selectedSceneId={selectedSceneId}
          onToggle={() => toggleCase(c.id)}
          onSelect={() => handleCaseSelect(c)}
          onSceneSelect={(sceneId) => handleSceneSelect(c.id, sceneId)}
        />
      ))}
    </div>
  );
});

// ── ProjectTree ──────────────────────────────────────────────────

export function ProjectTree(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selectedCaseId = useEditorStore(s => s.selection.caseId);
  const selectedSceneId = useEditorStore(s => s.selection.sceneId);
  const { addAct } = useEditorStore();
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set());

  const toggleAct = useCallback((actId: string) => {
    setExpandedActs(prev => {
      const next = new Set(prev);
      if (next.has(actId)) next.delete(actId); else next.add(actId);
      return next;
    });
  }, []);

  if (!project) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
        프로젝트를 열거나 새로 만드세요
      </div>
    );
  }

  return (
    <div style={{ padding: 8, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>막/사건/씬</span>
        <button onClick={addAct} style={{ ...iconBtn, fontSize: 13, padding: '2px 8px' }} aria-label="새 막 추가">
          + 막 추가
        </button>
      </div>

      {project.acts.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>
          막이 없습니다.<br />위에서 막을 추가하세요.
        </div>
      ) : (
        project.acts.map(act => (
          <ActNode
            key={act.id}
            act={act}
            isExpanded={expandedActs.has(act.id)}
            selectedCaseId={selectedCaseId}
            selectedSceneId={selectedSceneId}
            onToggle={() => toggleAct(act.id)}
          />
        ))
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '1px 4px',
  fontSize: 14,
  borderRadius: 2,
  lineHeight: 1,
};
