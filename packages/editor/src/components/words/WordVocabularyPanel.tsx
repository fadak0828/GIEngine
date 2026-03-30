import React, { useMemo, useState } from 'react';
import type { Scene } from '@gi-engine/core';
import { useWords } from '@/store/editor-store';
import { WordRow } from './WordRow';
import { WordAddForm } from './WordAddForm';

interface WordVocabularyPanelProps {
  caseId: string;
  caseScenes: Scene[];
}

export function WordVocabularyPanel({ caseId, caseScenes }: WordVocabularyPanelProps): React.ReactElement {
  const words = useWords();
  const [isAdding, setIsAdding] = useState(false);

  const caseWords = useMemo(
    () => words.filter(w => w.caseId === caseId),
    [words, caseId]
  );

  // Build connectionMap: wordId -> count of hotspots in caseScenes that reference it via word_reveal
  const connectionMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const word of caseWords) {
      map[word.id] = 0;
    }
    for (const scene of caseScenes) {
      for (const hotspot of scene.hotspots) {
        const action = hotspot.action;
        if (action.type === 'word_reveal') {
          for (const wid of action.wordIds) {
            if (wid in map) {
              map[wid] = (map[wid] ?? 0) + 1;
            }
          }
        }
        // Also check composite actions
        if (action.type === 'composite') {
          for (const subAction of action.actions) {
            if (subAction.type === 'word_reveal') {
              for (const wid of subAction.wordIds) {
                if (wid in map) {
                  map[wid] = (map[wid] ?? 0) + 1;
                }
              }
            }
          }
        }
      }
    }
    return map;
  }, [caseWords, caseScenes]);

  const handleSaved = (_wordId: string) => {
    setIsAdding(false);
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginBottom: 16 }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            단어 목록
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 10,
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {caseWords.length}
          </span>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--bg-card)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            + 단어 추가
          </button>
        )}
      </div>

      {/* Word rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {caseWords.length === 0 && !isAdding && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '12px 0',
              border: '1px dashed var(--border-color)',
              borderRadius: 4,
            }}
          >
            이 사건에는 단어가 없습니다.
            <br />
            <span style={{ fontSize: 11 }}>+ 단어 추가 버튼으로 추가하세요.</span>
          </div>
        )}

        {caseWords.map(word => (
          <WordRow
            key={word.id}
            word={word}
            connectionCount={connectionMap[word.id] ?? 0}
          />
        ))}

        {isAdding && (
          <WordAddForm
            caseId={caseId}
            onSaved={handleSaved}
            onCancel={() => setIsAdding(false)}
          />
        )}
      </div>
    </div>
  );
}
