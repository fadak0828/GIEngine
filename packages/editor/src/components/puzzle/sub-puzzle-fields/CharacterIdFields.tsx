import React from 'react';
import type { CharacterIdPuzzle, CharacterSlot } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { ImageAssetPicker } from '@/components/shared/ImageAssetPicker';
import { WordDropdown } from '@/components/words/WordDropdown';
import { FieldRow } from './FieldRow';
import { sectionLabelStyle, smallBtnStyle, dangerBtnStyle, cardStyle } from './styles';

const readonlyIdStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  color: 'var(--text-muted)',
  padding: '2px 4px',
  background: 'var(--bg-primary)',
  borderRadius: 2,
};

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
            {/* Portrait: ImageAssetPicker */}
            <FieldRow label="초상화">
              <ImageAssetPicker
                assetId={char.portrait}
                onChange={portrait => updateCharacter(idx, { portrait })}
              />
            </FieldRow>

            {/* answerId: WordDropdown singleSelect */}
            <WordDropdown
              caseId={caseId}
              singleSelect
              wordId={char.answerId}
              onChangeSingle={answerId => updateCharacter(idx, { answerId })}
              label="정답 단어"
            />

            {/* nameSlotId: 읽기 전용 */}
            <FieldRow label="슬롯 ID">
              <span style={readonlyIdStyle}>{char.nameSlotId}</span>
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
