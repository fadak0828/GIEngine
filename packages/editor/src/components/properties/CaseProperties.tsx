import React, { useState } from 'react';
import type { Case, SubPuzzle } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { SubPuzzleEditor } from './SubPuzzleEditor';
import { SubPuzzleModal } from './SubPuzzleModal';

interface CasePropertiesProps {
  caseData: Case;
}

export function CaseProperties({ caseData }: CasePropertiesProps): React.ReactElement {
  const ui = useEditorStore(s => s.ui);
  const { updateCase, setActivePanel, addSubPuzzle } = useEditorStore();

  const locale = ui.editorLocale;

  const [editingPuzzle, setEditingPuzzle] = useState<SubPuzzle | null>(null);

  const handleEdit = (puzzle: SubPuzzle) => {
    setEditingPuzzle(puzzle);
  };

  const handleAddAndEdit = (type: SubPuzzle['type']) => {
    addSubPuzzle(caseData.id, type);
    // Get the freshly added puzzle from store
    const fresh = useEditorStore.getState();
    const freshCase = fresh.project?.acts
      .flatMap(a => a.cases)
      .find(c => c.id === caseData.id);
    const newPuzzle = freshCase?.puzzles.sub.at(-1);
    if (newPuzzle) setEditingPuzzle(newPuzzle);
  };

  // Get live caseData from store for the modal (keeps data current)
  const liveCaseData = useEditorStore(s =>
    s.project?.acts.flatMap(a => a.cases).find(c => c.id === caseData.id)
  ) ?? caseData;

  return (
    <div style={{ padding: 12 }}>
      {/* Section header */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        📁 {caseData.title[locale] || caseData.id}
      </div>

      {/* Read-only ID */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 12,
        }}
      >
        ID: {caseData.id}
      </div>

      {/* Title */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}
        >
          제목
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              htmlFor={`case-title-ko-${caseData.id}`}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                width: 20,
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              KO
            </label>
            <input
              id={`case-title-ko-${caseData.id}`}
              value={caseData.title.ko}
              onChange={e =>
                updateCase(caseData.id, {
                  title: { ...caseData.title, ko: e.target.value },
                })
              }
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label
              htmlFor={`case-title-en-${caseData.id}`}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                width: 20,
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              EN
            </label>
            <input
              id={`case-title-en-${caseData.id}`}
              value={caseData.title.en}
              onChange={e =>
                updateCase(caseData.id, {
                  title: { ...caseData.title, en: e.target.value },
                })
              }
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 6,
          }}
        >
          설명
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <label
              htmlFor={`case-desc-ko-${caseData.id}`}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                width: 20,
                flexShrink: 0,
                paddingTop: 4,
                cursor: 'pointer',
              }}
            >
              KO
            </label>
            <textarea
              id={`case-desc-ko-${caseData.id}`}
              value={caseData.description.ko}
              onChange={e =>
                updateCase(caseData.id, {
                  description: { ...caseData.description, ko: e.target.value },
                })
              }
              rows={3}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <label
              htmlFor={`case-desc-en-${caseData.id}`}
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                width: 20,
                flexShrink: 0,
                paddingTop: 4,
                cursor: 'pointer',
              }}
            >
              EN
            </label>
            <textarea
              id={`case-desc-en-${caseData.id}`}
              value={caseData.description.en}
              onChange={e =>
                updateCase(caseData.id, {
                  description: { ...caseData.description, en: e.target.value },
                })
              }
              rows={3}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      <button
        type="button"
        onClick={() => setActivePanel('words')}
        style={{
          width: '100%',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          background: 'transparent',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: 3,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        → 단어 관리 열기
      </button>

      <button
        type="button"
        onClick={() => setActivePanel('puzzle')}
        style={{
          width: '100%',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          background: 'var(--accent)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        퍼즐 편집 열기
      </button>

      {/* Inline SubPuzzleEditor list */}
      <SubPuzzleEditor
        caseData={liveCaseData}
        onEdit={handleEdit}
        onAddAndEdit={handleAddAndEdit}
      />

      {/* SubPuzzleModal */}
      {editingPuzzle && (
        <SubPuzzleModal
          caseData={liveCaseData}
          puzzle={editingPuzzle}
          onClose={() => setEditingPuzzle(null)}
        />
      )}
    </div>
  );
}
