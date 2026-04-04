import React, { useState } from 'react';
import type { PuzzleSegment, Word } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { PuzzleTemplateEditor } from './PuzzleTemplateEditor';
import { AnswerKeyEditor } from './AnswerKeyEditor';
import { AIPuzzleGenerator } from './AIPuzzleGenerator';
import { HintsEditor } from './HintsEditor';

// ── renderPreview ─────────────────────────────────────────────────

function renderPreview(
  segments: PuzzleSegment[],
  answers: Record<string, { correctWordId: string }>,
  words: Word[],
  locale: 'ko' | 'en'
): React.ReactNode {
  return segments.map((seg, i) => {
    if (seg.type === 'text') {
      return <span key={i}>{seg.content[locale] || seg.content.ko}</span>;
    }
    if (seg.type === 'line_break') {
      return <br key={i} />;
    }
    if (seg.type === 'slot') {
      const word = words.find(w => w.id === answers[seg.slotId]?.correctWordId);
      return (
        <span
          key={i}
          style={{
            borderBottom: '2px solid var(--accent)',
            minWidth: 40,
            display: 'inline-block',
            textAlign: 'center',
            color: word ? 'var(--accent)' : 'var(--text-muted)',
            padding: '0 4px',
          }}
        >
          {word ? (word.display[locale] || word.display.ko) : '___'}
        </span>
      );
    }
    return null;
  });
}

// ── PuzzleEditorPanel ─────────────────────────────────────────────

export function PuzzleEditorPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);
  const words = useEditorStore(s => s.words);
  const ui = useEditorStore(s => s.ui);
  const { updateMainPuzzle } = useEditorStore();
  const locale = ui.editorLocale;

  const [aiOpen, setAiOpen] = useState(false);

  // Find selected case
  let selectedCase = null;
  if (project && selection.caseId) {
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === selection.caseId);
      if (c) { selectedCase = c; break; }
    }
  }

  const caseWords = selectedCase ? words.filter(w => w.caseId === selectedCase!.id) : [];
  const mainPuzzle = selectedCase?.puzzles.main;

  // Empty states
  if (!selectedCase) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13, color: 'var(--text-muted)' }}>
        사건을 선택하세요
      </div>
    );
  }

  if (!mainPuzzle) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13, color: 'var(--text-muted)' }}>
        퍼즐 데이터를 찾을 수 없습니다
      </div>
    );
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
  };

  const accordionBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* LEFT: segment builder — flex 1.2 */}
      <div style={{
        flex: 1.2,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {/* Scrollable content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Puzzle title */}
          <div>
            <div style={sectionLabelStyle}>퍼즐 제목</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, flexShrink: 0 }}>KO</span>
                <input
                  value={mainPuzzle.title.ko}
                  onChange={e => updateMainPuzzle(selectedCase.id, { title: { ...mainPuzzle.title, ko: e.target.value } })}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: 12,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, flexShrink: 0 }}>EN</span>
                <input
                  value={mainPuzzle.title.en}
                  onChange={e => updateMainPuzzle(selectedCase.id, { title: { ...mainPuzzle.title, en: e.target.value } })}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: 12,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Template editor */}
          <div>
            <div style={sectionLabelStyle}>퍼즐 템플릿</div>
            <PuzzleTemplateEditor template={mainPuzzle.template} caseId={selectedCase.id} />
          </div>
        </div>

        {/* AI accordion pinned to bottom */}
        <div style={{ borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button
            onClick={() => setAiOpen(v => !v)}
            style={accordionBtnStyle}
          >
            <span>{aiOpen ? '▼' : '▶'}</span>
            <span>✨ AI 퍼즐 생성</span>
          </button>
          {aiOpen && (
            <div style={{ padding: '0 16px 16px' }}>
              <AIPuzzleGenerator
                caseId={selectedCase.id}
                caseTitle={selectedCase.title}
                caseDescription={selectedCase.description}
              />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: preview + answer slots — flex 0.8 */}
      <div style={{
        flex: 0.8,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Preview */}
          <div>
            <div style={sectionLabelStyle}>미리보기</div>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 16,
              fontSize: 15,
              lineHeight: 1.8,
              minHeight: 80,
              color: 'var(--text-primary)',
            }}>
              {mainPuzzle.template.segments.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  (템플릿에 세그먼트를 추가하면 여기서 미리볼 수 있습니다)
                </span>
              ) : (
                renderPreview(mainPuzzle.template.segments, mainPuzzle.answers, caseWords, locale)
              )}
            </div>
          </div>

          {/* Answer slots */}
          <div>
            <div style={sectionLabelStyle}>정답 슬롯 배정</div>
            {caseWords.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                이 사건에 등록된 단어가 없습니다
              </div>
            ) : (
              <AnswerKeyEditor
                template={mainPuzzle.template}
                answers={mainPuzzle.answers}
                caseId={selectedCase.id}
                caseWords={caseWords}
              />
            )}
          </div>

          {/* Hints */}
          <div>
            <div style={sectionLabelStyle}>힌트</div>
            <HintsEditor
              hints={mainPuzzle.hints ?? []}
              caseId={selectedCase.id}
              puzzleId={mainPuzzle.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
