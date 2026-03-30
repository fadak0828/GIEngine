import React from 'react';
import type { PuzzleTemplate, PuzzleSegment } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { SegmentRow } from './SegmentRow';

interface PuzzleTemplateEditorProps {
  template: PuzzleTemplate;
  caseId: string;
}

function nextSlotId(segments: PuzzleSegment[]): string {
  let maxN = 0;
  for (const seg of segments) {
    if (seg.type === 'slot') {
      const match = /^slot_(\d+)$/.exec(seg.slotId);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxN) maxN = n;
      }
    }
  }
  return `slot_${maxN + 1}`;
}

export function PuzzleTemplateEditor({ template, caseId }: PuzzleTemplateEditorProps): React.ReactElement {
  const { updatePuzzleTemplate } = useEditorStore();

  const segments = template.segments;

  const updateSegments = (newSegments: PuzzleSegment[]) => {
    updatePuzzleTemplate(caseId, { segments: newSegments });
  };

  const handleChange = (index: number, updated: PuzzleSegment) => {
    const next = [...segments];
    next[index] = updated;
    updateSegments(next);
  };

  const handleDelete = (index: number) => {
    const next = segments.filter((_, i) => i !== index);
    updateSegments(next);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...segments];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    updateSegments(next);
  };

  const handleMoveDown = (index: number) => {
    if (index === segments.length - 1) return;
    const next = [...segments];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    updateSegments(next);
  };

  const addText = () => {
    updateSegments([...segments, { type: 'text', content: { ko: '', en: '' } }]);
  };

  const addSlot = () => {
    const slotId = nextSlotId(segments);
    updateSegments([
      ...segments,
      { type: 'slot', slotId, placeholder: { ko: '', en: '' } },
    ]);
  };

  const addLineBreak = () => {
    updateSegments([...segments, { type: 'line_break' }]);
  };

  // Live preview: render segments as text
  const preview = segments.map(seg => {
    if (seg.type === 'text') return seg.content.ko || seg.content.en || '…';
    if (seg.type === 'slot') return `[${seg.slotId}]`;
    return '\n';
  }).join('');

  return (
    <div>
      {/* Live preview */}
      {segments.length > 0 && (
        <div style={{
          padding: '8px 10px',
          marginBottom: 10,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
        }}>
          {preview || '(미리보기 없음)'}
        </div>
      )}

      {/* Segment list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {segments.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
            세그먼트가 없습니다. 아래 버튼으로 추가하세요.
          </div>
        )}
        {segments.map((seg, i) => (
          <SegmentRow
            key={i}
            segment={seg}
            index={i}
            total={segments.length}
            onChange={updated => handleChange(i, updated)}
            onDelete={() => handleDelete(i)}
            onMoveUp={() => handleMoveUp(i)}
            onMoveDown={() => handleMoveDown(i)}
          />
        ))}
      </div>

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={addText} style={addBtn}>＋ 텍스트</button>
        <button onClick={addSlot} style={addBtn}>＋ 슬롯</button>
        <button onClick={addLineBreak} style={addBtn}>＋ 줄바꿈</button>
      </div>
    </div>
  );
}

const addBtn: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  fontSize: 11,
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  cursor: 'pointer',
};
