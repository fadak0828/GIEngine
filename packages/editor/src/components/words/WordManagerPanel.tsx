import React, { useMemo, useState } from 'react';
import type { WordCategory } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { WordAddForm } from './WordAddForm';
import { WordManagerRow } from './WordManagerRow';
import { WORD_CATEGORIES, CATEGORY_LABELS } from './word-category-constants';

export function WordManagerPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const words = useEditorStore(s => s.words);
  const caseId = useEditorStore(s => s.selection.caseId);
  const locale = useEditorStore(s => s.ui.editorLocale);
  const { deleteWord } = useEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<WordCategory | 'all'>('all');
  const [isAddingWord, setIsAddingWord] = useState(false);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  // Find selected case
  const selectedCase = useMemo(() => {
    if (!project || !caseId) return null;
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === caseId);
      if (c) return c;
    }
    return null;
  }, [project, caseId]);

  const caseWords = useMemo(
    () => words.filter(w => w.caseId === caseId),
    [words, caseId]
  );

  // connectionMap: wordId -> { count, chips }
  const connectionMap = useMemo<Record<string, { count: number; chips: { sceneName: string; hotspotName: string }[] }>>(() => {
    const map: Record<string, { count: number; chips: { sceneName: string; hotspotName: string }[] }> = {};
    for (const word of caseWords) {
      map[word.id] = { count: 0, chips: [] };
    }
    if (!selectedCase) return map;

    for (const scene of selectedCase.scenes) {
      const sceneName = scene.name[locale] || scene.name.ko || scene.id;
      for (const hotspot of scene.hotspots) {
        const hotspotName = hotspot.name || hotspot.id;
        const action = hotspot.action;

        const processWordIds = (wordIds: string[]) => {
          for (const wid of wordIds) {
            if (wid in map) {
              map[wid].count += 1;
              map[wid].chips.push({ sceneName, hotspotName });
            }
          }
        };

        if (action.type === 'word_reveal') {
          processWordIds(action.wordIds);
        } else if (action.type === 'composite') {
          for (const subAction of action.actions) {
            if (subAction.type === 'word_reveal') {
              processWordIds(subAction.wordIds);
            }
          }
        }
      }
    }
    return map;
  }, [caseWords, selectedCase, locale]);

  // Category counts
  const categoryCounts = useMemo<Record<WordCategory | 'all', number>>(() => {
    const counts: Record<string, number> = { all: caseWords.length };
    for (const cat of WORD_CATEGORIES) {
      counts[cat] = caseWords.filter(w => w.category === cat).length;
    }
    return counts as Record<WordCategory | 'all', number>;
  }, [caseWords]);

  // Filtered words
  const filteredWords = useMemo(() => {
    return caseWords.filter(w => {
      const matchesCategory = activeCategory === 'all' || w.category === activeCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch = q === ''
        || w.display.ko.toLowerCase().includes(q)
        || (w.display.en?.toLowerCase().includes(q) ?? false);
      return matchesCategory && matchesSearch;
    });
  }, [caseWords, activeCategory, searchQuery]);

  const handleToggleSelect = (wordId: string) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId); else next.add(wordId);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedWordIds.size === filteredWords.length && filteredWords.length > 0) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(filteredWords.map(w => w.id)));
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`선택한 ${selectedWordIds.size}개 단어를 삭제하시겠습니까?\n일부 단어는 핫스팟에서 참조 중일 수 있습니다.`)) {
      [...selectedWordIds].forEach(id => deleteWord(id));
      setSelectedWordIds(new Set());
    }
  };

  const caseName = selectedCase
    ? (selectedCase.title[locale] || selectedCase.title.ko || selectedCase.id)
    : '';

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textAlign: 'left',
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          단어 관리{caseName ? ` — ${caseName}` : ''}
        </span>
        {selectedCase && (
          <button
            type="button"
            onClick={() => setIsAddingWord(v => !v)}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: isAddingWord ? 'var(--bg-card)' : 'var(--accent)',
              color: isAddingWord ? 'var(--text-secondary)' : '#000',
              border: isAddingWord ? '1px solid var(--border-color)' : 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {isAddingWord ? '취소' : '＋ 단어 추가'}
          </button>
        )}
      </div>

      {/* Filter row */}
      {selectedCase && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '3px 8px', minWidth: 180 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="단어 검색..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: 'var(--text-primary)',
                width: 140,
              }}
            />
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', flexWrap: 'nowrap' }}>
            {(['all', ...WORD_CATEGORIES] as Array<WordCategory | 'all'>).map(cat => {
              const isActive = activeCategory === cat;
              const label = cat === 'all' ? '전체' : (CATEGORY_LABELS[cat] ?? cat);
              const count = categoryCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 12,
                    border: isActive ? 'none' : '1px solid var(--border-color)',
                    background: isActive ? 'var(--accent)' : 'var(--bg-card)',
                    color: isActive ? '#000' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {label}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: isActive ? 'rgba(0,0,0,0.15)' : 'var(--bg-secondary)',
                    color: isActive ? '#000' : 'var(--text-muted)',
                    borderRadius: 8,
                    padding: '0 4px',
                    minWidth: 16,
                    textAlign: 'center',
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add form area */}
      {isAddingWord && selectedCase && (
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <WordAddForm
            caseId={selectedCase.id}
            onSaved={(_id) => setIsAddingWord(false)}
            onCancel={() => setIsAddingWord(false)}
          />
        </div>
      )}

      {/* No case selected */}
      {!selectedCase ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          사건을 선택하면 단어 목록이 표시됩니다.
        </div>
      ) : (
        /* Table */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
              <tr>
                <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredWords.length > 0 && filteredWords.every(w => selectedWordIds.has(w.id))}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ ...thStyle }}>단어</th>
                <th style={{ ...thStyle, width: 80 }}>카테고리</th>
                <th style={{ ...thStyle }}>힌트</th>
                <th style={{ ...thStyle }}>핫스팟</th>
                <th style={{ ...thStyle, width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredWords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'pre-line' }}>
                    {searchQuery || activeCategory !== 'all' ? '검색 결과가 없습니다.' : '이 사건에는 단어가 없습니다.\n＋ 단어 추가 버튼으로 추가하세요.'}
                  </td>
                </tr>
              ) : (
                filteredWords.map(word => (
                  <WordManagerRow
                    key={word.id}
                    word={word}
                    connectionChips={connectionMap[word.id]?.chips ?? []}
                    isExpanded={expandedWordId === word.id}
                    isSelected={selectedWordIds.has(word.id)}
                    onToggleExpand={() => setExpandedWordId(expandedWordId === word.id ? null : word.id)}
                    onToggleSelect={() => handleToggleSelect(word.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer: bulk actions */}
      {selectedWordIds.size > 0 && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            선택된 {selectedWordIds.size}개
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            선택 삭제
          </button>
          <button
            type="button"
            onClick={() => setSelectedWordIds(new Set())}
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
            선택 해제
          </button>
        </div>
      )}
    </div>
  );
}
