import type { Locale } from '@gi-engine/core';

export interface StoryPromptOptions {
  caseTitle: string;
  genre?: string;
  locale: Locale;
  hints?: string[];
}

/**
 * Build a Gemini prompt for generating case story content.
 * Returns a JSON schema prompt that expects a specific output format.
 */
export function buildStoryPrompt(options: StoryPromptOptions): string {
  const { caseTitle, genre = '미스터리', locale, hints = [] } = options;
  const hintText = hints.length > 0 ? `힌트: ${hints.join(', ')}` : '';
  const localeName = locale === 'ko' ? '한국어' : 'English';

  return `You are a creative writer for a detective mystery game.

Generate a case story in JSON format for a case titled "${caseTitle}".
Genre: ${genre}
Language: ${localeName}
${hintText}

Respond ONLY with valid JSON in this exact format:
{
  "description": {
    "ko": "<Korean description of the case, 2-3 sentences>",
    "en": "<English description of the case, 2-3 sentences>"
  },
  "suggestedSceneNames": [
    { "ko": "<Korean scene name>", "en": "<English scene name>" },
    { "ko": "<Korean scene name>", "en": "<English scene name>" },
    { "ko": "<Korean scene name>", "en": "<English scene name>" }
  ]
}`;
}
