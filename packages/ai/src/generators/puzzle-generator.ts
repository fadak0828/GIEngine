import type { PuzzleGenerateRequest, PuzzleGenerateResult } from '../types.js';
import { getProvider } from '../providers/factory.js';
import { buildPuzzlePrompt } from '../prompts/puzzle-prompts.js';

/**
 * Generate a fill-in-the-blank puzzle using the user-selected text model.
 */
export async function generatePuzzle(
  request: PuzzleGenerateRequest,
): Promise<PuzzleGenerateResult> {
  const prompt = buildPuzzlePrompt({
    caseTitle: request.caseTitle,
    caseDescription: request.caseDescription,
    wordBank: request.wordBank,
    locale: request.locale,
  });

  const raw = await getProvider().generateText(prompt);

  // Strip markdown code fences if present
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: PuzzleGenerateResult;
  try {
    parsed = JSON.parse(jsonText) as PuzzleGenerateResult;
  } catch {
    throw new Error(`퍼즐 생성 응답을 파싱할 수 없습니다: ${jsonText.slice(0, 200)}`);
  }

  if (!parsed.title || !parsed.template?.segments || !parsed.answers) {
    throw new Error('퍼즐 생성 응답 형식이 올바르지 않습니다.');
  }

  return parsed;
}
