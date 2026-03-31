import React from 'react';
import type { RelationshipPuzzle, LocalizedText } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { FieldRow } from './FieldRow';
import { inputStyle, sectionLabelStyle, smallBtnStyle, dangerBtnStyle, cardStyle } from './styles';

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
    patch: Partial<{ id: string; label: LocalizedText }>,
  ) => {
    const updated = puzzle.nodes.map((n, i) =>
      i === idx ? { ...n, ...patch } : n,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: updated,
    } as Partial<RelationshipPuzzle>);
  };

  const removeNode = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: puzzle.nodes.filter((_, i) => i !== idx),
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
            <FieldRow label="노드 ID">
              <input
                value={node.id}
                onChange={e => updateNode(idx, { id: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
            <LocalizedTextInput
              label="라벨"
              value={node.label}
              onChange={label => updateNode(idx, { label })}
            />
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
            <FieldRow label="출발 노드">
              <input
                value={edge.fromNodeId}
                onChange={e => updateEdge(idx, { fromNodeId: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="도착 노드">
              <input
                value={edge.toNodeId}
                onChange={e => updateEdge(idx, { toNodeId: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="슬롯 ID">
              <input
                value={edge.slotId}
                onChange={e => updateEdge(idx, { slotId: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="정답 ID">
              <input
                value={edge.answerId}
                onChange={e => updateEdge(idx, { answerId: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
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
