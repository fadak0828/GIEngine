import React, { useState } from 'react';
import type { Hint } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { genId } from '@/store/utils';

interface HintsEditorProps {
  hints: Hint[];
  caseId: string;
  puzzleId: string;
}

const LEVEL_LABELS: Record<number, { ko: string; en: string }> = {
  1: { ko: '약한 힌트', en: 'Subtle Hint' },
  2: { ko: '중간 힌트', en: 'Medium Hint' },
  3: { ko: '직접적 힌트', en: 'Direct Hint' },
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#f59e0b',
  3: '#ef4444',
};

interface HintRowProps {
  hint: Hint;
  locale: 'ko' | 'en';
  onUpdate: (patch: Partial<Hint>) => void;
  onDelete: () => void;
}

function HintRow({ hint, locale, onUpdate, onDelete }: HintRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-card)',
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          background: expanded ? 'var(--bg-secondary)' : 'transparent',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 3,
          background: LEVEL_COLORS[hint.level],
          color: '#fff',
          flexShrink: 0,
        }}>
          L{hint.level}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
          {hint.text[locale] || hint.text.ko || '(empty)'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 50 }}>레벨</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map(level => (
                <button
                  key={level}
                  onClick={() => onUpdate({ level })}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: hint.level === level ? LEVEL_COLORS[level] : 'var(--border-color)',
                    borderRadius: 3,
                    background: hint.level === level ? LEVEL_COLORS[level] : 'transparent',
                    color: hint.level === level ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {level} - {LEVEL_LABELS[level][locale]}
                </button>
              ))}
            </div>
          </div>

          <LocalizedTextInput
            label="힌트 텍스트"
            value={hint.text}
            onChange={text => onUpdate({ text })}
            multiline
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 50 }}>조건</span>
            <input
              type="text"
              value={hint.condition ?? ''}
              onChange={e => onUpdate({ condition: e.target.value || undefined })}
              placeholder="조건 표현식 (선택사항)"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={onDelete}
            style={{
              alignSelf: 'flex-end',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              background: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

export function HintsEditor({ hints, caseId, puzzleId }: HintsEditorProps): React.ReactElement {
  const { updatePuzzleHints } = useEditorStore();
  const ui = useEditorStore(s => s.ui);
  const locale = ui.editorLocale;

  const handleUpdate = (index: number, patch: Partial<Hint>) => {
    const newHints = hints.map((h, i) => i === index ? { ...h, ...patch } : h);
    updatePuzzleHints(caseId, newHints);
  };

  const handleDelete = (index: number) => {
    const newHints = hints.filter((_, i) => i !== index);
    updatePuzzleHints(caseId, newHints);
  };

  const handleAdd = () => {
    const newHint: Hint = {
      id: genId('hint'),
      puzzleId,
      level: 1,
      text: { ko: '', en: '' },
    };
    updatePuzzleHints(caseId, [...hints, newHint]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {hints.length}개 힌트
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          + 힌트 추가
        </button>
      </div>

      {hints.length === 0 ? (
        <div style={{
          padding: 16,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-color)',
          borderRadius: 6,
        }}>
          힌트가 없습니다. "힌트 추가" 버튼으로 힌트를 추가하세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hints.map((hint, index) => (
            <HintRow
              key={hint.id}
              hint={hint}
              locale={locale}
              onUpdate={patch => handleUpdate(index, patch)}
              onDelete={() => handleDelete(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
