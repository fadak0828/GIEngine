/**
 * InterviewEngine — AI 인터뷰 기반 사건 생성 엔진 핵심 클래스
 */

import type { Locale } from '@gi-engine/core';
import { geminiClient } from '../client.js';
import type {
  InterviewSession,
  InterviewMessage,
  CollectedCaseInfo,
  CaseBlueprint,
  ProcessMessageResult,
} from './types.js';
import { InterviewStage, INTERVIEW_STAGE_ORDER } from './types.js';
import {
  buildStageQuestionPrompt,
  buildInfoExtractionPrompt,
} from './prompts/stage-question-prompts.js';
import { buildBlueprintGenerationPrompt } from './prompts/blueprint-generation-prompts.js';
import {
  createSufficiencyScoreFromAI,
  mergeCollectedInfo,
} from './sufficiency-evaluator.js';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function stripCodeFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getNextStage(current: InterviewStage): InterviewStage {
  const idx = INTERVIEW_STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= INTERVIEW_STAGE_ORDER.length - 1) {
    return InterviewStage.GENERATING;
  }
  return INTERVIEW_STAGE_ORDER[idx + 1];
}

function getExchangeCountForStage(session: InterviewSession, stage: InterviewStage): number {
  return session.messages.filter((m) => m.stage === stage && m.role === 'user').length;
}

// ─── 파싱 헬퍼 ───────────────────────────────────────────────────────────────

function parseAiQuestionResponse(raw: string): { aiResponse: string; questionType: string } {
  const jsonText = stripCodeFence(raw);
  try {
    return JSON.parse(jsonText) as { aiResponse: string; questionType: string };
  } catch {
    return { aiResponse: raw.trim(), questionType: 'initial' };
  }
}

function parseExtractionResponse(raw: string): {
  aiResponse: string;
  extractedInfo: Partial<CollectedCaseInfo>;
  sufficiencyScore: number;
  isStageComplete: boolean;
} {
  const jsonText = stripCodeFence(raw);
  try {
    const parsed = JSON.parse(jsonText) as {
      aiResponse: string;
      extractedInfo: Partial<CollectedCaseInfo>;
      sufficiencyScore: number;
      isStageComplete: boolean;
    };
    return {
      aiResponse: parsed.aiResponse ?? '',
      extractedInfo: parsed.extractedInfo ?? {},
      sufficiencyScore: typeof parsed.sufficiencyScore === 'number' ? parsed.sufficiencyScore : 0,
      isStageComplete: parsed.isStageComplete ?? false,
    };
  } catch {
    return {
      aiResponse: raw.trim(),
      extractedInfo: {},
      sufficiencyScore: 0,
      isStageComplete: false,
    };
  }
}

// ─── InterviewEngine ─────────────────────────────────────────────────────────

export class InterviewEngine {
  /**
   * 새 인터뷰 세션을 시작합니다.
   */
  async startSession(locale: Locale, targetActId?: string): Promise<InterviewSession> {
    const now = Date.now();
    return {
      id: generateId(),
      status: 'active',
      currentStage: InterviewStage.CASE_OVERVIEW,
      completedStages: [],
      messages: [],
      collectedInfo: {},
      sufficiencyScores: {},
      followUpCounts: {},
      locale,
      createdAt: now,
      updatedAt: now,
      targetActId,
    };
  }

  /**
   * 현재 단계의 초기 AI 질문을 생성하고 세션에 추가합니다.
   */
  async sendInitialQuestion(session: InterviewSession): Promise<{
    updatedSession: InterviewSession;
    aiMessage: InterviewMessage;
  }> {
    const stage = session.currentStage;
    const prompt = buildStageQuestionPrompt(stage, session.collectedInfo, 0, session.locale);

    const raw = await geminiClient.generateText(prompt);
    const parsed = parseAiQuestionResponse(raw);

    const aiMessage: InterviewMessage = {
      id: generateId(),
      role: 'ai',
      content: parsed.aiResponse,
      timestamp: Date.now(),
      stage,
      metadata: { questionType: 'initial' },
    };

    const updatedSession: InterviewSession = {
      ...session,
      messages: [...session.messages, aiMessage],
      updatedAt: Date.now(),
    };

    return { updatedSession, aiMessage };
  }

