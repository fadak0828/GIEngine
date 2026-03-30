import React, { useState } from 'react';
import type { LocalizedText, WordCategory } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { WORD_CATEGORIES, CATEGORY_LABELS } from './word-category-constants';

interface WordAddFormProps {
  caseId: string;
  onSaved: (wordId: string) => void;
  onCancel: () => void;
}

export function WordAddForm({ caseId, onSaved, onCancel }: WordAddFormProps): React.ReactElement {
  const { addWord } = useEditorStore();
  const [display, setDisplay] = useState<LocalizedText>({ ko: '', en: '' });
  const [category, setCategory] = useState<WordCategory>('evidence');

  const canSave = display.ko.trim() !== '';

  const handleSave = () => {
    if (!canSave) return;
    const id = 'word_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    addWord({ id, caseId, display, category });
    onSaved(id);
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        새 단어 추가
      </div>

      <LocalizedTextInput
        label="표시명"
        value={display}
        onChange={setDisplay}
        required
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          카테고리
        </label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as WordCategory)}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: 12,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
          }}
        >
          {WORD_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat] ?? cat}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            background: canSave ? 'var(--accent)' : 'var(--bg-card)',
            color: canSave ? '#000' : 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.6,
          }}
        >
          저장
        </button>
      </div>
    </div>
  );
}
