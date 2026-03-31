import React, { useRef, useState } from 'react';
import type { RelationshipPuzzle, LocalizedText } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { ImageAssetPicker } from '@/components/shared/ImageAssetPicker';
import { WordDropdown } from '@/components/words/WordDropdown';
import { useClickOutside } from '@/hooks/useClickOutside';
import { FieldRow } from './FieldRow';
import { sectionLabelStyle, smallBtnStyle, dangerBtnStyle, cardStyle } from './styles';

// ── Readonly ID style ─────────────────────────────────────────────

const readonlyIdStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  color: 'var(--text-muted)',
  padding: '2px 4px',
  background: 'var(--bg-primary)',
  borderRadius: 2,
};

// ── NodeSelect ─────────────────────────────────────────────────────

interface NodeSelectProps {
  nodes: RelationshipPuzzle['nodes'];
  value: string;
  onChange: (nodeId: string) => void;
  onAddNode?: () => void;
  label?: string;
}

function NodeSelect({ nodes, value, onChange, onAddNode, label }: NodeSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const selectedNode = nodes.find(n => n.id === value);

  const displayLabel = (node: RelationshipPuzzle['nodes'][number]) =>
    node.label.ko ? `${node.label.ko} (${node.id})` : `(${node.id})`;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
      {label && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
      )}

      {/* Trigger */}
      <div
        onClick={() => setIsOpen(v => !v)}
        style={{
          padding: '4px 6px',
          border: '1px solid var(--border-color)',
          borderRadius: 3,
          background: 'var(--bg-card)',
          cursor: 'pointer',
          fontSize: 12,
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          minHeight: 28,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {value && selectedNode ? displayLabel(selectedNode) : value ? `(알 수 없음 — ${value})` : '노드 선택...'}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: 2,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {nodes.length === 0 ? (
            <div
              style={{
                padding: '8px 10px',
                fontSize: 11,
                color: 'var(--text-muted)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <span>노드가 없습니다</span>
              {onAddNode && (
                <button
                  onClick={() => { onAddNode(); setIsOpen(false); }}
                  style={{
                    padding: '2px 8px',
                    fontSize: 11,
                    background: 'transparent',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  + 노드 추가
                </button>
              )}
            </div>
          ) : (
            nodes.map(node => {
              const isSelected = node.id === value;
              return (
                <div
                  key={node.id}
                  onClick={() => { onChange(node.id); setIsOpen(false); }}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-dim)' : 'transparent',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => {
                    if (!isSelected)
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected)
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  {isSelected && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>}
                  <span>{displayLabel(node)}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── RelationshipFields ────────────────────────────────────────────

export function RelationshipFields({
  puzzle,
  caseId,
}: {
  puzzle: RelationshipPuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  const addNode = () => {
    const node = {
      id: `node_${Date.now()}`,
      label: { ko: '', en: '' } as LocalizedText,
    };
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: [...puzzle.nodes, node],
    } as Partial<RelationshipPuzzle>);
  };

  const updateNode = (
    idx: number,
    patch: Partial<RelationshipPuzzle['nodes'][number]>,
  ) => {
    const updated = puzzle.nodes.map((n, i) =>
      i === idx ? { ...n, ...patch } : n,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: updated,
    } as Partial<RelationshipPuzzle>);
  };

  const removeNode = (idx: number) => {
    const removedId = puzzle.nodes[idx]?.id;
    const newNodes = puzzle.nodes.filter((_, i) => i !== idx);
    // Cascade: reset edges that reference this node
    const newEdges = puzzle.edges.map(e => ({
      ...e,
      fromNodeId: e.fromNodeId === removedId ? '' : e.fromNodeId,
      toNodeId: e.toNodeId === removedId ? '' : e.toNodeId,
    }));
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: newNodes,
      edges: newEdges,
    } as Partial<RelationshipPuzzle>);
  };

  const addEdge = () => {
    const edge = {
      fromNodeId: '',
      toNodeId: '',
      slotId: `slot_${Date.now()}`,
      answerId: '',
    };
    updateSubPuzzle(caseId, puzzle.id, {
      edges: [...puzzle.edges, edge],
    } as Partial<RelationshipPuzzle>);
  };

  const updateEdge = (
    idx: number,
    patch: Partial<RelationshipPuzzle['edges'][number]>,
  ) => {
    const updated = puzzle.edges.map((e, i) =>
      i === idx ? { ...e, ...patch } : e,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      edges: updated,
    } as Partial<RelationshipPuzzle>);
  };

  const removeEdge = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      edges: puzzle.edges.filter((_, i) => i !== idx),
    } as Partial<RelationshipPuzzle>);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Nodes column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={sectionLabelStyle}>노드 ({puzzle.nodes.length})</div>
        {puzzle.nodes.map((node, idx) => (
          <div key={idx} style={cardStyle}>
            {/* node id: 읽기 전용 */}
            <FieldRow label="노드 ID">
              <span style={readonlyIdStyle}>{node.id}</span>
            </FieldRow>

            <LocalizedTextInput
              label="라벨"
              value={node.label}
              onChange={label => updateNode(idx, { label })}
            />

            {/* portrait: ImageAssetPicker */}
            <FieldRow label="초상화">
              <ImageAssetPicker
                assetId={node.portrait ?? ''}
                onChange={portrait => updateNode(idx, { portrait })}
              />
            </FieldRow>

            <button onClick={() => removeNode(idx)} style={dangerBtnStyle}>
              노드 삭제
            </button>
          </div>
        ))}
        <button onClick={addNode} style={smallBtnStyle}>
          + 노드 추가
        </button>
      </div>

      {/* Edges column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={sectionLabelStyle}>엣지 ({puzzle.edges.length})</div>
        {puzzle.edges.map((edge, idx) => (
          <div key={idx} style={cardStyle}>
            {/* fromNodeId: NodeSelect */}
            <NodeSelect
              nodes={puzzle.nodes}
              value={edge.fromNodeId}
              onChange={fromNodeId => updateEdge(idx, { fromNodeId })}
              onAddNode={addNode}
              label="출발 노드"
            />

            {/* toNodeId: NodeSelect */}
            <NodeSelect
              nodes={puzzle.nodes}
              value={edge.toNodeId}
              onChange={toNodeId => updateEdge(idx, { toNodeId })}
              onAddNode={addNode}
              label="도착 노드"
            />

            {/* slotId: 읽기 전용 */}
            <FieldRow label="슬롯 ID">
              <span style={readonlyIdStyle}>{edge.slotId}</span>
            </FieldRow>

            {/* answerId: WordDropdown singleSelect */}
            <WordDropdown
              caseId={caseId}
              singleSelect
              wordId={edge.answerId}
              onChangeSingle={answerId => updateEdge(idx, { answerId })}
              label="정답 단어"
            />

            <button onClick={() => removeEdge(idx)} style={dangerBtnStyle}>
              엣지 삭제
            </button>
          </div>
        ))}
        <button onClick={addEdge} style={smallBtnStyle}>
          + 엣지 추가
        </button>
      </div>
    </div>
  );
}
