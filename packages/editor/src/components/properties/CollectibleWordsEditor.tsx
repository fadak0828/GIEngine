import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWords } from '@/store/editor-store';
import type { CollectibleWord, LocalizedText } from '@gi-engine/core';

interface CollectibleWordsEditorProps {
  caseId: string;
  collectibleWords: CollectibleWord[];
  onChange: (words: CollectibleWord[]) => void;
}

/**
 * Editor for CollectibleWord[] — each entry maps a wordId to a textMatch
 * that the player must click in the examine popup to collect the word.
 */
export function CollectibleWordsEditor({
  caseId,
  collectibleWords,
  onChange,
}: CollectibleWordsEditorProps): React.ReactElement {
  const words = useWords();
  const caseWords = useMemo(
    () => words.filter(w => w.caseId === caseId),
    [words, caseId],
  );

  const [addingOpen, setAddingOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!addingOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAddingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addingOpen]);

  const usedWordIds = new Set(collectibleWords.map(cw => cw.wordId));
  const availableWords = caseWords.filter(w => !usedWordIds.has(w.id));

  const addWord = (wordId: string) => {
    const wordDef = caseWords.find(w => w.id === wordId);
    const defaultMatch: LocalizedText = wordDef
      ? { ko: wordDef.display.ko, en: wordDef.display.en }
      : { ko: '', en: '' };
    onChange([...collectibleWords, { wordId, textMatch: defaultMatch }]);
    setAddingOpen(false);
  };

  const removeWord = (wordId: string) => {
    onChange(collectibleWords.filter(cw => cw.wordId !== wordId));
  };

  const updateTextMatch = (wordId: string, locale: 'ko' | 'en', value: string) => {
    onChange(
      collectibleWords.map(cw =>
        cw.wordId === wordId
          ? { ...cw, textMatch: { ...cw.textMatch, [locale]: value } }
          : cw,
      ),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>수집 가능한 단어</label>

      {collectibleWords.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--partial)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ 수집 단어가 없습니다
        </div>
      )}

      {/* Entries */}
      {collectibleWords.map(cw => {
        const wordDef = caseWords.find(w => w.id === cw.wordId);
        return (
          <div
            key={cw.wordId}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: 8,
              background: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                {wordDef ? wordDef.display.ko : cw.wordId}
              </span>
              <button
                type="button"
                onClick={() => removeWord(cw.wordId)}
                style={removeBtnStyle}
                title="제거"
              >
                ×
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>KO</span>
              <input
                type="text"
                value={cw.textMatch.ko}
                onChange={e => updateTextMatch(cw.wordId, 'ko', e.target.value)}
                placeholder="클릭할 텍스트 (한국어)"
                style={{ width: '100%', fontSize: 11 }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>EN</span>
              <input
                type="text"
                value={cw.textMatch.en}
                onChange={e => updateTextMatch(cw.wordId, 'en', e.target.value)}
                placeholder="Clickable text (English)"
                style={{ width: '100%', fontSize: 11 }}
              />
            </div>
          </div>
        );
      })}

      {/* Add button + dropdown */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setAddingOpen(prev => !prev)}
          style={{
            width: '100%',
            padding: '6px 0',
            fontSize: 11,
            background: 'var(--bg-secondary)',
            border: '1px dashed var(--border-color)',
            borderRadius: 4,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          + 수집 단어 추가
        </button>

        {addingOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              marginTop: 2,
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              background: 'var(--bg-card)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              maxHeight: 200,
              overflowY: 'auto',
            }}
          >
            {availableWords.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                추가할 단어가 없습니다
              </div>
            ) : (
              availableWords.map(word => (
                <div
                  key={word.id}
                  onClick={() => addWord(word.id)}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{word.display.ko}</span>
                  {word.display.en && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>/ {word.display.en}</span>
                  )}
                  {word.category && (
                    <span style={categoryBadge}>{word.category}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: 14,
  fontWeight: 700,
  padding: '0 4px',
  lineHeight: 1,
};

const categoryBadge: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 10,
  color: 'var(--text-muted)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  padding: '0 4px',
};
