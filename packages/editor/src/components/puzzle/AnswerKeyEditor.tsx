import React, { useEffect, useRef, useState } from 'react';
import type { PuzzleTemplate, AnswerDefinition, Word } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';

// ── SlotWordPicker ────────────────────────────────────────────────

interface SlotWordPickerProps {
  slotId: string;
  currentWordId: string;
  caseWords: Word[];
  locale: 'ko' | 'en';
  onSelect: (slotId: string, wordId: string) => void;
}

function SlotWordPicker({ slotId, currentWordId, caseWords, locale, onSelect }: SlotWordPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click close
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

  const filtered = caseWords.filter(w =>
    w.display.ko.includes(search) || (w.display.en?.includes(search) ?? false)
  );

  const selected = caseWords.find(w => w.id === currentWordId);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      {/* Chip trigger */}
      <div
        onClick={() => setIsOpen(prev => !prev)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(prev => !prev); } }}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 3,
          background: selected ? 'var(--accent)' : 'var(--bg-card)',
          color: selected ? '#000' : 'var(--text-muted)',
          border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-color)'}`,
          fontSize: 12,
          fontWeight: selected ? 600 : 400,
          cursor: 'pointer',
          userSelect: 'none',
          minWidth: 100,
          outline: 'none',
        }}
      >
        {selected ? (selected.display[locale] || selected.display.ko) : '단어 선택...'}
        <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 10 }}>▼</span>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          zIndex: 100,
          marginTop: 2,
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          background: 'var(--bg-card)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          minWidth: 220,
          maxHeight: 260,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="검색..."
              autoFocus
              style={{
                width: '100%',
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Clear option */}
          <div
            onClick={() => { onSelect(slotId, ''); setIsOpen(false); setSearch(''); }}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-color)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            (정답 없음)
          </div>

          {/* Word list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {caseWords.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                이 사건에 단어가 없습니다
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                검색 결과가 없습니다
              </div>
            ) : (
              filtered.map(word => {
                const isSelected = word.id === currentWordId;
                return (
                  <div
                    key={word.id}
                    onClick={() => { onSelect(slotId, word.id); setIsOpen(false); setSearch(''); }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderBottom: '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(245,158,11,0.1)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(245,158,11,0.1)' : 'transparent';
                    }}
                  >
                    {isSelected && <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                    <span style={{ fontWeight: 500 }}>{word.display.ko}</span>
                    {word.display.en && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>/ {word.display.en}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AnswerKeyEditor ───────────────────────────────────────────────

interface AnswerKeyEditorProps {
  template: PuzzleTemplate;
  answers: Record<string, AnswerDefinition>;
  caseId: string;
  caseWords: Word[];
}

export function AnswerKeyEditor({ template, answers, caseId, caseWords }: AnswerKeyEditorProps): React.ReactElement {
  const { updatePuzzleAnswers } = useEditorStore();
  const ui = useEditorStore(s => s.ui);
  const locale = ui.editorLocale;

  const slots = template.segments.filter(s => s.type === 'slot') as Array<{
    type: 'slot';
    slotId: string;
    placeholder?: { ko: string; en: string };
    acceptCategory?: string;
  }>;

  if (slots.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
        슬롯이 없습니다. 템플릿에 슬롯을 추가하세요.
      </div>
    );
  }

  const handleSelect = (slotId: string, wordId: string) => {
    const newAnswers: Record<string, AnswerDefinition> = { ...answers };
    if (wordId === '') {
      delete newAnswers[slotId];
    } else {
      newAnswers[slotId] = { correctWordId: wordId };
    }
    updatePuzzleAnswers(caseId, newAnswers);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {slots.map(slot => {
        const currentWordId = answers[slot.slotId]?.correctWordId ?? '';
        return (
          <div key={slot.slotId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11,
              color: 'var(--accent)',
              background: 'rgba(245,158,11,0.15)',
              padding: '2px 8px',
              borderRadius: 3,
              flexShrink: 0,
              minWidth: 70,
              textAlign: 'center',
            }}>
              {slot.slotId}
            </span>
            <SlotWordPicker
              slotId={slot.slotId}
              currentWordId={currentWordId}
              caseWords={caseWords}
              locale={locale}
              onSelect={handleSelect}
            />
          </div>
        );
      })}
    </div>
  );
}
