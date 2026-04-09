/**
 * regenerator.ts — 부분 재생성 시스템
 *
 * 사용자가 특정 씬/단어/퍼즐/캐릭터만 다시 생성할 수 있도록 지원.
 * Quick-Create 워크플로우에서 "이 씬 다시 생성" 기능을 구현하기 위한 핵심 모듈.
 */

import type { Locale } from '@gi-engine/core';
import type { CaseBlueprint, BlueprintHotspotHint } from '../interview/types.js';
import { getProvider } from '../providers/factory.js';
import {
  buildRegenerateScenePrompt,
  buildRegenerateWordPrompt,
  buildRegeneratePuzzlePrompt,
} from './prompts/regenerate-prompt.js';

const MAX_RETRIES = 2;

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── 파싱 헬퍼 ────────────────────────────────────────────────────────

function stripCodeFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

// ── 재생성 결과 타입 ─────────────────────────────────────────────────

export interface RegenerationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
}

async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
): Promise<{ data?: T; error?: string; attempts: number }> {
  let lastError: string = '';
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return { data, attempts: attempt };
    } catch (err) {
      lastError = String(err);
    }
  }
  return { error: lastError, attempts: maxRetries };
}

// ── Scene 재생성 ────────────────────────────────────────────────────

interface RegenerateSceneResult {
  tempId: string;
  name: { ko: string; en: string };
  description: string;
  connections: string[];
  hotspotHints: Array<{
    label: string;
    actionType: string;
    contentHint: string;
    positionHint?: { x: number; y: number; description: string };
    relatedWordId?: string;
  }>;
}

function parseRegenerateScene(raw: string): RegenerateSceneResult {
  const jsonText = stripCodeFence(raw);
  const parsed = JSON.parse(jsonText) as RegenerateSceneResult;

  if (!parsed.tempId || !parsed.name || !parsed.description || !Array.isArray(parsed.connections)) {
    throw new Error('씬 재생성 응답 형식 오류');
  }
  return parsed;
}

/**
 * 특정 씬(tempId)만 재생성합니다.
 * 다른 씬, 캐릭터, 단어는 변경되지 않습니다.
 *
 * @param blueprint 원본 블루프린트
 * @param sceneTempId 재생성할 씬의 tempId
 * @param locale 언어
 * @param reasonHint 선택적 재생성 이유 힌트
 * @returns 새로운 CaseBlueprint (해당 씬만 교체)
 */
export async function regenerateScene(
  blueprint: CaseBlueprint,
  sceneTempId: string,
  locale: Locale = 'ko',
  reasonHint?: string,
): Promise<RegenerationResult<CaseBlueprint>> {
  const { data, error, attempts } = await retry(async () => {
    const prompt = buildRegenerateScenePrompt({ originalBlueprint: blueprint, sceneTempId, locale, reasonHint });
    const raw = await getProvider().generateText(prompt, 'gemini-2.5-pro');
    return parseRegenerateScene(raw);
  }, MAX_RETRIES);

  if (!data || error) {
    return { success: false, error: error ?? '알 수 없는 오류', attempts };
  }

  // 원본 블루프린트의 해당 씬만 교체
  const newScenes = blueprint.scenes.map(s =>
    s.tempId === sceneTempId
      ? {
          ...s,
          name: data.name,
          description: data.description,
          connections: data.connections,
          hotspotHints: data.hotspotHints.map(h => ({
            label: h.label,
            actionType: h.actionType as BlueprintHotspotHint['actionType'],
            contentHint: h.contentHint,
            relatedWordId: h.relatedWordId,
          })),
        }
      : s,
  );

  return {
    success: true,
    data: {
      ...blueprint,
      id: generateId(),
      generatedAt: Date.now(),
      scenes: newScenes,
    },
    attempts,
  };
}

// ── Word 재생성 ─────────────────────────────────────────────────────

interface RegenerateWordResult {
  tempId: string;
  display: { ko: string; en: string };
  category: 'person' | 'place' | 'object' | 'action' | 'time' | 'motive' | 'evidence';
  hint: { ko: string; en: string };
  sourceSceneTempId: string;
}

function parseRegenerateWord(raw: string): RegenerateWordResult {
  const jsonText = stripCodeFence(raw);
  const parsed = JSON.parse(jsonText) as RegenerateWordResult;

  if (!parsed.tempId || !parsed.display || !parsed.category) {
    throw new Error('단서 재생성 응답 형식 오류');
  }
  return parsed;
}

/**
 * 특정 단서(word)만 재생성합니다.
 */
