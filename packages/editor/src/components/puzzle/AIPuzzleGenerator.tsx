import React, { useState } from 'react';
import type { LocalizedText, PuzzleTemplate, AnswerDefinition } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';

// Inline types to avoid compile-time dependency on @gi-engine/ai
interface PuzzleGenerateResult {
  title: LocalizedText;
  template: PuzzleTemplate;
  answers: Record<string, AnswerDefinition>;
}

interface AIPuzzleGeneratorProps {
  caseId: string;
  caseTitle: LocalizedText;
  caseDescription: LocalizedText;
}

type GenerationPhase = 'idle' | 'loading' | 'preview' | 'error';

export function AIPuzzleGenerator({ caseId, caseTitle, caseDescription }: AIPuzzleGeneratorProps): React.ReactElement {
  const { updateMainPuzzle, updatePuzzleTemplate, updatePuzzleAnswers } = useEditorStore();
  const ui = useEditorStore(s => s.ui);
  const words = useEditorStore(s => s.words);
  const locale = ui.editorLocale;

  const caseWords = words.filter(w => w.caseId === caseId);

  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [previewResult, setPreviewResult] = useState<PuzzleGenerateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (caseWords.length === 0) return;
    setPhase('loading');
    setErrorMessage(null);
    try {
      const aiModule = await import('@gi-engine/ai') as {
        generatePuzzle: (req: {
          caseTitle: string;
          caseDescription: string;
          wordBank: string[];
          locale: string;
        }) => Promise<PuzzleGenerateResult>;
      };
      const result = await aiModule.generatePuzzle({
        caseTitle: caseTitle[locale] || caseTitle.ko || caseTitle.en,
        caseDescription: caseDescription[locale] || caseDescription.ko || caseDescription.en,
        wordBank: caseWords.map(w => w.display[locale] || w.display.ko || w.id),
        locale,
      });
      setPreviewResult(result);
      setPhase('preview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      setPhase('error');
    }
  };

  const handleApply = () => {
    if (!previewResult) return;
    updateMainPuzzle(caseId, { title: previewResult.title });
    updatePuzzleTemplate(caseId, previewResult.template);
    updatePuzzleAnswers(caseId, previewResult.answers);
    setPhase('idle');
    setPreviewResult(null);
  };

  const handleCancel = () => {
    setPhase('idle');
    setPreviewResult(null);
  };

  // Preview template as text
  const previewText = previewResult
    ? previewResult.template.segments.map(seg => {
        if (seg.type === 'text') return seg.content.ko || seg.content.en || '…';
        if (seg.type === 'slot') return `[${seg.slotId}]`;
        return '\n';
      }).join('')
    : '';

  return (
    <div style={{
      borderTop: '1px solid var(--border-color)',
      paddingTop: 12,
      marginTop: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        AI 퍼즐 생성
      </div>

      {caseWords.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          단어가 없습니다. 먼저 사건에 단어를 추가하세요.
        </div>
      )}

      {/* Error */}
      {phase === 'error' && errorMessage && (
        <div style={{
          marginBottom: 10,
          padding: '6px 8px',
          background: 'rgba(196,64,64,0.1)',
          border: '1px solid rgba(196,64,64,0.3)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--danger-text)',
        }}>
          {errorMessage}
        </div>
      )}

      {/* Preview */}
      {phase === 'preview' && previewResult && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
            생성 결과 미리보기
          </div>
          <div style={{
            padding: '8px 10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            fontSize: 12,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            marginBottom: 8,
          }}>
            {previewText}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleApply}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              적용
            </button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 12,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Generate button */}
      {phase !== 'preview' && (
        <button
          onClick={handleGenerate}
          disabled={phase === 'loading' || caseWords.length === 0}
          style={{
            width: '100%',
            padding: '7px 12px',
            fontSize: 12,
            fontWeight: 600,
            background: phase === 'loading' || caseWords.length === 0 ? 'var(--bg-card)' : 'transparent',
            color: phase === 'loading' || caseWords.length === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: phase === 'loading' || caseWords.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {phase === 'loading' ? '생성 중...' : '✨ AI로 퍼즐 생성'}
        </button>
      )}
    </div>
  );
}
