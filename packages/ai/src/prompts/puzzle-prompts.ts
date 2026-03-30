import type { Locale } from '@gi-engine/core';

export interface PuzzlePromptOptions {
  caseTitle: string;
  caseDescription: string;
  wordBank: string[];
  locale: Locale;
}

/**
 * Build a Gemini prompt for generating a fill-in-the-blank puzzle.
 */
export function buildPuzzlePrompt(options: PuzzlePromptOptions): string {
  const { caseTitle, caseDescription, wordBank, locale } = options;
  const localeName = locale === 'ko' ? '한국어' : 'English';

  return `You are a game designer creating a fill-in-the-blank deduction puzzle.

Case: "${caseTitle}"
Description: ${caseDescription}
Available words: ${wordBank.join(', ')}
Language: ${localeName}

Create a fill-in-the-blank puzzle template. The puzzle should be a conclusion statement with 2-3 blank slots where the player fills in words from the word bank.

Respond ONLY with valid JSON in this exact format:
{
  "title": {
    "ko": "<Korean puzzle title>",
    "en": "<English puzzle title>"
  },
  "template": {
    "segments": [
      { "type": "text", "content": { "ko": "<text before first blank>", "en": "<text before first blank>" } },
      { "type": "slot", "slotId": "slot_1", "placeholder": { "ko": "??", "en": "??" } },
      { "type": "text", "content": { "ko": "<text between blanks>", "en": "<text between blanks>" } },
      { "type": "slot", "slotId": "slot_2", "placeholder": { "ko": "??", "en": "??" } },
      { "type": "text", "content": { "ko": "<text after last blank>", "en": "<text after last blank>" } }
    ]
  },
  "answers": {
    "slot_1": { "correctWordId": "<word from wordBank>" },
    "slot_2": { "correctWordId": "<word from wordBank>" }
  }
}`;
}
