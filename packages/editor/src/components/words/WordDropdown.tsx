import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWords } from '@/store/editor-store';

interface WordDropdownProps {
  caseId: string;
  wordIds: string[];
  onChange: (wordIds: string[]) => void;
}

export function WordDropdown({ caseId, wordIds, onChange }: WordDropdownProps): React.ReactElement {
  const words = useWords();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const caseWords = useMemo(
    () => words.filter(w => w.caseId === caseId),
    [words, caseId]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const removeWord = (id: string) => {
    onChange(wordIds.filter(wid => wid !== id));
  };

  const addWord = (id: string) => {
    if (!wordIds.includes(id)) {
      onChange([...wordIds, id]);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <label
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        획득 단어
      </label>

      {/* Warning when nothing selected */}
      {wordIds.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ⚠ 단어가 선택되지 않았습니다
        </div>
      )}

      {/* Chip area */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: 6,
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          background: 'var(--bg-card)',
          minHeight: 34,
          cursor: 'pointer',
        }}
        onClick={() => setIsOpen(prev => !prev)}
      >
        {wordIds.length === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>
            단어 선택...
          </span>
        )}
        {wordIds.map(id => {
          const word = caseWords.find(w => w.id === id);
          return (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 3,
                background: word ? 'var(--accent)' : 'var(--bg-secondary)',
                color: word ? '#000' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid var(--border-color)',
              }}
            >
              {word ? word.display.ko : `(알 수 없음 — ${id})`}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  removeWord(id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: word ? '#000' : 'var(--text-muted)',
                  padding: 0,
                  lineHeight: 1,
                  fontSize: 12,
                  fontWeight: 700,
                }}
                title="제거"
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 50,
            marginTop: 2,
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            background: 'var(--bg-card)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            minWidth: 200,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {caseWords.length === 0 ? (
            <div
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              이 사건에는 단어가 없습니다
            </div>
          ) : (
            caseWords.map(word => {
              const selected = wordIds.includes(word.id);
              return (
                <div
                  key={word.id}
                  onClick={() => {
                    if (!selected) addWord(word.id);
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: selected ? 'default' : 'pointer',
                    opacity: selected ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    borderBottom: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => {
                    if (!selected) {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
                    }
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  {selected && (
                    <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  )}
                  <span style={{ fontWeight: 500 }}>{word.display.ko}</span>
                  {word.display.en && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      / {word.display.en}
                    </span>
                  )}
                  {word.category && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 3,
                        padding: '0 4px',
                      }}
                    >
                      {word.category}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
