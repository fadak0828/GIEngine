import React, { useEffect, useState } from 'react';
import type { LocalizedText, Word, WordCategory } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { WORD_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS } from './word-category-constants';

interface WordManagerRowProps {
  word: Word;
  connectionChips: { sceneName: string; hotspotName: string }[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
}

export function WordManagerRow({
  word,
  connectionChips,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
}: WordManagerRowProps): React.ReactElement {
  const { updateWord, deleteWord } = useEditorStore();

  const [isHovered, setIsHovered] = useState(false);

  // Draft state — re-initialized whenever expanded becomes true
  const [draftDisplay, setDraftDisplay] = useState<LocalizedText>(word.display);
  const [draftCategory, setDraftCategory] = useState<WordCategory>(word.category ?? 'evidence');
  const [draftHint, setDraftHint] = useState<LocalizedText>(word.hint ?? { ko: '', en: '' });
  const [draftImageUrl, setDraftImageUrl] = useState<string>(word.imageUrl ?? '');

  useEffect(() => {
    if (isExpanded) {
      setDraftDisplay(word.display);
      setDraftCategory(word.category ?? 'evidence');
      setDraftHint(word.hint ?? { ko: '', en: '' });
      setDraftImageUrl(word.imageUrl ?? '');
    }
  }, [isExpanded, word]);

  const handleSave = () => {
    updateWord(word.id, {
      display: draftDisplay,
      category: draftCategory,
      hint: draftHint,
      imageUrl: draftImageUrl,
    });
    onToggleExpand();
  };

  const handleDelete = () => {
    if (window.confirm(`"${word.display.ko}" 단어를 삭제하시겠습니까?${connectionChips.length > 0 ? '\n이 단어는 핫스팟에서 참조 중입니다.' : ''}`)) {
      deleteWord(word.id);
    }
  };

  const categoryColor = CATEGORY_COLORS[word.category ?? ''] ?? 'var(--text-muted)';
  const categoryLabel = CATEGORY_LABELS[word.category ?? ''] ?? word.category ?? '?';

  const cellStyle: React.CSSProperties = {
    padding: '6px 8px',
    verticalAlign: 'middle',
    borderBottom: '1px solid var(--border-color)',
  };

  return (
    <>
      <tr
        style={{ background: isHovered ? 'var(--bg-secondary)' : 'transparent', cursor: 'default' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Checkbox */}
        <td style={{ ...cellStyle, width: 40, textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ cursor: 'pointer' }}
          />
        </td>

        {/* Display name */}
        <td style={{ ...cellStyle, flex: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {word.display.ko || '(이름 없음)'}
          </span>
          {word.display.en && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
              / {word.display.en}
            </span>
          )}
        </td>

        {/* Category */}
        <td style={{ ...cellStyle, width: 80 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: categoryColor,
              display: 'inline-block',
              flexShrink: 0,
            }} />
            {categoryLabel}
          </span>
        </td>

        {/* Hint preview */}
        <td style={{ ...cellStyle, flex: 1 }}>
          <span style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            maxWidth: 120,
          }}>
            {word.hint?.ko || ''}
          </span>
        </td>

        {/* Hotspot chips */}
        <td style={{ ...cellStyle, flex: 1 }}>
          {connectionChips.length === 0 ? (
            <span style={{ color: 'var(--danger)', fontSize: 11 }}>미연결</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {connectionChips.map((chip, i) => (
                <span key={i} style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}>
                  {chip.sceneName}·{chip.hotspotName}
                </span>
              ))}
            </div>
          )}
        </td>

        {/* Actions */}
        <td style={{ ...cellStyle, width: 60, textAlign: 'right' }}>
          <button
            type="button"
            onClick={onToggleExpand}
            title="편집"
            style={{
              padding: '2px 5px',
              fontSize: 11,
              background: 'transparent',
              color: isExpanded ? 'var(--accent)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              cursor: 'pointer',
              marginRight: 3,
            }}
          >
            ✎
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="삭제"
            style={{
              padding: '2px 5px',
              fontSize: 11,
              background: 'transparent',
              color: 'var(--danger)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            🗑
          </button>
        </td>
      </tr>

      {/* Expanded edit row */}
      {isExpanded && (
        <tr style={{ background: 'var(--bg-secondary)' }}>
          <td colSpan={6} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600 }}>
              {/* Row 1: display name */}
              <LocalizedTextInput
                label="표시명"
                value={draftDisplay}
                onChange={setDraftDisplay}
                required
              />

              {/* Row 2: category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  카테고리
                </label>
                <select
                  value={draftCategory}
                  onChange={e => setDraftCategory(e.target.value as WordCategory)}
                  style={{
                    padding: '4px 6px',
                    fontSize: 12,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3,
                    maxWidth: 200,
                  }}
                >
                  {/* Guard: include current category if not in canonical list */}
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

              {/* Row 3: hint */}
              <LocalizedTextInput
                label="힌트"
                value={draftHint}
                onChange={setDraftHint}
              />

              {/* Row 4: image URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  이미지 URL
                </label>
                <input
                  type="text"
                  value={draftImageUrl}
                  onChange={e => setDraftImageUrl(e.target.value)}
                  placeholder="이미지 URL"
                  style={{
                    padding: '4px 6px',
                    fontSize: 12,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3,
                  }}
                />
              </div>

              {/* Row 5: actions */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onToggleExpand}
                  style={{
                    padding: '4px 12px',
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
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
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
          </td>
        </tr>
      )}
    </>
  );
}
