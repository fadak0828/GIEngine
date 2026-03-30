import type { StoryGenerateRequest, StoryGenerateResult } from '../types.js';
import { geminiClient } from '../client.js';
import { buildStoryPrompt } from '../prompts/story-prompts.js';

/**
 * Generate case story content (description + suggested scene names) using
 * Gemini 2.0 Flash with JSON mode.
 */
export async function generateStory(
  request: StoryGenerateRequest,
): Promise<StoryGenerateResult> {
  const prompt = buildStoryPrompt({
    caseTitle: request.caseTitle,
    genre: request.genre,
    locale: request.locale,
    hints: request.hints,
  });

  const raw = await geminiClient.generateText(prompt, 'gemini-2.0-flash');

  // Strip markdown code fences if present
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: StoryGenerateResult;
  try {
    parsed = JSON.parse(jsonText) as StoryGenerateResult;
  } catch {
    throw new Error(`스토리 생성 응답을 파싱할 수 없습니다: ${jsonText.slice(0, 200)}`);
  }

  if (!parsed.description || !Array.isArray(parsed.suggestedSceneNames)) {
    throw new Error('스토리 생성 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}
