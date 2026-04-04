import React, { useState } from 'react';
import type { Hint, HintConfig } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { genId } from '@/store/utils';

const DEFAULT_HINT_CONFIG: HintConfig = {
  maxHints: 3,
  cooldownSec: 30,
};

interface HintsEditorProps {
  hints: Hint[];
  hintConfig?: HintConfig;
  caseId: string;
  puzzleId: string;
}

const LEVEL_LABELS: Record<number, { ko: string; en: string }> = {
  1: { ko: '약한 힌트', en: 'Subtle Hint' },
  2: { ko: '중간 힌트', en: 'Medium Hint' },
  3: { ko: '직접적 힌트', en: 'Direct Hint' },
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#f59e0b',
  3: '#ef4444',
};

interface HintRowProps {
  hint: Hint;
  locale: 'ko' | 'en';
  onUpdate: (patch: Partial<Hint>) => void;
  onDelete: () => void;
}

function HintRow({ hint, locale, onUpdate, onDelete }: HintRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-card)',
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          background: expanded ? 'var(--bg-secondary)' : 'transparent',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 3,
          background: LEVEL_COLORS[hint.level],
          color: '#fff',
          flexShrink: 0,
        }}>
          L{hint.level}
        </span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
          {hint.text[locale] || hint.text.ko || '(empty)'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 50 }}>레벨</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {([1, 2, 3] as const).map(level => (
                <button
                  key={level}
                  onClick={() => onUpdate({ level })}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: hint.level === level ? LEVEL_COLORS[level] : 'var(--border-color)',
                    borderRadius: 3,
                    background: hint.level === level ? LEVEL_COLORS[level] : 'transparent',
                    color: hint.level === level ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {level} - {LEVEL_LABELS[level][locale]}
                </button>
              ))}
            </div>
          </div>

          <LocalizedTextInput
            label="힌트 텍스트"
            value={hint.text}
            onChange={text => onUpdate({ text })}
            multiline
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 50 }}>조건</span>
            <input
              type="text"
              value={hint.condition ?? ''}
              onChange={e => onUpdate({ condition: e.target.value || undefined })}
              placeholder="조건 표현식 (선택사항)"
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={onDelete}
            style={{
              alignSelf: 'flex-end',
              padding: '4px 12px',
              fontSize: 11,
              fontWeight: 600,
              background: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

export function HintsEditor({ hints, hintConfig, caseId, puzzleId }: HintsEditorProps): React.ReactElement {
  const { updatePuzzleHints, updatePuzzleHintConfig } = useEditorStore();
  const ui = useEditorStore(s => s.ui);
  const locale = ui.editorLocale;
  const [configExpanded, setConfigExpanded] = useState(false);
  const config = hintConfig ?? DEFAULT_HINT_CONFIG;

  const handleConfigChange = (patch: Partial<HintConfig>) => {
    updatePuzzleHintConfig(caseId, { ...config, ...patch });
  };

  const handleUpdate = (index: number, patch: Partial<Hint>) => {
    const newHints = hints.map((h, i) => i === index ? { ...h, ...patch } : h);
    updatePuzzleHints(caseId, newHints);
  };

  const handleDelete = (index: number) => {
    const newHints = hints.filter((_, i) => i !== index);
    updatePuzzleHints(caseId, newHints);
  };

  const handleAdd = () => {
    const newHint: Hint = {
      id: genId('hint'),
      puzzleId,
      level: 1,
      text: { ko: '', en: '' },
    };
    updatePuzzleHints(caseId, [...hints, newHint]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        border: '1px solid var(--border-color)',
        borderRadius: 6,
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            background: configExpanded ? 'var(--bg-secondary)' : 'transparent',
          }}
          onClick={() => setConfigExpanded(v => !v)}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>힌트 설정</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
            최대 {config.maxHints}회 · 쿨다운 {config.cooldownSec}초{config.scorePenalty ? ` · 패널티 ${config.scorePenalty}` : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {configExpanded ? '▼' : '▶'}
          </span>
        </div>

        {configExpanded && (
          <div style={{
            padding: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80 }}>최대 힌트 횟수</span>
              <input
                type="number"
                min={1}
                max={10}
                value={config.maxHints}
                onChange={e => handleConfigChange({ maxHints: Math.max(1, parseInt(e.target.value) || 1) })}
                style={{
                  width: 60,
                  padding: '4px 8px',
                  fontSize: 12,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80 }}>쿨다운 (초)</span>
              <input
                type="number"
                min={0}
                max={300}
                value={config.cooldownSec}
                onChange={e => handleConfigChange({ cooldownSec: Math.max(0, parseInt(e.target.value) || 0) })}
                style={{
                  width: 60,
                  padding: '4px 8px',
                  fontSize: 12,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80 }}>점수 패널티</span>
              <input
                type="number"
                min={0}
                value={config.scorePenalty ?? 0}
                onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  handleConfigChange({ scorePenalty: val > 0 ? val : undefined });
                }}
                placeholder="선택사항"
                style={{
                  width: 60,
                  padding: '4px 8px',
                  fontSize: 12,
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(0이면 없음)</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {hints.length}개 힌트
        </div>
        <button
          onClick={handleAdd}
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          + 힌트 추가
        </button>
      </div>

      {hints.length === 0 ? (
        <div style={{
          padding: 16,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-color)',
          borderRadius: 6,
        }}>
          힌트가 없습니다. "힌트 추가" 버튼으로 힌트를 추가하세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hints.map((hint, index) => (
            <HintRow
              key={hint.id}
              hint={hint}
              locale={locale}
              onUpdate={patch => handleUpdate(index, patch)}
              onDelete={() => handleDelete(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
