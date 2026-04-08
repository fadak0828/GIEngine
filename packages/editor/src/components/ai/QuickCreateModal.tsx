/**
 * QuickCreateModal — Quick Create 3단계 마법사 UI
 * Phase 3 (FADAA-59)
 *
 * Step 1: 메인 퍼즐 문구 입력 + 선택적 장르/분위기/시대 + 고급 설정 토글
 * Step 2: 섹션별 4가지 변형 카드 + 직접 입력 옵션
 * Step 3: 생성 진행률 + 블루프린트 완료 안내
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { ChoiceSelection } from '@/store/quick-create-slice';

// ── AI 모듈 타입 (동적 import용) ──────────────────────────────────

type QuickCreateModule = {
  quickCreateEngine: {
    startFromSentence: (
      sentence: string,
      options?: {
        genre?: string;
        atmosphere?: string;
        era?: string;
        locale?: string;
        withChoices?: boolean;
        onProgress?: (p: { step: string; percent: number; message: string }) => void;
      },
    ) => Promise<{
      blueprint: unknown;
      choices?: {
        characters: { id: string; label: string; summary: string }[];
        scenes: { id: string; label: string; summary: string }[];
        puzzleStructure: { id: string; label: string; summary: string }[];
        atmosphere: { id: string; label: string; summary: string }[];
      };
    }>;
    applyChoicesToBlueprint: (
      originalSentence: string,
      currentBlueprint: unknown,
      selection: ChoiceSelection,
      choices: unknown,
      options?: { locale?: string },
      onProgress?: (p: { step: string; percent: number; message: string }) => void,
    ) => Promise<{ blueprint: unknown }>;
  };
};

// ── 상수 ─────────────────────────────────────────────────────────

const GENRE_OPTIONS = [
  { value: '', label: '자동 선택' },
  { value: 'mystery', label: '미스터리' },
  { value: 'noir', label: '누아르' },
  { value: 'thriller', label: '스릴러' },
  { value: 'historical', label: '역사' },
  { value: 'fantasy', label: '판타지' },
];

const SECTION_LABELS: Record<string, string> = {
  characters: '캐릭터 구성',
  scenes: '씬 배치',
  puzzleStructure: '퍼즐 구조',
  atmosphere: '분위기/스타일',
};

const EXAMPLE_SENTENCES = [
  '점심시간 카페에서 파티시에 바리스타가 독을 넣었다',
  '고성 무도회 밤에 백작의 조카가 심장을 찔렸다',
  '지방 연구소에서 수석 과학자가 실험체 약물로 살해됐다',
];

// ── 스타일 ────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalBox: React.CSSProperties = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  width: 680,
  maxWidth: '95vw',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};

const headerBar: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

const bodyArea: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '20px',
};

const footerBar: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
  gap: 8,
};

const baseBtn: React.CSSProperties = {
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 500,
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--text-primary)',
  transition: 'background 0.15s',
};

const primaryBtn: React.CSSProperties = {
  ...baseBtn,
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  color: '#000',
  fontWeight: 600,
};

const disabledBtn: React.CSSProperties = {
  ...primaryBtn,
  opacity: 0.4,
  cursor: 'not-allowed',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'auto',
};

// ── 컴포넌트 ──────────────────────────────────────────────────────

export function QuickCreateModal(): React.ReactElement | null {
  const qc = useEditorStore(s => s.quickCreate);
  const {
    closeQuickCreate,
    setQuickCreateSentence,
    setQuickCreateGenre,
    setQuickCreateAtmosphere,
    setQuickCreateEra,
    toggleQuickCreateAdvanced,
    setQuickCreateWizardStep,
    setQuickCreateGenerating,
    setQuickCreateError,
    setQuickCreateBlueprint,
    setQuickCreateChoices,
    setQuickCreateSelection,
    setQuickCreateProgress,
    openQuickCreateBlueprintPreview,
    applyQuickCreateBlueprintToEditor,
  } = useEditorStore();

  const [applyingToEditor, setApplyingToEditor] = useState(false);
  const [applyingChoices, setApplyingChoices] = useState(false);

  // Step 2 → 선택 사항 적용 후 블루프린트 재생성
  const handleApplyChoices = useCallback(async () => {
    if (!qc.blueprint || !qc.choices) return;

    setApplyingChoices(true);
    setQuickCreateError(null);

    try {
      const aiMod = (await import('@gi-engine/ai')) as QuickCreateModule;

      const result = await aiMod.quickCreateEngine.applyChoicesToBlueprint(
        qc.sentence.trim(),
        qc.blueprint as never,
        qc.selection,
        qc.choices as never,
        { locale: 'ko' },
        (p) => setQuickCreateProgress({ step: p.message, percent: p.percent }),
      );

      setQuickCreateBlueprint(result.blueprint as never);
      // 선택 적용 후 choices는 재생성하지 않음 (같은 선택 유지)
      setQuickCreateProgress({ step: '선택 사항 적용 완료', percent: 100 });
    } catch (err) {
      setQuickCreateError(String(err));
    } finally {
      setApplyingChoices(false);
    }
  }, [  
    qc.sentence, qc.blueprint, qc.choices, qc.selection,
    setQuickCreateError, setQuickCreateProgress, setQuickCreateBlueprint,
  ]);

  // Step 1 → Step 3: AI 엔진 호출
  const handleGenerate = useCallback(async () => {
    if (!qc.sentence.trim()) return;

    setQuickCreateGenerating(true);
    setQuickCreateError(null);
    setQuickCreateWizardStep(3);

    try {
      const aiMod = (await import('@gi-engine/ai')) as QuickCreateModule;

      const result = await aiMod.quickCreateEngine.startFromSentence(qc.sentence.trim(), {
        genre: qc.genre || undefined,
        atmosphere: qc.atmosphere || undefined,
        era: qc.era || undefined,
        locale: 'ko',
        withChoices: true,
        onProgress: (p) => setQuickCreateProgress({ step: p.message, percent: p.percent }),
      });

      setQuickCreateBlueprint(result.blueprint as never);
      if (result.choices) setQuickCreateChoices(result.choices);
      setQuickCreateProgress({ step: '생성 완료', percent: 100 });
    } catch (err) {
      setQuickCreateError(String(err));
      setQuickCreateWizardStep(1);
    } finally {
      setQuickCreateGenerating(false);
    }
  }, [
    qc.sentence, qc.genre, qc.atmosphere, qc.era,
    setQuickCreateGenerating, setQuickCreateError, setQuickCreateWizardStep,
    setQuickCreateProgress, setQuickCreateBlueprint, setQuickCreateChoices,
  ]);

  // 에디터에 적용
  const project = useEditorStore(s => s.project);
  const handleApply = useCallback(async () => {
    if (!qc.blueprint) return;
    // Fallback to first act if targetActId is not set
    const actId = qc.targetActId ?? project?.acts?.[0]?.id;
    if (!actId) {
      setQuickCreateError('사건을 적용할 막(Act)이 없습니다. 에디터에서 막을 먼저 선택해주세요.');
      return;
    }
    setApplyingToEditor(true);
    setQuickCreateError(null);
    try {
      await applyQuickCreateBlueprintToEditor(actId, false);
    } finally {
      setApplyingToEditor(false);
    }
  }, [qc.blueprint, qc.targetActId, project, setQuickCreateError, applyQuickCreateBlueprintToEditor]);

  // 적용 버튼 활성 조건: blueprint 있고, actId가 있으며, 현재 적용 중이 아닐 때
  const actId = qc.targetActId ?? project?.acts?.[0]?.id;

  if (!qc.open) return null;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) closeQuickCreate(); }}>
      <div style={modalBox}>
        {/* Header */}
        <div style={headerBar}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontFamily: 'Instrument Serif, serif', color: 'var(--text-primary)' }}>
              ⚡ Quick Create
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              1문장으로 완성된 추리 사건 생성
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StepIndicator current={qc.wizardStep} />
            <button onClick={closeQuickCreate} style={{ ...baseBtn, padding: '4px 10px', fontSize: 16 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={bodyArea}>
          {qc.wizardStep === 1 && (
            <Step1
              sentence={qc.sentence}
              genre={qc.genre}
              atmosphere={qc.atmosphere}
              era={qc.era}
              showAdvanced={qc.showAdvanced}
              error={qc.error}
              onSentenceChange={setQuickCreateSentence}
              onGenreChange={setQuickCreateGenre}
              onAtmosphereChange={setQuickCreateAtmosphere}
              onEraChange={setQuickCreateEra}
              onToggleAdvanced={toggleQuickCreateAdvanced}
            />
          )}
          {qc.wizardStep === 2 && qc.choices && (
            <Step2
              choices={qc.choices}
              selection={qc.selection}
              onSelectionChange={setQuickCreateSelection}
            />
          )}
          {qc.wizardStep === 3 && (
            <Step3
              progress={qc.progress}
              blueprint={qc.blueprint}
              error={qc.error}
            />
          )}
        </div>

        {/* Footer */}
        <div style={footerBar}>
          {qc.wizardStep === 1 && (
            <>
              <button onClick={closeQuickCreate} style={baseBtn}>취소</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {qc.choices && (
                  <button
                    onClick={() => setQuickCreateWizardStep(2)}
                    style={baseBtn}
                  >
                    선택지 검토
                  </button>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={!qc.sentence.trim()}
                  style={qc.sentence.trim() ? primaryBtn : disabledBtn}
                >
                  🚀 사건 생성
                </button>
              </div>
            </>
          )}
          {qc.wizardStep === 2 && (
            <>
              <button onClick={() => setQuickCreateWizardStep(1)} style={baseBtn}>← 뒤로</button>
              <button
                onClick={handleApplyChoices}
                disabled={applyingChoices || qc.isGenerating}
                style={applyingChoices || qc.isGenerating ? disabledBtn : primaryBtn}
              >
                {applyingChoices ? '반영 중...' : '🔄 이 설정으로 재생성'}
              </button>
            </>
          )}
          {qc.wizardStep === 3 && (
            <>
              <button
                onClick={() => { setQuickCreateWizardStep(1); setQuickCreateProgress(null); setQuickCreateError(null); }}
                style={baseBtn}
                disabled={qc.isGenerating}
              >
                ← 처음으로
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {qc.blueprint && !qc.isGenerating && (
                  <>
                    <button onClick={openQuickCreateBlueprintPreview} style={baseBtn}>
                      🔍 미리보기
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applyingToEditor || !actId}
                      style={applyingToEditor || !actId ? disabledBtn : primaryBtn}
                    >
                      {applyingToEditor ? '적용 중...' : '✅ 에디터에 적용'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }): React.ReactElement {
  const steps = ['입력', '선택지', '생성'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {steps.map((label, i) => {
        const num = (i + 1) as 1 | 2 | 3;
        const active = num === current;
        const done = num < current;
        return (
          <React.Fragment key={num}>
            {i > 0 && (
              <div style={{ width: 20, height: 1, background: done ? 'var(--accent)' : 'var(--border-color)' }} />
            )}
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
              background: active ? 'var(--accent)' : done ? 'var(--accent-dim)' : 'var(--bg-card)',
              color: active ? '#000' : done ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${active || done ? 'var(--accent)' : 'var(--border-color)'}`,
            }}>
              {done ? '✓' : num}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: 입력 화면 ─────────────────────────────────────────────

interface Step1Props {
  sentence: string;
  genre: string;
  atmosphere: string;
  era: string;
  showAdvanced: boolean;
  error: string | null;
  onSentenceChange: (v: string) => void;
  onGenreChange: (v: string) => void;
  onAtmosphereChange: (v: string) => void;
  onEraChange: (v: string) => void;
  onToggleAdvanced: () => void;
}

function Step1({
  sentence, genre, atmosphere, era, showAdvanced, error,
  onSentenceChange, onGenreChange, onAtmosphereChange, onEraChange, onToggleAdvanced,
}: Step1Props): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 메인 입력 */}
      <div>
        <p style={labelStyle}>핵심 문장 *</p>
        <textarea
          ref={textareaRef}
          value={sentence}
          onChange={e => onSentenceChange(e.target.value)}
          placeholder="예: 점심시간 카페에서 파티시에 바리스타가 독을 넣었다"
          style={{
            ...inputStyle,
            minHeight: 80,
            resize: 'vertical',
            lineHeight: 1.6,
            fontSize: 15,
          }}
        />
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
          진범, 피해자, 장소, 방법이 들어간 한 문장을 입력하세요.
        </p>
      </div>

      {/* 예시 */}
      <div>
        <p style={labelStyle}>예시</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EXAMPLE_SENTENCES.map(ex => (
            <button
              key={ex}
              onClick={() => onSentenceChange(ex)}
              style={{
                ...baseBtn,
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
              }}
            >
              "{ex}"
            </button>
          ))}
        </div>
      </div>

      {/* 장르 선택 */}
      <div>
        <p style={labelStyle}>장르 (선택)</p>
        <select value={genre} onChange={e => onGenreChange(e.target.value)} style={selectStyle}>
          {GENRE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 고급 설정 토글 */}
      <div>
        <button
          onClick={onToggleAdvanced}
          style={{ ...baseBtn, fontSize: 12, color: 'var(--text-secondary)' }}
        >
          {showAdvanced ? '▲' : '▼'} 고급 설정 (분위기, 시대)
        </button>
        {showAdvanced && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>분위기 (선택)</p>
              <input
                type="text"
                value={atmosphere}
                onChange={e => onAtmosphereChange(e.target.value)}
                placeholder="예: 어두운, 밝은, 긴장감 있는"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <p style={labelStyle}>시대 (선택)</p>
              <input
                type="text"
                value={era}
                onChange={e => onEraChange(e.target.value)}
                placeholder="예: 현대, 1950년대, 조선시대"
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(196,64,64,0.15)', border: '1px solid rgba(196,64,64,0.4)', borderRadius: 4, color: '#e07070', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

// ── Step 2: 선택지 화면 ───────────────────────────────────────────

function Step2({
  choices,
  selection,
  onSelectionChange,
}: {
  choices: {
    characters: { id: string; label: string; summary: string }[];
    scenes: { id: string; label: string; summary: string }[];
    puzzleStructure: { id: string; label: string; summary: string }[];
    atmosphere: { id: string; label: string; summary: string }[];
  };
  selection: ChoiceSelection;
  onSelectionChange: (patch: Record<string, string>) => void;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        각 섹션에서 원하는 변형을 선택하세요. 선택하지 않으면 기본값이 유지됩니다.
      </p>
      {(Object.entries(choices) as [string, { id: string; label: string; summary: string }[]][]).map(
        ([key, items]) => (
          <div key={key}>
            <p style={labelStyle}>{SECTION_LABELS[key] ?? key}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onSelectionChange({ [key]: item.id })}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    background: selection[key] === item.id ? 'var(--accent-dim)' : 'var(--bg-card)',
                    border: `1px solid ${selection[key] === item.id ? 'var(--accent)' : 'var(--border-color)'}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: selection[key] === item.id ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {item.summary}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ── Step 3: 진행률/완료 화면 ──────────────────────────────────────

function Step3({
  progress,
  blueprint,
  error,
}: {
  progress: { step: string; percent: number } | null;
  blueprint: unknown;
  error: string | null;
}): React.ReactElement {
  const isComplete = !!blueprint && !error;
  const pct = progress?.percent ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '20px 0' }}>
      {!isComplete && !error && (
        <>
          {/* 애니메이션 아이콘 */}
          <div style={{ fontSize: 48 }}>🕵️</div>
          <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Instrument Serif, serif' }}>
            사건을 구성하는 중...
          </h3>

          {/* 진행률 바 */}
          <div style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {progress?.step ?? '준비 중...'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                {pct}%
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'var(--accent)',
                  borderRadius: 3,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            최대 30초 정도 소요됩니다. AI가 캐릭터, 씬, 퍼즐을 자동 구성합니다.
          </p>
        </>
      )}

      {isComplete && (
        <>
          <div style={{ fontSize: 48 }}>✅</div>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', fontFamily: 'Instrument Serif, serif' }}>
            사건 생성 완료!
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
            미리보기로 내용을 확인하거나,<br />
            에디터에 바로 적용하세요.
          </p>
        </>
      )}

      {error && (
        <div style={{ padding: '14px 18px', background: 'rgba(196,64,64,0.15)', border: '1px solid rgba(196,64,64,0.4)', borderRadius: 6, color: '#e07070', fontSize: 13, width: '100%', maxWidth: 400 }}>
          <strong>생성 실패</strong><br />
          {error}
        </div>
      )}
    </div>
  );
}
