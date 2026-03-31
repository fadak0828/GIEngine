import React, { useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useEditorStore } from '@/store/editor-store';
import { useClickOutside } from '@/hooks/useClickOutside';

// ── Union-type Props ───────────────────────────────────────────────

type WordDropdownProps =
  | {
      caseId: string;
      singleSelect: true;
      wordId: string;
      onChangeSingle: (id: string) => void;
      label?: string;
    }
  | {
      caseId: string;
      singleSelect?: false;
      wordIds: string[];
      onChange: (wordIds: string[]) => void;
      label?: string;
    };

// ── WordDropdown ───────────────────────────────────────────────────

export function WordDropdown(props: WordDropdownProps): React.ReactElement {
  // Memoized selector: only re-renders when caseId's words change
  const caseWords = useEditorStore(
    useShallow(s => s.words.filter(w => w.caseId === props.caseId)),
  );
  const { setActivePanel } = useEditorStore();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const filteredWords = search
    ? caseWords.filter(
        w =>
          w.display.ko.toLowerCase().includes(search.toLowerCase()) ||
          (w.display.en ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : caseWords;

  // ── singleSelect handlers ──
  const handleSelectSingle = (id: string) => {
    if (props.singleSelect) {
      props.onChangeSingle(id);
      setIsOpen(false);
      setSearch('');
    }
  };

  const handleClearSingle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.singleSelect) props.onChangeSingle('');
  };

  // ── multi-select handlers ──
  const removeWord = (id: string) => {
    if (!props.singleSelect) {
      props.onChange(props.wordIds.filter(wid => wid !== id));
    }
  };

  const addWord = (id: string) => {
    if (!props.singleSelect) {
      if (!props.wordIds.includes(id)) {
        props.onChange([...props.wordIds, id]);
      }
      setIsOpen(false);
    }
  };

  // ── Dangling ref check (singleSelect) ──
  const isDangling =
    props.singleSelect &&
    props.wordId !== '' &&
    !caseWords.some(w => w.id === props.wordId);

  // ── Render ──

  if (props.singleSelect) {
    const selectedWord = caseWords.find(w => w.id === props.wordId);

    return (
      <div
        ref={containerRef}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}
      >
        {props.label && (
          <label
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {props.label}
          </label>
        )}

        {/* Chip area (click to open) */}
        <div
          onClick={() => setIsOpen(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 6,
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            background: 'var(--bg-card)',
            minHeight: 34,
            cursor: 'pointer',
          }}
        >
          {props.wordId === '' ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>
              단어 선택...
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 11,
                fontWeight: 600,
                border: `1px solid ${isDangling ? 'var(--danger)' : 'var(--accent)'}`,
                color: isDangling ? 'var(--danger)' : 'var(--text-primary)',
                background: 'transparent',
              }}
            >
              {selectedWord ? selectedWord.display.ko : `(알 수 없음 — ${props.wordId})`}
              <button
                type="button"
                onClick={handleClearSingle}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: isDangling ? 'var(--danger)' : 'var(--text-muted)',
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
          )}
        </div>

        {/* Dropdown panel */}
        {isOpen && (
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
              maxHeight: 220,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Search input */}
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)' }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="검색..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '3px 6px',
                  fontSize: 11,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {caseWords.length === 0 ? (
              <div
                style={{
                  padding: '10px 12px',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span>이 사건에 단어가 없습니다</span>
                <button
                  onClick={() => { setIsOpen(false); setActivePanel('words'); }}
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    background: 'transparent',
                    color: 'var(--accent)',
                    border: '1px solid var(--accent)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  → 단어 관리 열기
                </button>
              </div>
            ) : filteredWords.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                검색 결과 없음
              </div>
            ) : (
              filteredWords.map(word => {
                const isSelected = props.wordId === word.id;
                return (
                  <div
                    key={word.id}
                    onClick={() => handleSelectSingle(word.id)}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderBottom: '1px solid var(--border-color)',
                      background: isSelected ? 'var(--accent-dim)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected)
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                  >
                    {isSelected && (
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

  // ── Multi-select mode ──
  const { wordIds, onChange, label } = props;

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}
    >
      <label
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label ?? '획득 단어'}
      </label>

      {/* Warning when nothing selected */}
      {wordIds.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--accent)',
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
