/**
 * InterviewChatModal - AI interview chat UI
 * Phase 5b (FADAA-113)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type {
  InterviewSessionState,
  InterviewMessage,
  CaseBlueprintState,
} from '@/store/interview-slice';
import styles from './InterviewChatModal.module.css';

const STAGE_LABELS: Record<string, string> = {
  case_overview: 'Case Overview',
  core_plot: 'Core Plot',
  characters: 'Characters',
  locations: 'Locations',
  evidence: 'Evidence',
  puzzle_structure: 'Puzzle Structure',
  generating: 'Generating',
  completed: 'Completed',
};

const STAGE_ORDER = [
  'case_overview',
  'core_plot',
  'characters',
  'locations',
  'evidence',
  'puzzle_structure',
];

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

const cx = (...tokens: Array<string | false | null | undefined>): string =>
  tokens.filter((token): token is string => Boolean(token)).join(' ');

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

  useEffect(() => {
    if (!open) return;
    void initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages?.length, isTyping]);

  const initSession = async () => {
    setInterviewLoading(true);
    setInterviewError(null);

    try {
      const ai = (await import('@gi-engine/ai')) as unknown as AiModule;
      engineRef.current = new ai.InterviewEngine();

      const newSession = await engineRef.current.startSession('ko', targetActId ?? undefined);
      const { updatedSession } = await engineRef.current.sendInitialQuestion(newSession);
      setInterviewSession(updatedSession as unknown as InterviewSessionState);
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : 'Failed to initialize interview session.');
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleGenerateBlueprint = useCallback(
    async (sess: InterviewSessionState) => {
      setInterviewLoading(true);
      setInterviewError(null);

      try {
        if (!engineRef.current) {
          const ai = (await import('@gi-engine/ai')) as unknown as AiModule;
          engineRef.current = new ai.InterviewEngine();
        }

        const blueprint = await engineRef.current.generateBlueprint(
          sess as unknown as Parameters<typeof engineRef.current.generateBlueprint>[0],
        );

        setBlueprint(blueprint as unknown as CaseBlueprintState);
        openBlueprintPreview();
      } catch (e) {
        setInterviewError(e instanceof Error ? e.message : 'Failed to generate blueprint.');
      } finally {
        setInterviewLoading(false);
      }
    },
    [openBlueprintPreview, setBlueprint, setInterviewError, setInterviewLoading],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !session || isLoading || isTyping) return;

    setInput('');
    setIsTyping(true);
    setInterviewError(null);

    try {
      if (!engineRef.current) {
        const ai = (await import('@gi-engine/ai')) as unknown as AiModule;
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
      setInterviewError(e instanceof Error ? e.message : 'Failed to process your message.');
    } finally {
      setIsTyping(false);
    }
  }, [handleGenerateBlueprint, input, isLoading, isTyping, session, setInterviewError, setInterviewSession]);

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
        const ai = (await import('@gi-engine/ai')) as unknown as AiModule;
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
      setInterviewError(e instanceof Error ? e.message : 'Failed to skip current stage.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleEditMessage = (msg: InterviewMessage) => {
    setEditingMsgId(msg.id);
    setEditingContent(msg.content);
  };

  const handleConfirmEdit = () => {
    if (!session || !editingMsgId) return;

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
  const canSkipStage = Boolean(session && currentStageIdx >= 0 && !isLoading && !isTyping);
  const canGenerate =
    session?.status === 'generating' ||
    (session?.completedStages.length ?? 0) === STAGE_ORDER.length;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={isLoading || isTyping ? undefined : closeInterview}
      />

      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerBody}>
            <div className={styles.title}>AI Interview Builder</div>
            {session && (
              <div className={styles.subtitle}>
                Current stage: {STAGE_LABELS[session.currentStage] ?? session.currentStage}
              </div>
            )}
          </div>

          <button
            onClick={isLoading || isTyping ? undefined : closeInterview}
            disabled={isLoading || isTyping}
            aria-label="대화 닫기"
            className={cx(styles.closeButton, (isLoading || isTyping) && styles.closeButtonDisabled)}
          >
            X
          </button>
        </div>

        <div className={styles.progressSection}>
          <div className={styles.stageRow}>
            {STAGE_ORDER.map((stage, i) => {
              const isDone = (session?.completedStages ?? []).includes(stage);
              const isCurrent = session?.currentStage === stage;

              return (
                <div
                  key={stage}
                  className={cx(styles.stageLabel, isDone && styles.stageDone, isCurrent && styles.stageCurrent)}
                >
                  {i + 1}. {STAGE_LABELS[stage]}
                </div>
              );
            })}
          </div>

          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.messages}>
          {isLoading && !session && (
            <div className={styles.loadingState}>Preparing interview session...</div>
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

          {isTyping && (
            <div className={styles.typingWrap}>
              <div className={styles.typingBubble}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.inputArea}>
          <div className={styles.actionRow}>
            {canSkipStage && (
              <button
                onClick={handleSkipStage}
                className={cx(styles.ghostButton, styles.smallButton)}
                title="Skip the current interview stage"
              >
                Skip stage
              </button>
            )}

            {canGenerate && (
              <button
                onClick={() => session && void handleGenerateBlueprint(session)}
                disabled={isLoading}
                className={cx(styles.accentButton, styles.smallButton, isLoading && styles.buttonDisabled)}
              >
                {isLoading ? 'Generating...' : 'Generate Blueprint'}
              </button>
            )}
          </div>

          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isTyping
                  ? 'AI is typing...'
                  : 'Type your answer... (Enter to send, Shift+Enter for newline)'
              }
              disabled={isLoading || isTyping || !session}
              rows={2}
              className={cx(styles.textInput, (isLoading || isTyping || !session) && styles.inputDisabled)}
            />

            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isLoading || isTyping || !session}
              className={cx(
                styles.accentButton,
                styles.sendButton,
                (!input.trim() || isLoading || isTyping || !session) && styles.buttonDisabled,
              )}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

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
    <div className={cx(styles.bubbleRow, !isAi && styles.bubbleRowUser)}>
      <div className={cx(styles.avatar, !isAi && styles.avatarUser)}>{isAi ? 'AI' : 'ME'}</div>

      <div className={styles.bubbleColumn}>
        <div className={cx(styles.stageBadge, !isAi && styles.stageBadgeUser)}>
          {STAGE_LABELS[msg.stage] ?? msg.stage}
        </div>

        {isEditing ? (
          <div className={styles.editWrap}>
            <textarea
              value={editingContent}
              onChange={(e) => onEditChange(e.target.value)}
              autoFocus
              rows={3}
              className={styles.editTextarea}
            />

            <div className={styles.editActions}>
              <button onClick={onEditCancel} className={styles.editCancelButton}>
                Cancel
              </button>
              <button onClick={onEditConfirm} className={styles.editConfirmButton}>
                Apply Edit
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => !isAi && onEditStart(msg)}
            disabled={isAi}
            className={cx(styles.messageBody, !isAi && styles.messageBodyUser, !isAi && styles.messageBodyEditable)}
            title={!isAi ? '메시지 편집' : undefined}
            aria-label={!isAi ? '메시지 편집' : undefined}
          >
            {msg.content}
          </button>
        )}
      </div>
    </div>
  );
}