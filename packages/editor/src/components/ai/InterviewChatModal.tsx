/**
 * InterviewChatModal — AI 인터뷰 채팅 UI
 * Phase 5b (FADAA-44)
 *
 * - 메시지 버블 UI (AI 질문 / 사용자 답변)
 * - 6단계 진행률 프로그레스바
 * - 자동 스크롤, 타이핑 인디케이터
 * - 단계 건너뛰기/이전 답변 수정
 * - 인터뷰 완료 시 CaseBlueprint 생성 → 프리뷰 전환
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type {
  InterviewSessionState,
  InterviewMessage,
  CaseBlueprintState,
} from '@/store/interview-slice';

// ── 인터뷰 단계 메타 (ai 패키지 타입 인라인) ──────────────────────

const STAGE_LABELS: Record<string, string> = {
  case_overview: '사건 개요',
  core_plot: '핵심 줄거리',
  characters: '등장인물',
  locations: '장소/씬',
  evidence: '증거/단서',
  puzzle_structure: '퍼즐 구성',
  generating: '사건 생성 중',
  completed: '완료',
};

const STAGE_ORDER = [
  'case_overview',
  'core_plot',
  'characters',
  'locations',
  'evidence',
  'puzzle_structure',
];

// ── AI 모듈 인라인 타입 ───────────────────────────────────────────

type AiModule = {
  InterviewEngine: new () => {
    startSession: (locale: string, targetActId?: string) => Promise<InterviewSessionState>;
    sendInitialQuestion: (session: InterviewSessionState) => Promise<{
      updatedSession: InterviewSessionState;
      aiMessage: InterviewMessage;
    }>;
    processUserMessage: (
      session: InterviewSessionState,
      userInput: string,
    ) => Promise<{
      updatedSession: InterviewSessionState;
      aiMessage: InterviewMessage;
      stageAdvanced: boolean;
      isCompleted: boolean;
    }>;
    advanceStage: (session: InterviewSessionState) => Promise<InterviewSessionState>;
    generateBlueprint: (session: InterviewSessionState) => Promise<CaseBlueprintState>;
  };
};

// ── 스타일 유틸 ───────────────────────────────────────────────────

const baseBtn: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 500,
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--text-primary)',
  transition: 'background 0.15s',
};

const accentBtn: React.CSSProperties = {
  ...baseBtn,
  background: 'var(--accent)',
  color: '#000',
  border: 'none',
  fontWeight: 600,
};

// ── 컴포넌트 ─────────────────────────────────────────────────────

export function InterviewChatModal(): React.ReactElement | null {
  const {
    interview,
    closeInterview,
    setInterviewSession,
    setInterviewLoading,
    setInterviewError,
    setBlueprint,
    openBlueprintPreview,
  } = useEditorStore();

  const { open, session, isLoading, error, targetActId } = interview;

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const engineRef = useRef<InstanceType<AiModule['InterviewEngine']> | null>(null);

  // 모달이 열릴 때 엔진 로드 + 세션 시작
  useEffect(() => {
    if (!open) return;
    void initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, isTyping]);

  const initSession = async () => {
    setInterviewLoading(true);
    setInterviewError(null);
    try {
      const ai = await import('@gi-engine/ai') as unknown as AiModule;
      engineRef.current = new ai.InterviewEngine();
      const newSession = await engineRef.current.startSession('ko', targetActId ?? undefined);
      const { updatedSession } = await engineRef.current.sendInitialQuestion(newSession);
      setInterviewSession(updatedSession as unknown as InterviewSessionState);
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : '초기화 오류');
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !session || isLoading || isTyping) return;
    setInput('');
    setIsTyping(true);
    setInterviewError(null);
    try {
      if (!engineRef.current) {
        const ai = await import('@gi-engine/ai') as unknown as AiModule;
        engineRef.current = new ai.InterviewEngine();
      }
      const result = await engineRef.current.processUserMessage(
        session as unknown as Parameters<typeof engineRef.current.processUserMessage>[0],
        text,
      );
      setInterviewSession(result.updatedSession as unknown as InterviewSessionState);
      if (result.isCompleted) {
        await handleGenerateBlueprint(result.updatedSession as unknown as InterviewSessionState);
      }
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setIsTyping(false);
    }
  }, [input, session, isLoading, isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSkipStage = async () => {
    if (!session || isLoading || isTyping) return;
    setIsTyping(true);
    try {
      if (!engineRef.current) {
        const ai = await import('@gi-engine/ai') as unknown as AiModule;
        engineRef.current = new ai.InterviewEngine();
      }
      const advanced = await engineRef.current.advanceStage(
        session as unknown as Parameters<typeof engineRef.current.advanceStage>[0],
      );
      const updated = advanced as unknown as InterviewSessionState;
      setInterviewSession(updated);
      if (updated.status === 'generating') {
        await handleGenerateBlueprint(updated);
      }
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : '단계 전환 오류');
    } finally {
      setIsTyping(false);
    }
  };

  const handleGenerateBlueprint = async (sess: InterviewSessionState) => {
    setInterviewLoading(true);
    setInterviewError(null);
    try {
      if (!engineRef.current) {
        const ai = await import('@gi-engine/ai') as unknown as AiModule;
        engineRef.current = new ai.InterviewEngine();
      }
      const blueprint = await engineRef.current.generateBlueprint(
        sess as unknown as Parameters<typeof engineRef.current.generateBlueprint>[0],
      );
      setBlueprint(blueprint as unknown as CaseBlueprintState);
      openBlueprintPreview();
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : '블루프린트 생성 오류');
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleEditMessage = (msg: InterviewMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  };

  const handleConfirmEdit = async () => {
    if (!session || !editingMsgId) return;
    // Find the message index and truncate the conversation to that point, then re-send
    const msgIndex = session.messages.findIndex((m) => m.id === editingMsgId);
    if (msgIndex === -1) return;
    const truncated: InterviewSessionState = {
      ...session,
      messages: session.messages.slice(0, msgIndex),
    };
    setInterviewSession(truncated);
    setEditingMsgId(null);
    setInput(editingContent);
    setEditingContent('');
    // Focus input so user can confirm
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCancelEdit = () => {
    setEditingMsgId(null);
    setEditingContent('');
  };

  if (!open) return null;

  const currentStageIdx = STAGE_ORDER.indexOf(session?.currentStage ?? '');
  const completedCount = session?.completedStages.length ?? 0;
  const progressPct = (completedCount / STAGE_ORDER.length) * 100;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={isLoading || isTyping ? undefined : closeInterview}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          maxWidth: '95vw',
          height: '80vh',
          maxHeight: 700,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          zIndex: 1001,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
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
              🕵️ AI 인터뷰 — 새 사건 생성
            </div>
            {session && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                현재 단계: {STAGE_LABELS[session.currentStage] ?? session.currentStage}
              </div>
            )}
          </div>
          <button
            onClick={isLoading || isTyping ? undefined : closeInterview}
            disabled={isLoading || isTyping}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isLoading || isTyping ? 'not-allowed' : 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 5,
              gap: 4,
            }}
          >
            {STAGE_ORDER.map((stage, i) => {
              const isDone = (session?.completedStages ?? []).includes(stage);
              const isCurrent = session?.currentStage === stage;
              return (
                <div
                  key={stage}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 9,
                    color: isDone
                      ? 'var(--accent)'
                      : isCurrent
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                    fontWeight: isCurrent ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {i + 1}. {STAGE_LABELS[stage]}
                </div>
              );
            })}
          </div>
          <div
            style={{
              height: 4,
              background: 'var(--bg-card)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {isLoading && !session && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>
              인터뷰를 시작하는 중...
            </div>
          )}

          {session?.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isEditing={editingMsgId === msg.id}
              editingContent={editingContent}
              onEditStart={handleEditMessage}
              onEditChange={setEditingContent}
              onEditConfirm={handleConfirmEdit}
              onEditCancel={handleCancelEdit}
            />
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-card)',
                  borderRadius: '4px 12px 12px 4px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'inline-block',
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              margin: '0 16px 8px',
              padding: '7px 10px',
              background: 'rgba(196,64,64,0.12)',
              border: '1px solid rgba(196,64,64,0.3)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--danger)',
              flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        {/* Input Area */}
        <div
          style={{
            padding: '10px 16px 12px',
            borderTop: '1px solid var(--border-color)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {session && currentStageIdx >= 0 && !isLoading && !isTyping && (
              <button
                onClick={handleSkipStage}
                style={{
                  ...baseBtn,
                  fontSize: 11,
                  padding: '4px 10px',
                  color: 'var(--text-muted)',
                }}
                title="현재 단계를 건너뛰고 다음 단계로 진행"
              >
                ▶ 단계 건너뛰기
              </button>
            )}
            {session?.status === 'generating' || (session?.completedStages.length === STAGE_ORDER.length) ? (
              <button
                onClick={() => session && void handleGenerateBlueprint(session)}
                disabled={isLoading}
                style={{
                  ...accentBtn,
                  fontSize: 11,
                  padding: '4px 12px',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? '생성 중...' : '사건 블루프린트 생성'}
              </button>
            ) : null}
          </div>

          {/* Text input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isTyping ? 'AI가 답변 중...' : '답변을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)'}
              disabled={isLoading || isTyping || !session}
              rows={2}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: 13,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                outline: 'none',
                resize: 'none',
                lineHeight: 1.5,
                opacity: isLoading || isTyping || !session ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading || isTyping || !session}
              style={{
                ...accentBtn,
                padding: '10px 16px',
                fontSize: 13,
                opacity: !input.trim() || isLoading || isTyping || !session ? 0.5 : 1,
                cursor: !input.trim() || isLoading || isTyping || !session ? 'not-allowed' : 'pointer',
              }}
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* Bounce animation */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: InterviewMessage;
  isEditing: boolean;
  editingContent: string;
  onEditStart: (msg: InterviewMessage) => void;
  onEditChange: (content: string) => void;
  onEditConfirm: () => void;
  onEditCancel: () => void;
}

function MessageBubble({
  msg,
  isEditing,
  editingContent,
  onEditStart,
  onEditChange,
  onEditConfirm,
  onEditCancel,
}: MessageBubbleProps): React.ReactElement {
  const isAi = msg.role === 'ai';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isAi ? 'row' : 'row-reverse',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isAi ? 'var(--accent-dim)' : 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {isAi ? '🕵️' : '✍️'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Stage badge */}
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            textAlign: isAi ? 'left' : 'right',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {STAGE_LABELS[msg.stage] ?? msg.stage}
        </div>

        {/* Content */}
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              value={editingContent}
              onChange={(e) => onEditChange(e.target.value)}
              autoFocus
              rows={3}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={onEditCancel}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={onEditConfirm}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                수정 후 재전송
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !isAi && onEditStart(msg)}
            style={{
              padding: '9px 12px',
              background: isAi ? 'var(--bg-card)' : 'var(--accent-dim)',
              border: `1px solid ${isAi ? 'var(--border-color)' : 'rgba(212,150,58,0.3)'}`,
              borderRadius: isAi ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: !isAi ? 'pointer' : 'default',
            }}
            title={!isAi ? '클릭하여 수정' : undefined}
          >
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}
