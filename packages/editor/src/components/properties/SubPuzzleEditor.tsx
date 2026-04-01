import React, { useState } from 'react';
import type { Case, SubPuzzle } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { SUB_PUZZLE_TYPE_LABELS } from '@/components/puzzle/sub-puzzle-fields/constants';

// ── Styles ───────────────────────────────────────────────────────

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
  color: 'var(--danger)',
  borderColor: 'var(--danger)',
};

// ── SubPuzzleCard (compact) ───────────────────────────────────────

function SubPuzzleCard({
  puzzle,
  caseId,
  onEdit,
}: {
  puzzle: SubPuzzle;
  caseId: string;
  onEdit: (puzzle: SubPuzzle) => void;
}): React.ReactElement {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { deleteSubPuzzle } = useEditorStore();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        background: 'var(--bg-card)',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        gap: 8,
      }}
    >
      {/* Title + type badge */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
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
            flexShrink: 0,
          }}
        >
          {SUB_PUZZLE_TYPE_LABELS[puzzle.type]}
        </span>
      </div>

      {/* Edit button */}
      <button
        type="button"
        aria-label={`${puzzle.title.ko || puzzle.id} 편집`}
        onClick={() => onEdit(puzzle)}
        style={{
          ...smallBtnStyle,
          color: 'var(--accent)',
          borderColor: 'var(--accent)',
          flexShrink: 0,
        }}
      >
        편집
      </button>

      {/* Delete */}
      {confirmDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
          style={{ ...smallBtnStyle, flexShrink: 0 }}
        >
          취소
        </button>
      )}
      <button
        type="button"
        aria-label={`${puzzle.title.ko || puzzle.id} 삭제`}
        onClick={handleDelete}
        style={{ ...dangerBtnStyle, flexShrink: 0 }}
      >
        {confirmDelete ? '확인' : '✕'}
      </button>
    </div>
  );
}

// ── SubPuzzleEditor ───────────────────────────────────────────────

interface SubPuzzleEditorProps {
  caseData: Case;
  onEdit: (puzzle: SubPuzzle) => void;
  onAddAndEdit: (type: SubPuzzle['type']) => void;
}

export function SubPuzzleEditor({
  caseData,
  onEdit,
  onAddAndEdit,
}: SubPuzzleEditorProps): React.ReactElement {
  const subPuzzles = caseData.puzzles.sub;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: 12,
        marginTop: 12,
      }}
    >
      <div style={sectionLabelStyle}>서브 퍼즐 ({subPuzzles.length})</div>

      {/* Puzzle list */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}
      >
        {subPuzzles.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '8px 0',
            }}
          >
            아직 서브 퍼즐이 없습니다.
          </div>
        )}
        {subPuzzles.map(sp => (
          <SubPuzzleCard
            key={sp.id}
            puzzle={sp}
            caseId={caseData.id}
            onEdit={onEdit}
          />
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(['character_id', 'timeline', 'relationship', 'scenario'] as const).map(
          type => (
            <button
              key={type}
              type="button"
              onClick={() => onAddAndEdit(type)}
              style={smallBtnStyle}
            >
              + {SUB_PUZZLE_TYPE_LABELS[type]}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
