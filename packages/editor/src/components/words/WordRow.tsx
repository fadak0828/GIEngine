import React, { useState } from 'react';
import type { LocalizedText, Word, WordCategory } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { WORD_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from './word-category-constants';

interface WordRowProps {
  word: Word;
  connectionCount: number;
}

export function WordRow({ word, connectionCount }: WordRowProps): React.ReactElement {
  const { updateWord, deleteWord } = useEditorStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draftDisplay, setDraftDisplay] = useState<LocalizedText>(word.display);
  const [draftCategory, setDraftCategory] = useState<WordCategory>(word.category ?? 'evidence');

  const handleEditStart = () => {
    setDraftDisplay(word.display);
    setDraftCategory(word.category ?? 'evidence');
    setIsEditing(true);
  };

  const handleSave = () => {
    updateWord(word.id, { display: draftDisplay, category: draftCategory });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteWord(word.id);
  };

  const categoryColor = CATEGORY_COLORS[word.category ?? ''] ?? 'var(--text-muted)';
  const categoryLabel = CATEGORY_LABELS[word.category ?? ''] ?? word.category ?? '?';

  if (isEditing) {
    return (
      <div
        style={{
          border: '1px solid var(--accent)',
          borderRadius: 4,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: 'var(--bg-secondary)',
        }}
      >
        <LocalizedTextInput
          label="표시명"
          value={draftDisplay}
          onChange={setDraftDisplay}
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
            value={draftCategory}
            onChange={e => setDraftCategory(e.target.value as WordCategory)}
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
            {/* Guard: include current category if it's not in canonical list */}
            {word.category && !WORD_CATEGORIES.includes(word.category as WordCategory) && (
              <option value={word.category}>{word.category}</option>
            )}
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
            onClick={handleCancel}
            style={{
              padding: '3px 8px',
              fontSize: 11,
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
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            저장
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 6px',
        borderRadius: 3,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* Category badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 5px',
          borderRadius: 3,
          background: categoryColor,
          color: '#fff',
          flexShrink: 0,
          letterSpacing: '0.03em',
        }}
      >
        {categoryLabel}
      </span>

      {/* Display names */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            fontWeight: 500,
          }}
        >
          {word.display.ko || '(이름 없음)'}
        </span>
        {word.display.en && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginLeft: 4,
            }}
          >
            / {word.display.en}
          </span>
        )}
      </div>

      {/* Connection count badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: 10,
          background: connectionCount >= 1 ? 'var(--accent)' : 'var(--bg-secondary)',
          color: connectionCount >= 1 ? '#000' : 'var(--text-muted)',
          flexShrink: 0,
          border: '1px solid var(--border-color)',
        }}
        title={`${connectionCount}곳에서 사용됨`}
      >
        ●{connectionCount}곳
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={handleEditStart}
        title="편집"
        style={{
          padding: '2px 5px',
          fontSize: 11,
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 3,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ✎
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={handleDelete}
        title={connectionCount > 0 ? '다른 곳에서 참조 중' : '삭제'}
        style={{
          padding: '2px 5px',
          fontSize: 11,
          background: 'transparent',
          color: connectionCount > 0 ? 'var(--text-muted)' : 'var(--danger)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        🗑
      </button>
    </div>
  );
}
