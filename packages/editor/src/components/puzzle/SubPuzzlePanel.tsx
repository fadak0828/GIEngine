import React, { useState } from 'react';
import type { SubPuzzle } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import {
  CharacterIdFields,
  TimelineFields,
  RelationshipFields,
  ScenarioFields,
  SUB_PUZZLE_TYPE_LABELS,
  SUB_PUZZLE_TYPE_ICONS,
  sectionLabelStyle,
} from './sub-puzzle-fields';

// ── SubPuzzlePanel ────────────────────────────────────────────────

export function SubPuzzlePanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);
  const ui = useEditorStore(s => s.ui);
  const {
    addSubPuzzle,
    updateSubPuzzle,
    deleteSubPuzzle,
    setSelectedSubPuzzle,
  } = useEditorStore();

  const locale = ui.editorLocale;

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Find selected case
  let selectedCase = null;
  if (project && selection.caseId) {
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === selection.caseId);
      if (c) { selectedCase = c; break; }
    }
  }

  const subPuzzles = selectedCase?.puzzles.sub ?? [];
  const selectedPuzzle = selection.subPuzzleId
    ? subPuzzles.find(p => p.id === selection.subPuzzleId) ?? null
    : null;

  // ── Empty state: no case selected ──
  if (!selectedCase) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontSize: 13, color: 'var(--text-muted)',
      }}>
        프로젝트 트리에서 사건을 선택하세요
      </div>
    );
  }

  // ── Handlers ──
  const handleAdd = (type: SubPuzzle['type']) => {
    addSubPuzzle(selectedCase!.id, type);
    const fresh = useEditorStore.getState();
    const freshCase = fresh.project?.acts
      .flatMap(a => a.cases)
      .find(c => c.id === selectedCase!.id);
    const newPuzzle = freshCase?.puzzles.sub.at(-1);
    if (newPuzzle) setSelectedSubPuzzle(newPuzzle.id);
    setAddMenuOpen(false);
  };

  const handleDelete = (puzzleId: string) => {
    deleteSubPuzzle(selectedCase!.id, puzzleId);
    setConfirmDeleteId(null);
  };

  // ── Render type-specific fields ──
  const renderFields = (puzzle: SubPuzzle) => {
    const caseId = selectedCase!.id;
    switch (puzzle.type) {
      case 'character_id':
        return <CharacterIdFields puzzle={puzzle} caseId={caseId} />;
      case 'timeline':
        return <TimelineFields puzzle={puzzle} caseId={caseId} />;
      case 'relationship':
        return <RelationshipFields puzzle={puzzle} caseId={caseId} />;
      case 'scenario':
        return <ScenarioFields puzzle={puzzle} caseId={caseId} />;
      default:
        return (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            알 수 없는 퍼즐 타입입니다
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* LEFT: sub-puzzle list — fixed 240px */}
      <div style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {/* Case context header */}
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            marginBottom: 2,
          }}>
            {selectedCase.title[locale] || selectedCase.id}
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            서브 퍼즐 ({subPuzzles.length})
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {subPuzzles.length === 0 ? (
            <div style={{
              padding: '16px 12px',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              서브 퍼즐이 없습니다
            </div>
          ) : (
            subPuzzles.map(puzzle => {
              const isSelected = selection.subPuzzleId === puzzle.id;
              const isConfirmingDelete = confirmDeleteId === puzzle.id;

              return (
                <div
                  key={puzzle.id}
                  onClick={() => setSelectedSubPuzzle(puzzle.id)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderLeft: isSelected
                      ? '3px solid var(--accent)'
                      : '3px solid transparent',
                    background: isSelected ? 'var(--bg-card)' : 'transparent',
                    fontSize: 12,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>
                    {SUB_PUZZLE_TYPE_ICONS[puzzle.type]}
                  </span>
                  <span style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>
                    {puzzle.title[locale] || SUB_PUZZLE_TYPE_LABELS[puzzle.type]}
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {SUB_PUZZLE_TYPE_LABELS[puzzle.type]}
                  </span>
                  {/* Delete button */}
                  {isConfirmingDelete ? (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(puzzle.id); }}
                        style={{
                          padding: '1px 5px', fontSize: 10, cursor: 'pointer',
                          background: 'transparent', color: '#ef4444',
                          border: '1px solid #ef4444', borderRadius: 2,
                        }}
                      >
                        확인
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        style={{
                          padding: '1px 5px', fontSize: 10, cursor: 'pointer',
                          background: 'transparent', color: 'var(--text-muted)',
                          border: '1px solid var(--border-color)', borderRadius: 2,
                        }}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(puzzle.id); }}
                      style={{
                        padding: '1px 5px', fontSize: 10, cursor: 'pointer',
                        background: 'transparent', color: 'var(--text-muted)',
                        border: '1px solid var(--border-color)', borderRadius: 2,
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add button */}
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
          position: 'relative',
        }}>
          <button
            onClick={() => setAddMenuOpen(v => !v)}
            style={{
              width: '100%',
              padding: '6px 0',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            + 서브 퍼즐 추가
          </button>
          {addMenuOpen && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 12,
              right: 12,
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 10,
              overflow: 'hidden',
            }}>
              {(['character_id', 'timeline', 'relationship', 'scenario'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleAdd(type)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 12,
                    textAlign: 'left',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{SUB_PUZZLE_TYPE_ICONS[type]}</span>
                  <span>{SUB_PUZZLE_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: editing area — flex 1 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {!selectedPuzzle ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', fontSize: 13, color: 'var(--text-muted)',
          }}>
            {subPuzzles.length === 0
              ? '서브 퍼즐을 추가하세요'
              : '편집할 서브 퍼즐을 선택하세요'}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            }}>
              <span style={{ fontSize: 16 }}>
                {SUB_PUZZLE_TYPE_ICONS[selectedPuzzle.type]}
              </span>
              <span style={{
                fontSize: 15, fontWeight: 600, color: 'var(--text-primary)',
              }}>
                {selectedPuzzle.title[locale] || SUB_PUZZLE_TYPE_LABELS[selectedPuzzle.type]}
              </span>
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: 'var(--accent-dim)', color: 'var(--accent)',
              }}>
                {SUB_PUZZLE_TYPE_LABELS[selectedPuzzle.type]}
              </span>
            </div>

            {/* ID */}
            <div style={{
              fontSize: 11, color: 'var(--text-muted)', marginBottom: 12,
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              ID: {selectedPuzzle.id}
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>제목</div>
              <LocalizedTextInput
                label=""
                value={selectedPuzzle.title}
                onChange={title =>
                  updateSubPuzzle(selectedCase!.id, selectedPuzzle.id, { title })
                }
              />
            </div>

            {/* Type-specific fields */}
            <div style={{ marginTop: 8 }}>
              {renderFields(selectedPuzzle)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
