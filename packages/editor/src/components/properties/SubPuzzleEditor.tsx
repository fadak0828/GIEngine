import React, { useState } from 'react';
import type {
  Case,
  SubPuzzle,
  CharacterIdPuzzle,
  TimelinePuzzle,
  RelationshipPuzzle,
  ScenarioPuzzle,
  LocalizedText,
  CharacterSlot,
  TimelineSlot,
} from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';

// ── Helpers ──────────────────────────────────────────────────────

const SUB_PUZZLE_TYPE_LABELS: Record<SubPuzzle['type'], string> = {
  character_id: '인물',
  timeline: '타임라인',
  relationship: '관계',
  scenario: '시나리오',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: 12,
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  outline: 'none',
  boxSizing: 'border-box',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
};

const smallBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  cursor: 'pointer',
};

const dangerBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  color: '#ef4444',
  borderColor: '#ef4444',
};

// ── Character ID sub-editor ──────────────────────────────────────

function CharacterIdFields({
  puzzle,
  caseId,
}: {
  puzzle: CharacterIdPuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  const addCharacter = () => {
    const slot: CharacterSlot = {
      portrait: '',
      nameSlotId: `slot_${Date.now()}`,
      answerId: '',
    };
    updateSubPuzzle(caseId, puzzle.id, {
      characters: [...puzzle.characters, slot],
    } as Partial<CharacterIdPuzzle>);
  };

  const updateCharacter = (idx: number, patch: Partial<CharacterSlot>) => {
    const updated = puzzle.characters.map((c, i) =>
      i === idx ? { ...c, ...patch } : c,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      characters: updated,
    } as Partial<CharacterIdPuzzle>);
  };

  const removeCharacter = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      characters: puzzle.characters.filter((_, i) => i !== idx),
    } as Partial<CharacterIdPuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={sectionLabelStyle}>캐릭터 슬롯 ({puzzle.characters.length})</div>
      {puzzle.characters.map((char, idx) => (
        <div
          key={idx}
          style={{
            padding: 8,
            background: 'var(--bg-primary)',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <FieldRow label="초상화 (Asset)">
            <input
              value={char.portrait}
              onChange={e => updateCharacter(idx, { portrait: e.target.value })}
              placeholder="asset_id"
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="슬롯 ID">
            <input
              value={char.nameSlotId}
              onChange={e => updateCharacter(idx, { nameSlotId: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="정답 ID">
            <input
              value={char.answerId}
              onChange={e => updateCharacter(idx, { answerId: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <button onClick={() => removeCharacter(idx)} style={dangerBtnStyle}>
            슬롯 삭제
          </button>
        </div>
      ))}
      <button onClick={addCharacter} style={smallBtnStyle}>
        + 캐릭터 슬롯 추가
      </button>
    </div>
  );
}

// ── Timeline sub-editor ──────────────────────────────────────────

function TimelineFields({
  puzzle,
  caseId,
}: {
  puzzle: TimelinePuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  const addSlot = () => {
    const slot: TimelineSlot = {
      slotId: `slot_${Date.now()}`,
      label: { ko: '', en: '' },
      answerId: '',
    };
    updateSubPuzzle(caseId, puzzle.id, {
      slots: [...puzzle.slots, slot],
    } as Partial<TimelinePuzzle>);
  };

  const updateSlot = (idx: number, patch: Partial<TimelineSlot>) => {
    const updated = puzzle.slots.map((s, i) =>
      i === idx ? { ...s, ...patch } : s,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      slots: updated,
    } as Partial<TimelinePuzzle>);
  };

  const removeSlot = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      slots: puzzle.slots.filter((_, i) => i !== idx),
    } as Partial<TimelinePuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={sectionLabelStyle}>타임라인 슬롯 ({puzzle.slots.length})</div>
      {puzzle.slots.map((slot, idx) => (
        <div
          key={idx}
          style={{
            padding: 8,
            background: 'var(--bg-primary)',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <FieldRow label="슬롯 ID">
            <input
              value={slot.slotId}
              onChange={e => updateSlot(idx, { slotId: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <LocalizedTextInput
            label="라벨"
            value={slot.label}
            onChange={label => updateSlot(idx, { label })}
          />
          <FieldRow label="정답 ID">
            <input
              value={slot.answerId}
              onChange={e => updateSlot(idx, { answerId: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <button onClick={() => removeSlot(idx)} style={dangerBtnStyle}>
            슬롯 삭제
          </button>
        </div>
      ))}
      <button onClick={addSlot} style={smallBtnStyle}>
        + 타임라인 슬롯 추가
      </button>
    </div>
  );
}

// ── Relationship sub-editor ──────────────────────────────────────

function RelationshipFields({
  puzzle,
  caseId,
}: {
  puzzle: RelationshipPuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  const addNode = () => {
    const node = { id: `node_${Date.now()}`, label: { ko: '', en: '' } as LocalizedText };
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: [...puzzle.nodes, node],
    } as Partial<RelationshipPuzzle>);
  };

  const updateNode = (idx: number, patch: Partial<{ id: string; label: LocalizedText }>) => {
    const updated = puzzle.nodes.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    updateSubPuzzle(caseId, puzzle.id, { nodes: updated } as Partial<RelationshipPuzzle>);
  };

  const removeNode = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      nodes: puzzle.nodes.filter((_, i) => i !== idx),
    } as Partial<RelationshipPuzzle>);
  };

  const addEdge = () => {
    const edge = { fromNodeId: '', toNodeId: '', slotId: `slot_${Date.now()}`, answerId: '' };
    updateSubPuzzle(caseId, puzzle.id, {
      edges: [...puzzle.edges, edge],
    } as Partial<RelationshipPuzzle>);
  };

  const updateEdge = (idx: number, patch: Partial<RelationshipPuzzle['edges'][number]>) => {
    const updated = puzzle.edges.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    updateSubPuzzle(caseId, puzzle.id, { edges: updated } as Partial<RelationshipPuzzle>);
  };

  const removeEdge = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      edges: puzzle.edges.filter((_, i) => i !== idx),
    } as Partial<RelationshipPuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Nodes */}
      <div style={sectionLabelStyle}>노드 ({puzzle.nodes.length})</div>
      {puzzle.nodes.map((node, idx) => (
        <div
          key={idx}
          style={{
            padding: 8,
            background: 'var(--bg-primary)',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
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

      {/* Edges */}
      <div style={{ ...sectionLabelStyle, marginTop: 8 }}>엣지 ({puzzle.edges.length})</div>
      {puzzle.edges.map((edge, idx) => (
        <div
          key={idx}
          style={{
            padding: 8,
            background: 'var(--bg-primary)',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
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
  );
}

// ── Scenario sub-editor ──────────────────────────────────────────

function ScenarioFields({
  puzzle,
  caseId,
}: {
  puzzle: ScenarioPuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  // Simplified: let users edit the raw answers map as key-value pairs
  const answerEntries = Object.entries(puzzle.answers);

  const addAnswer = () => {
    const key = `slot_${Date.now()}`;
    updateSubPuzzle(caseId, puzzle.id, {
      answers: { ...puzzle.answers, [key]: { correctWordId: '' } },
    } as Partial<ScenarioPuzzle>);
  };

  const updateAnswerKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    const entries = Object.entries(puzzle.answers);
    const newAnswers: Record<string, { correctWordId: string; partiallyCorrectWordIds?: string[] }> = {};
    for (const [k, v] of entries) {
      newAnswers[k === oldKey ? newKey : k] = v;
    }
    updateSubPuzzle(caseId, puzzle.id, { answers: newAnswers } as Partial<ScenarioPuzzle>);
  };

  const updateAnswerValue = (key: string, correctWordId: string) => {
    updateSubPuzzle(caseId, puzzle.id, {
      answers: { ...puzzle.answers, [key]: { ...puzzle.answers[key], correctWordId } },
    } as Partial<ScenarioPuzzle>);
  };

  const removeAnswer = (key: string) => {
    const { [key]: _, ...rest } = puzzle.answers;
    updateSubPuzzle(caseId, puzzle.id, { answers: rest } as Partial<ScenarioPuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={sectionLabelStyle}>정답 ({answerEntries.length})</div>
      {answerEntries.map(([key, val]) => (
        <div
          key={key}
          style={{
            padding: 8,
            background: 'var(--bg-primary)',
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <FieldRow label="슬롯 ID">
            <input
              value={key}
              onChange={e => updateAnswerKey(key, e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="정답 단어 ID">
            <input
              value={val.correctWordId}
              onChange={e => updateAnswerValue(key, e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <button onClick={() => removeAnswer(key)} style={dangerBtnStyle}>
            정답 삭제
          </button>
        </div>
      ))}
      <button onClick={addAnswer} style={smallBtnStyle}>
        + 정답 추가
      </button>
    </div>
  );
}

// ── FieldRow helper ──────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  );
}

// ── SubPuzzleCard ────────────────────────────────────────────────

function SubPuzzleCard({
  puzzle,
  caseId,
}: {
  puzzle: SubPuzzle;
  caseId: string;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { updateSubPuzzle, deleteSubPuzzle } = useEditorStore();

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteSubPuzzle(caseId, puzzle.id);
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          cursor: 'pointer',
          userSelect: 'none',
          background: expanded ? 'var(--bg-secondary)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            &#9654;
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {puzzle.title.ko || puzzle.id}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 8,
              background: 'var(--bg-primary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
            }}
          >
            {SUB_PUZZLE_TYPE_LABELS[puzzle.type]}
          </span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-color)' }}>
          {/* ID (read-only) */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {puzzle.id}</div>

          {/* Title */}
          <LocalizedTextInput
            label="제목"
            value={puzzle.title}
            onChange={title => updateSubPuzzle(caseId, puzzle.id, { title } as Partial<SubPuzzle>)}
          />

          {/* Type-specific fields */}
          {puzzle.type === 'character_id' && (
            <CharacterIdFields puzzle={puzzle} caseId={caseId} />
          )}
          {puzzle.type === 'timeline' && (
            <TimelineFields puzzle={puzzle} caseId={caseId} />
          )}
          {puzzle.type === 'relationship' && (
            <RelationshipFields puzzle={puzzle} caseId={caseId} />
          )}
          {puzzle.type === 'scenario' && (
            <ScenarioFields puzzle={puzzle} caseId={caseId} />
          )}

          {/* Delete button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
            {confirmDelete && (
              <button
                onClick={() => setConfirmDelete(false)}
                style={smallBtnStyle}
              >
                취소
              </button>
            )}
            <button onClick={handleDelete} style={dangerBtnStyle}>
              {confirmDelete ? '정말 삭제' : '삭제'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main: SubPuzzleEditor ────────────────────────────────────────

interface SubPuzzleEditorProps {
  caseData: Case;
}

export function SubPuzzleEditor({ caseData }: SubPuzzleEditorProps): React.ReactElement {
  const { addSubPuzzle } = useEditorStore();
  const subPuzzles = caseData.puzzles.sub;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 12 }}>
      <div style={sectionLabelStyle}>
        서브 퍼즐 ({subPuzzles.length})
      </div>

      {/* Sub-puzzle list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {subPuzzles.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
            아직 서브 퍼즐이 없습니다.
          </div>
        )}
        {subPuzzles.map(sp => (
          <SubPuzzleCard key={sp.id} puzzle={sp} caseId={caseData.id} />
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <button
          onClick={() => addSubPuzzle(caseData.id, 'character_id')}
          style={smallBtnStyle}
        >
          + 인물
        </button>
        <button
          onClick={() => addSubPuzzle(caseData.id, 'timeline')}
          style={smallBtnStyle}
        >
          + 타임라인
        </button>
        <button
          onClick={() => addSubPuzzle(caseData.id, 'relationship')}
          style={smallBtnStyle}
        >
          + 관계
        </button>
        <button
          onClick={() => addSubPuzzle(caseData.id, 'scenario')}
          style={smallBtnStyle}
        >
          + 시나리오
        </button>
      </div>
    </div>
  );
}
