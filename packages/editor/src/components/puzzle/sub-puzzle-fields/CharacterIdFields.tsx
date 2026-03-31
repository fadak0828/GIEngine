import React from 'react';
import type { CharacterIdPuzzle, CharacterSlot } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { FieldRow } from './FieldRow';
import { inputStyle, sectionLabelStyle, smallBtnStyle, dangerBtnStyle, cardStyle } from './styles';

export function CharacterIdFields({
  puzzle,
  caseId,
}: {
  puzzle: CharacterIdPuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();

  const addCharacter = () => {
    const slot: CharacterSlot = {
      portrait: '',
      nameSlotId: `slot_${Date.now()}`,
      answerId: '',
    };
    updateSubPuzzle(caseId, puzzle.id, {
      characters: [...puzzle.characters, slot],
    } as Partial<CharacterIdPuzzle>);
  };

  const updateCharacter = (idx: number, patch: Partial<CharacterSlot>) => {
    const updated = puzzle.characters.map((c, i) =>
      i === idx ? { ...c, ...patch } : c,
    );
    updateSubPuzzle(caseId, puzzle.id, {
      characters: updated,
    } as Partial<CharacterIdPuzzle>);
  };

  const removeCharacter = (idx: number) => {
    updateSubPuzzle(caseId, puzzle.id, {
      characters: puzzle.characters.filter((_, i) => i !== idx),
    } as Partial<CharacterIdPuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={sectionLabelStyle}>캐릭터 슬롯 ({puzzle.characters.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {puzzle.characters.map((char, idx) => (
          <div key={idx} style={cardStyle}>
            <FieldRow label="초상화 (Asset)">
              <input
                value={char.portrait}
                onChange={e => updateCharacter(idx, { portrait: e.target.value })}
                placeholder="asset_id"
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="슬롯 ID">
              <input
                value={char.nameSlotId}
                onChange={e => updateCharacter(idx, { nameSlotId: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
            <FieldRow label="정답 ID">
              <input
                value={char.answerId}
                onChange={e => updateCharacter(idx, { answerId: e.target.value })}
                style={inputStyle}
              />
            </FieldRow>
            <button onClick={() => removeCharacter(idx)} style={dangerBtnStyle}>
              슬롯 삭제
            </button>
          </div>
        ))}
      </div>
      <button onClick={addCharacter} style={smallBtnStyle}>
        + 캐릭터 슬롯 추가
      </button>
    </div>
  );
}