  /**
   * 사용자 메시지를 처리합니다.
   * 2-in-1 API 호출: 응답 생성 + 정보 추출 + 충분성 판단을 단일 호출로 처리.
   */
  async processUserMessage(
    session: InterviewSession,
    userInput: string,
  ): Promise<ProcessMessageResult> {
    const stage = session.currentStage;
    const exchangeCount = getExchangeCountForStage(session, stage);
    const followUpCount = session.followUpCounts[stage] ?? 0;

    // 사용자 메시지
    const userMessage: InterviewMessage = {
      id: generateId(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
      stage,
    };

    // 2-in-1 AI 호출
    const prompt = buildInfoExtractionPrompt(stage, userInput, session.collectedInfo);
    const raw = await geminiClient.generateText(prompt);
    const result = parseExtractionResponse(raw);

    // 수집 정보 병합
    const updatedInfo = mergeCollectedInfo(session.collectedInfo, result.extractedInfo);

    // 충분성 점수 평가
    const suffScore = createSufficiencyScoreFromAI(
      stage,
      result.sufficiencyScore,
      exchangeCount + 1,
    );

    const updatedScores = {
      ...session.sufficiencyScores,
      [stage]: result.sufficiencyScore,
    };

    // AI 응답 메시지
    const questionType =
      suffScore.isComplete
        ? 'sufficiency_check'
        : followUpCount > 0
          ? 'follow_up'
          : 'initial';

    const aiMessage: InterviewMessage = {
      id: generateId(),
      role: 'ai',
      content: result.aiResponse,
      timestamp: Date.now(),
      stage,
      metadata: {
        questionType,
        extractedData: result.extractedInfo,
      },
    };

    let updatedSession: InterviewSession = {
      ...session,
      messages: [...session.messages, userMessage, aiMessage],
      collectedInfo: updatedInfo,
      sufficiencyScores: updatedScores,
      updatedAt: Date.now(),
    };

    let stageAdvanced = false;
    let isCompleted = false;

    if (suffScore.isComplete) {
      const nextStage = getNextStage(stage);
      const completedStages = [...updatedSession.completedStages, stage];

      if (nextStage === InterviewStage.GENERATING) {
        updatedSession = {
          ...updatedSession,
          currentStage: InterviewStage.GENERATING,
          completedStages,
          status: 'generating',
        };
        stageAdvanced = true;
        isCompleted = true;
      } else {
        // 다음 단계 전환 + 초기 질문 생성
        const nextSessionBase: InterviewSession = {
          ...updatedSession,
          currentStage: nextStage,
          completedStages,
          followUpCounts: { ...updatedSession.followUpCounts, [nextStage]: 0 },
        };

        const nextPrompt = buildStageQuestionPrompt(
          nextStage,
          nextSessionBase.collectedInfo,
          0,
          nextSessionBase.locale,
        );
        const nextRaw = await geminiClient.generateText(nextPrompt);
        const nextParsed = parseAiQuestionResponse(nextRaw);

        const nextAiMsg: InterviewMessage = {
          id: generateId(),
          role: 'ai',
          content: nextParsed.aiResponse,
          timestamp: Date.now(),
          stage: nextStage,
          metadata: { questionType: 'initial' },
        };

        updatedSession = {
          ...nextSessionBase,
          messages: [...nextSessionBase.messages, nextAiMsg],
          updatedAt: Date.now(),
        };
        stageAdvanced = true;
      }
    } else {
      updatedSession = {
        ...updatedSession,
        followUpCounts: {
          ...updatedSession.followUpCounts,
          [stage]: followUpCount + 1,
        },
      };
    }

    return { updatedSession, aiMessage, stageAdvanced, isCompleted };
  }

  /**
   * 수동으로 다음 단계로 강제 전환합니다.
   */
  async advanceStage(session: InterviewSession): Promise<InterviewSession> {
    const current = session.currentStage;
    const nextStage = getNextStage(current);
    const completedStages = [...session.completedStages];
    if (!completedStages.includes(current)) {
      completedStages.push(current);
    }

    if (nextStage === InterviewStage.GENERATING) {
      return {
        ...session,
        currentStage: InterviewStage.GENERATING,
        completedStages,
        status: 'generating',
        updatedAt: Date.now(),
      };
    }

    return {
      ...session,
      currentStage: nextStage,
      completedStages,
      followUpCounts: { ...session.followUpCounts, [nextStage]: 0 },
      updatedAt: Date.now(),
    };
  }

  /**
   * 수집된 정보를 바탕으로 CaseBlueprint를 생성합니다.
   * gemini-2.5-pro 모델 사용 (복잡한 구조, 정확도 중요).
   */
  async generateBlueprint(session: InterviewSession): Promise<CaseBlueprint> {
    const prompt = buildBlueprintGenerationPrompt(
      session.collectedInfo,
      session.id,
      session.locale,
    );

    const raw = await geminiClient.generateText(prompt, 'gemini-2.5-pro');
    const jsonText = stripCodeFence(raw);

    let parsed: Partial<CaseBlueprint>;
    try {
      parsed = JSON.parse(jsonText) as Partial<CaseBlueprint>;
    } catch {
      throw new Error(`CaseBlueprint 파싱 실패: ${jsonText.slice(0, 300)}`);
    }

    if (!parsed.scenes?.length || !parsed.words?.length) {
      throw new Error('CaseBlueprint 형식 오류: scenes 또는 words가 누락되었습니다.');
    }

    return {
      id: generateId(),
      sessionId: session.id,
      generatedAt: Date.now(),
      title: parsed.title ?? { ko: '제목 없음', en: 'Untitled' },
      description: parsed.description ?? { ko: '', en: '' },
      genre: parsed.genre ?? 'mystery',
      characters: parsed.characters ?? [],
      scenes: parsed.scenes,
      words: parsed.words,
      mainPuzzle: parsed.mainPuzzle ?? {
        titleHint: '',
        descriptionHint: '',
        templateDescription: '',
        requiredWordTempIds: [],
      },
      subPuzzles: parsed.subPuzzles ?? [],
    };
  }
}

/** 싱글톤 인스턴스 */
export const interviewEngine = new InterviewEngine();
