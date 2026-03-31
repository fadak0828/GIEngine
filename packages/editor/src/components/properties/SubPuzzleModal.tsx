import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Case, SubPuzzle } from '@gi-engine/core';
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
} from '@/components/puzzle/sub-puzzle-fields';

// ── SubPuzzleModal ────────────────────────────────────────────────

interface SubPuzzleModalProps {
  caseData: Case;
  puzzle: SubPuzzle;
  onClose: () => void;
}

export function SubPuzzleModal({ caseData, puzzle, onClose }: SubPuzzleModalProps): React.ReactElement {
  const ui = useEditorStore(s => s.ui);
  const { updateSubPuzzle } = useEditorStore();

  const locale = ui.editorLocale;

  // Find current puzzle in store (for live updates)
  const livePuzzle =
    caseData.puzzles.sub.find(p => p.id === puzzle.id) ?? puzzle;

  const renderFields = () => {
    const caseId = caseData.id;
    switch (livePuzzle.type) {
      case 'character_id':
        return <CharacterIdFields puzzle={livePuzzle as Parameters<typeof CharacterIdFields>[0]['puzzle']} caseId={caseId} />;
      case 'timeline':
        return <TimelineFields puzzle={livePuzzle as Parameters<typeof TimelineFields>[0]['puzzle']} caseId={caseId} />;
      case 'relationship':
        return <RelationshipFields puzzle={livePuzzle as Parameters<typeof RelationshipFields>[0]['puzzle']} caseId={caseId} />;
      case 'scenario':
        return <ScenarioFields puzzle={livePuzzle as Parameters<typeof ScenarioFields>[0]['puzzle']} caseId={caseId} />;
      default:
        return (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            알 수 없는 퍼즐 타입입니다
          </div>
        );
    }
  };

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 200,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            minWidth: 640,
            maxWidth: 900,
            width: '80vw',
            maxHeight: '80vh',
            overflowY: 'auto',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 201,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Modal header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16 }}>
              {SUB_PUZZLE_TYPE_ICONS[livePuzzle.type]}
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {livePuzzle.title[locale] || SUB_PUZZLE_TYPE_LABELS[livePuzzle.type]}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono, monospace)',
                  marginTop: 2,
                }}
              >
                {livePuzzle.id}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 3,
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {SUB_PUZZLE_TYPE_LABELS[livePuzzle.type]}
            </span>
            <Dialog.Close asChild>
              <button
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ✕ 닫기
              </button>
            </Dialog.Close>
          </div>

          {/* Modal body */}
          <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelStyle}>제목</div>
              <LocalizedTextInput
                label=""
                value={livePuzzle.title}
                onChange={title =>
                  updateSubPuzzle(caseData.id, livePuzzle.id, { title })
                }
              />
            </div>

            {/* Type-specific fields */}
            <div>{renderFields()}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