export async function regenerateWord(
  blueprint: CaseBlueprint,
  wordTempId: string,
  locale: Locale = 'ko',
  reasonHint?: string,
): Promise<RegenerationResult<CaseBlueprint>> {
  const { data, error, attempts } = await retry(async () => {
    const prompt = buildRegenerateWordPrompt({ originalBlueprint: blueprint, wordTempId, locale, reasonHint });
    const raw = await getProvider().generateText(prompt, 'gemini-2.5-pro');
    return parseRegenerateWord(raw);
  }, MAX_RETRIES);

  if (!data || error) {
    return { success: false, error: error ?? '알 수 없는 오류', attempts };
  }

  // 원본 블루프린트의 해당 단서만 교체
  const newWords = blueprint.words.map(w =>
    w.tempId === wordTempId
      ? {
          ...w,
          display: data.display,
          category: data.category,
          hint: data.hint ?? w.hint,
          sourceSceneTempId: data.sourceSceneTempId,
        }
      : w,
  );

  // mainPuzzle의 requiredWordTempIds 업데이트 (tempId 자체는 유지, display/hint만 변경)
  return {
    success: true,
    data: {
      ...blueprint,
      id: generateId(),
      generatedAt: Date.now(),
      words: newWords,
    },
    attempts,
  };
}

// ── Puzzle 재생성 ───────────────────────────────────────────────────

interface RegeneratePuzzleResult {
  titleHint: { ko: string; en: string };
  descriptionHint: { ko: string; en: string };
  templateDescription: { ko: string; en: string } | string;
  requiredWordTempIds: string[];
}

function parseRegeneratePuzzle(raw: string): RegeneratePuzzleResult {
  const jsonText = stripCodeFence(raw);
  const parsed = JSON.parse(jsonText) as RegeneratePuzzleResult;

  if (!parsed.requiredWordTempIds || !Array.isArray(parsed.requiredWordTempIds)) {
    throw new Error('퍼즐 재생성 응답 형식 오류');
  }

  // 템플릿 설명이 문자열이면 ko/en 래핑
  if (typeof parsed.templateDescription === 'string') {
    parsed.templateDescription = {
      ko: parsed.templateDescription,
      en: parsed.templateDescription,
    };
  }

  return parsed;
}

/**
 * 메인 퍼즐(mainPuzzle)만 재생성합니다.
 */
export async function regeneratePuzzle(
  blueprint: CaseBlueprint,
  locale: Locale = 'ko',
  reasonHint?: string,
): Promise<RegenerationResult<CaseBlueprint>> {
  const { data, error, attempts } = await retry(async () => {
    const prompt = buildRegeneratePuzzlePrompt({ originalBlueprint: blueprint, locale, reasonHint });
    const raw = await getProvider().generateText(prompt, 'gemini-2.5-pro');
    return parseRegeneratePuzzle(raw);
  }, MAX_RETRIES);

  if (!data || error) {
    return { success: false, error: error ?? '알 수 없는 오류', attempts };
  }

  return {
    success: true,
    data: {
      ...blueprint,
      id: generateId(),
      generatedAt: Date.now(),
      mainPuzzle: {
        ...blueprint.mainPuzzle,
        titleHint: data.titleHint.ko,
        descriptionHint: data.descriptionHint.ko,
        templateDescription: typeof data.templateDescription === 'string'
          ? data.templateDescription
          : (data.templateDescription.ko ?? data.templateDescription.en ?? ''),
        requiredWordTempIds: data.requiredWordTempIds,
      },
    },
    attempts,
  };
}

// ── 전체 블루프린트 재생성 ───────────────────────────────────────────

/**
 * 전체 블루프린트를 재생성합니다. (원본 시드를 유지)
 * 주로 사용자가 품질 점수가 너무 낮을 때 사용.
 */
export async function regenerateFullBlueprint(
  originalSentence: string,
  blueprint: CaseBlueprint,
  locale: Locale = 'ko',
  onRetry?: (attempt: number, reason: string) => Promise<boolean>,
): Promise<RegenerationResult<CaseBlueprint>> {
  // QuickCreateEngine의 startFromSentence 재사용
  const { quickCreateEngine } = await import('../quick-create/quick-create-engine.js');

  const { blueprint: newBlueprint, attempts } = await (async () => {
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const reason = attempt > 1 ? 'Quality below 80%, regenerating...' : undefined;
        if (reason && onRetry) {
          const shouldContinue = await onRetry(attempt, reason);
          if (!shouldContinue) {
            return { blueprint: blueprint, attempts: attempt - 1 };
          }
        }
        const result = await quickCreateEngine.startFromSentence(originalSentence, { locale });
        return { blueprint: result.blueprint, attempts: attempt };
      } catch (err) {
        lastError = String(err);
      }
    }
    return { blueprint: undefined, attempts: MAX_RETRIES, error: lastError };
  })();

  if (!newBlueprint) {
    return { success: false, error: '전체 재생성 실패', attempts };
  }

  return { success: true, data: newBlueprint, attempts };
}
