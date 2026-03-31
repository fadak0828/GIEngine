import React from 'react';
import type { TimelinePuzzle, TimelineSlot } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { FieldRow } from './FieldRow';
import { inputStyle, sectionLabelStyle, smallBtnStyle, dangerBtnStyle, cardStyle } from './styles';

export function TimelineFields({
  puzzle,
  caseId,
}: {
  puzzle: TimelinePuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  const addSlot = () => {
    const slot: TimelineSlot = {
      slotId: `slot_${Date.now()}`,
      label: { ko: '', en: '' },
      answerId: '',
    };
    updateSubPuzzle(caseId, puzzle.id, {
      slots: [...puzzle.slots, slot],
    } as Partial<TimelinePuzzle>);
  };

  const updateSlot = (idx: number, patch: Partial<TimelineSlot>) => {
    const updated = puzzle.slots.map((s, i) =>
      i === idx ? { ...s, ...patch } : s,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      slots: updated,
    } as Partial<TimelinePuzzle>);
  };

  const removeSlot = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      slots: puzzle.slots.filter((_, i) => i !== idx),
    } as Partial<TimelinePuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={sectionLabelStyle}>타임라인 슬롯 ({puzzle.slots.length})</div>
      {puzzle.slots.map((slot, idx) => (
        <div key={idx} style={cardStyle}>
          <FieldRow label="슬롯 ID">
            <input
              value={slot.slotId}
              onChange={e => updateSlot(idx, { slotId: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <LocalizedTextInput
            label="라벨"
            value={slot.label}
            onChange={label => updateSlot(idx, { label })}
          />
          <FieldRow label="정답 ID">
            <input
              value={slot.answerId}
              onChange={e => updateSlot(idx, { answerId: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <button onClick={() => removeSlot(idx)} style={dangerBtnStyle}>
            슬롯 삭제
          </button>
        </div>
      ))}
      <button onClick={addSlot} style={smallBtnStyle}>
        + 타임라인 슬롯 추가
      </button>
    </div>
  );
}
