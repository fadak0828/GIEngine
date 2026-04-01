/**
 * CaseBlueprintPreview — 생성된 CaseBlueprint 시각적 프리뷰
 * Phase 5b (FADAA-44)
 *
 * - 씬/핫스팟/단서 구조 표시
 * - 적용/취소 옵션
 */

import React, { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { CaseBlueprintState, BlueprintScene, BlueprintWord, BlueprintCharacter } from '@/store/interview-slice';

// ── 스타일 상수 ───────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 6,
  padding: '10px 12px',
  marginBottom: 10,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 8,
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  fontSize: 10,
  borderRadius: 3,
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  background: 'var(--bg-secondary)',
};

const accentBadge: React.CSSProperties = {
  ...badge,
  color: 'var(--accent)',
  borderColor: 'var(--accent-dim)',
  background: 'var(--accent-dim)',
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────

export function CaseBlueprintPreview(): React.ReactElement | null {
  const {
    interview,
    closeBlueprintPreview,
    closeInterview,
    resetInterview,
    addCase,
    setSelection,
    project,
  } = useEditorStore();

  const { blueprintPreviewOpen, blueprint } = interview;
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  if (!blueprintPreviewOpen || !blueprint) return null;

  const handleApply = async () => {
    if (!project || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      const actId = project.acts[0]?.id ?? null;
      if (!actId) throw new Error('Act가 없습니다. 먼저 Act를 생성해 주세요.');

      // Apply the blueprint via AI module's applier
      const ai = await import('@gi-engine/ai') as unknown as {
        applyBlueprintToProject?: (
          blueprint: CaseBlueprintState,
          actId: string,
          helpers: {
            addCase: (actId: string) => void;
            getState: () => { project: typeof project };
          },
        ) => Promise<string>;
      };

      // Blueprint applier가 없으면 기본 케이스 생성만 수행
      if (typeof ai.applyBlueprintToProject === 'function') {
        const store = useEditorStore.getState();
        const newCaseId = await ai.applyBlueprintToProject(blueprint, actId, {
          addCase: (aId: string) => store.addCase(aId),
          getState: () => ({ project: store.project }),
        });
        const state = useEditorStore.getState();
        const newCase = state.project?.acts
          .flatMap((a) => a.cases)
          .find((c) => c.id === newCaseId);
        if (newCase) {
          setSelection({ actId, caseId: newCaseId });
        }
      } else {
        // Fallback: 새 케이스 생성 후 선택
        addCase(actId);
        const state = useEditorStore.getState();
        const cases = state.project?.acts.find((a) => a.id === actId)?.cases ?? [];
        const newCase = cases[cases.length - 1];
        if (newCase) {
          setSelection({ actId, caseId: newCase.id });
        }
      }

      resetInterview();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : '적용 오류');
    } finally {
      setApplying(false);
    }
  };

  const handleDiscard = () => {
    resetInterview();
  };

  const handleBackToInterview = () => {
    closeBlueprintPreview();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={applying ? undefined : handleBackToInterview}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1002,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 680,
          maxWidth: '96vw',
          height: '85vh',
          maxHeight: 760,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          zIndex: 1003,
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              📋 사건 블루프린트 프리뷰
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              생성된 사건 구조를 확인하고 프로젝트에 적용하세요
            </div>
          </div>
          <button
            onClick={applying ? undefined : handleBackToInterview}
            disabled={applying}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: applying ? 'not-allowed' : 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Title & Meta */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'Instrument Serif, serif',
                marginBottom: 4,
              }}
            >
              {blueprint.title.ko}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
              {blueprint.description.ko}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={accentBadge}>장르: {blueprint.genre}</span>
              <span style={badge}>씬 {blueprint.scenes.length}개</span>
              <span style={badge}>단서어 {blueprint.words.length}개</span>
              <span style={badge}>인물 {blueprint.characters.length}명</span>
            </div>
          </div>

          {/* Characters */}
          {blueprint.characters.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>등장인물</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {blueprint.characters.map((char, i) => (
                  <CharacterCard key={i} char={char} />
                ))}
              </div>
            </div>
          )}

          {/* Scenes */}
          {blueprint.scenes.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>씬 구성</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blueprint.scenes.map((scene, i) => (
                  <SceneCard key={i} scene={scene} />
                ))}
              </div>
            </div>
          )}

          {/* Words */}
          {blueprint.words.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>단서어 목록</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {blueprint.words.map((word, i) => (
                  <WordTag key={i} word={word} />
                ))}
              </div>
            </div>
          )}

          {/* Main Puzzle */}
          {blueprint.mainPuzzle && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>메인 퍼즐</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginBottom: 3 }}>
                {blueprint.mainPuzzle.titleHint}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {blueprint.mainPuzzle.descriptionHint}
              </div>
              {blueprint.mainPuzzle.requiredWordTempIds.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  필요 단서어: {blueprint.mainPuzzle.requiredWordTempIds.length}개
                </div>
              )}
            </div>
          )}

          {/* Sub Puzzles */}
          {blueprint.subPuzzles.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionTitle}>서브 퍼즐 ({blueprint.subPuzzles.length}개)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {blueprint.subPuzzles.map((sp, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={badge}>{sp.type}</span>
                    &nbsp;&nbsp;{sp.description}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px 12px',
            borderTop: '1px solid var(--border-color)',
            flexShrink: 0,
            display: 'flex',
            gap: 8,
          }}
        >
          {applyError && (
            <div
              style={{
                flex: 1,
                fontSize: 12,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {applyError}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={handleDiscard}
            disabled={applying}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              background: 'transparent',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              cursor: applying ? 'not-allowed' : 'pointer',
            }}
          >
            버리기
          </button>
          <button
            onClick={handleBackToInterview}
            disabled={applying}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              cursor: applying ? 'not-allowed' : 'pointer',
            }}
          >
            ← 인터뷰로 돌아가기
          </button>
          <button
            onClick={() => void handleApply()}
            disabled={applying}
            style={{
              padding: '7px 18px',
              fontSize: 12,
              fontWeight: 600,
              background: applying ? 'var(--bg-card)' : 'var(--accent)',
              color: applying ? 'var(--text-muted)' : '#000',
              border: 'none',
              borderRadius: 4,
              cursor: applying ? 'not-allowed' : 'pointer',
            }}
          >
            {applying ? '적용 중...' : '프로젝트에 적용'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function CharacterCard({ char }: { char: BlueprintCharacter }): React.ReactElement {
  const roleColor: Record<string, string> = {
    culprit: 'var(--danger)',
    victim: '#9c6b4a',
    suspect: 'var(--partial)',
    witness: 'var(--success)',
  };
  const roleLabel: Record<string, string> = {
    culprit: '범인',
    victim: '피해자',
    suspect: '용의자',
    witness: '목격자',
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--border-light)',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: roleColor[char.role] ?? 'var(--text-muted)',
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {char.name}
          &nbsp;
          <span
            style={{
              fontSize: 10,
              color: roleColor[char.role] ?? 'var(--text-muted)',
              fontWeight: 400,
            }}
          >
            [{roleLabel[char.role] ?? char.role}]
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {char.description}
        </div>
        {char.alibi && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            알리바이: {char.alibi}
          </div>
        )}
      </div>
    </div>
  );
}

function SceneCard({ scene }: { scene: BlueprintScene }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: 4,
        padding: '7px 10px',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {scene.name.ko}
        </span>
        {scene.hotspotHints.length > 0 && (
          <span style={{ ...badge, marginLeft: 'auto' }}>{scene.hotspotHints.length}개 핫스팟</span>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
            {scene.description}
          </div>
          {scene.connections.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              연결: {scene.connections.join(', ')}
            </div>
          )}
          {scene.hotspotHints.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {scene.hotspotHints.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ ...badge, fontSize: 9 }}>{h.actionType}</span>
                  <span>{h.label}</span>
                  {h.contentHint && (
                    <span style={{ color: 'var(--text-muted)' }}>— {h.contentHint}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WordTag({ word }: { word: BlueprintWord }): React.ReactElement {
  return (
    <div
      style={{
        padding: '3px 8px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 3,
        fontSize: 11,
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <div style={{ fontWeight: 500 }}>{word.display.ko}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{word.category}</div>
    </div>
  );
}
