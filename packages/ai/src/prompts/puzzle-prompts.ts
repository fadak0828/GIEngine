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

  return `You are a creative game designer crafting a mystery deduction fill-in-the-blank puzzle.

## Case Information
- Case Title: "${caseTitle}"
- Story: ${caseDescription}
- Available Clue Words: ${wordBank.join(', ')}
- Language: ${localeName}

## Design Requirements

**Puzzle Variety (퍼즐 다양성)**
- Create a NARATIVE CONCLUSION statement as the puzzle template
- The conclusion should tell the FULL STORY of the crime (culprit + method + motive + location)
- Use 3-5 blank slots — enough to be challenging but not overwhelming
- Examples of good templates:
  - Korean: "[빈칸1](이)가 [빈칸2]에서 [빈칸3]을(를) 사용하여 [빈칸4]을(를) [빈칸5]했다"
  - English: "The culprit [blank1] used [blank2] to [blank3] at [blank4] targeting [blank5]"

**Clue Clarity (단서 명확성)**
- Only use words from the provided word bank
- The narrative should be LOGICALLY DEDUCIBLE from clues found in the game
- Each blank should be fillable by careful investigation
- Add DECOY COMBINATIONS (red herring answers) that seem plausible but are incorrect

**Puzzle Title**
- Make it THEMATIC and memorable, not generic
- Korean example: "진범을 밝혀라: 달빛下的음모"
- English example: "Unmask the Culprit: Conspiracy Under Moonlight"

## Output Format

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
    "slot_1": { "correctWordId": "<exact word from wordBank>" },
    "slot_2": { "correctWordId": "<exact word from wordBank>" }
  }
}

IMPORTANT: The correctWordId MUST exactly match one of the words in the wordBank. JSON only, no markdown fences.`;
}
