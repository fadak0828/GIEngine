import React from 'react';
import type { ScenarioPuzzle } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { FieldRow } from './FieldRow';
import { inputStyle, sectionLabelStyle, smallBtnStyle, dangerBtnStyle, cardStyle } from './styles';

export function ScenarioFields({
  puzzle,
  caseId,
}: {
  puzzle: ScenarioPuzzle;
  caseId: string;
}): React.ReactElement {
  const { updateSubPuzzle } = useEditorStore();
  const answerEntries = Object.entries(puzzle.answers);

  const addAnswer = () => {
    const key = `slot_${Date.now()}`;
    updateSubPuzzle(caseId, puzzle.id, {
      answers: { ...puzzle.answers, [key]: { correctWordId: '' } },
    } as Partial<ScenarioPuzzle>);
  };

  const updateAnswerKey = (oldKey: string, newKey: string) => {
    if (newKey === oldKey) return;
    const entries = Object.entries(puzzle.answers);
    const newAnswers: Record<
      string,
      { correctWordId: string; partiallyCorrectWordIds?: string[] }
    > = {};
    for (const [k, v] of entries) {
      newAnswers[k === oldKey ? newKey : k] = v;
    }
    updateSubPuzzle(caseId, puzzle.id, {
      answers: newAnswers,
    } as Partial<ScenarioPuzzle>);
  };

  const updateAnswerValue = (key: string, correctWordId: string) => {
    updateSubPuzzle(caseId, puzzle.id, {
      answers: {
        ...puzzle.answers,
        [key]: { ...puzzle.answers[key], correctWordId },
      },
    } as Partial<ScenarioPuzzle>);
  };

  const removeAnswer = (key: string) => {
    const { [key]: _, ...rest } = puzzle.answers;
    updateSubPuzzle(caseId, puzzle.id, {
      answers: rest,
    } as Partial<ScenarioPuzzle>);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={sectionLabelStyle}>정답 ({answerEntries.length})</div>
      {answerEntries.map(([key, val]) => (
        <div key={key} style={cardStyle}>
          <FieldRow label="슬롯 ID">
            <input
              value={key}
              onChange={e => updateAnswerKey(key, e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="정답 단어 ID">
            <input
              value={val.correctWordId}
              onChange={e => updateAnswerValue(key, e.target.value)}
              style={inputStyle}
            />
          </FieldRow>
          <button onClick={() => removeAnswer(key)} style={dangerBtnStyle}>
            정답 삭제
          </button>
        </div>
      ))}
      <button onClick={addAnswer} style={smallBtnStyle}>
        + 정답 추가
      </button>
    </div>
  );
}
