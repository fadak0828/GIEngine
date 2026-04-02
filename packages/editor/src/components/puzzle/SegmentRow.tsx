import React from 'react';
import type { PuzzleSegment, WordCategory } from '@gi-engine/core';

interface SegmentRowProps {
  segment: PuzzleSegment;
  index: number;
  total: number;
  onChange: (s: PuzzleSegment) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const ACCEPT_CATEGORY_OPTIONS: Array<{ value: WordCategory | ''; label: string }> = [
  { value: '', label: '(제한 없음)' },
  { value: 'person', label: '인물' },
  { value: 'place', label: '장소' },
  { value: 'object', label: '물건' },
  { value: 'action', label: '행동' },
  { value: 'time', label: '시간' },
  { value: 'motive', label: '동기' },
  { value: 'evidence', label: '증거' },
];

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '3px 6px',
  fontSize: 11,
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  outline: 'none',
  minWidth: 0,
  boxSizing: 'border-box',
};

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '2px 5px',
  fontSize: 11,
  borderRadius: 3,
  lineHeight: 1,
  flexShrink: 0,
};

const deleteBtn: React.CSSProperties = {
  ...iconBtn,
  color: 'var(--danger)',
  border: '1px solid rgba(196,64,64,0.4)',
};

export function SegmentRow({
  segment,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SegmentRowProps): React.ReactElement {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '6px 8px',
      background: 'var(--bg-secondary)',
      borderRadius: 4,
      border: '1px solid var(--border-color)',
    }}>
      {/* Row header: type label + move/delete controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          background: 'var(--bg-card)',
          padding: '1px 5px',
          borderRadius: 2,
          flexShrink: 0,
        }}>
          {segment.type === 'text' ? '텍스트' : segment.type === 'slot' ? '슬롯' : '줄바꿈'}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          style={{ ...iconBtn, opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'not-allowed' : 'pointer' }}
          title="위로"
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          style={{ ...iconBtn, opacity: index === total - 1 ? 0.3 : 1, cursor: index === total - 1 ? 'not-allowed' : 'pointer' }}
          title="아래로"
        >
          ↓
        </button>
        <button onClick={onDelete} style={deleteBtn} title="삭제">
          ×
        </button>
      </div>

      {segment.type === 'text' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 18, flexShrink: 0 }}>KO</span>
            <input
              value={segment.content.ko}
              onChange={e => onChange({ ...segment, content: { ...segment.content, ko: e.target.value } })}
              placeholder="한국어 텍스트"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 18, flexShrink: 0 }}>EN</span>
            <input
              value={segment.content.en}
              onChange={e => onChange({ ...segment, content: { ...segment.content, en: e.target.value } })}
              placeholder="English text"
              style={inputStyle}
            />
          </div>
        </>
      )}

      {segment.type === 'slot' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(245,158,11,0.15)', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>
              {segment.slotId}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 18, flexShrink: 0 }}>KO</span>
            <input
              value={segment.placeholder?.ko ?? ''}
              onChange={e => onChange({
                ...segment,
                placeholder: { ko: e.target.value, en: segment.placeholder?.en ?? '' },
              })}
              placeholder="힌트 (KO)"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 18, flexShrink: 0 }}>EN</span>
            <input
              value={segment.placeholder?.en ?? ''}
              onChange={e => onChange({
                ...segment,
                placeholder: { ko: segment.placeholder?.ko ?? '', en: e.target.value },
              })}
              placeholder="Hint (EN)"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>카테고리</span>
            <select
              value={segment.acceptCategory ?? ''}
              onChange={e => {
                const val = e.target.value;
                onChange({
                  ...segment,
                  acceptCategory: val === '' ? undefined : (val as WordCategory),
                });
              }}
              style={{
                ...inputStyle,
                cursor: 'pointer',
              }}
            >
              {ACCEPT_CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {segment.type === 'line_break' && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '2px 0' }}>
          — 줄바꿈 —
        </div>
      )}
    </div>
  );
}
