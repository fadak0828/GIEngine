import React, { useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useEditorStore } from '@/store/editor-store';
import { useClickOutside } from '@/hooks/useClickOutside';
import '@/styles/primitives.css';
import s from './WordDropdown.module.css';

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
      <div ref={containerRef} className={s.root}>
        {props.label && (
          <label className="field-label">{props.label}</label>
        )}

        {/* Chip area (click to open) */}
        <div
          onClick={() => setIsOpen(prev => !prev)}
          className="dropdown-trigger"
        >
          {props.wordId === '' ? (
            <span className="dropdown-placeholder">단어 선택...</span>
          ) : (
            <span className={`chip${isDangling ? ' chip-danger' : ''}`}>
              {selectedWord ? selectedWord.display.ko : `(알 수 없음 — ${props.wordId})`}
              <button
                type="button"
                onClick={handleClearSingle}
                className="chip-clear"
                title="제거"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="dropdown-panel">
            {/* Search input */}
            <div className="dropdown-search-row">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="검색..."
                autoFocus
                className="dropdown-search"
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
                  className={s.addWordBtn}
                >
                  → 단어 관리 열기
                </button>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="dropdown-empty">검색 결과 없음</div>
            ) : (
              filteredWords.map(word => {
                const isSelected = props.wordId === word.id;
                return (
                  <div
                    key={word.id}
                    onClick={() => handleSelectSingle(word.id)}
                    className={`dropdown-option${isSelected ? ' dropdown-option-selected' : ''}`}
                  >
                    {isSelected && (
                      <span className={s.optionCheck}>✓</span>
                    )}
                    <span className={s.optionText}>{word.display.ko}</span>
                    {word.display.en && (
                      <span className={s.optionSub}>/ {word.display.en}</span>
                    )}
                    {word.category && (
                      <span className={s.optionBadge}>{word.category}</span>
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
    <div ref={containerRef} className={s.root}>
      <label className="field-label">{label ?? '획득 단어'}</label>

      {/* Warning when nothing selected */}
      {wordIds.length === 0 && (
        <div className={s.warning}>
          ⚠ 단어가 선택되지 않았습니다
        </div>
      )}

      {/* Chip area */}
      <div
        className={s.multiTrigger}
        onClick={() => setIsOpen(prev => !prev)}
      >
        {wordIds.length === 0 && (
          <span className="dropdown-placeholder">단어 선택...</span>
        )}
        {wordIds.map(id => {
          const word = caseWords.find(w => w.id === id);
          return (
            <span
              key={id}
              className={`chip chip-multi${!word ? ' chip-multi-danger' : ''}`}
            >
              {word ? word.display.ko : `(알 수 없음 — ${id})`}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  removeWord(id);
                }}
                className="chip-clear"
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
        <div className="dropdown-panel" style={{ minWidth: 200 }}>
          {caseWords.length === 0 ? (
            <div className="dropdown-empty">이 사건에는 단어가 없습니다</div>
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
                    <span className={s.optionCheck}>✓</span>
                  )}
                  <span className={s.optionText}>{word.display.ko}</span>
                  {word.display.en && (
                    <span className={s.optionSub}>/ {word.display.en}</span>
                  )}
                  {word.category && (
                    <span className={s.optionBadge}>{word.category}</span>
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
