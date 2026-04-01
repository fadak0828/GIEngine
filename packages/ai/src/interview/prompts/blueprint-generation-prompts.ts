/**
 * CaseBlueprint 생성 프롬프트
 */

import type { CollectedCaseInfo } from '../types.js';
import type { Locale } from '@gi-engine/core';

export function buildBlueprintGenerationPrompt(
  collectedInfo: CollectedCaseInfo,
  sessionId: string,
  locale: Locale,
): string {
  const langNote =
    locale === 'ko'
      ? '모든 LocalizedText의 ko/en 필드를 모두 채우세요. ko는 자연스러운 한국어, en은 자연스러운 영어.'
      : 'Fill both ko/en fields for all LocalizedText. ko: natural Korean, en: natural English.';

  return `다음 인터뷰 정보를 바탕으로 추리 게임 사건 구조를 JSON으로 생성하세요.

수집된 인터뷰 정보:
${JSON.stringify(collectedInfo, null, 2)}

세션 ID: ${sessionId}

생성 규칙:
- scenes: 2~5개, 논리적 연결 관계 포함
- words: 전체 6~15개, 카테고리 다양하게 (person/place/object/action/time/motive/evidence)
- hotspotHints: 각 씬당 3~7개, examine/word_reveal/navigate 조합
- mainPuzzle: 핵심 단서 4~8개 단어 참조
- subPuzzles: character_id + relationship 또는 timeline 조합 권장
- ${langNote}
- 모든 tempId는 "scene_1", "word_1" 형식

다음 JSON 형식으로만 응답하세요 (마크다운 코드 펜스 제외):
{
  "title": { "ko": "...", "en": "..." },
  "description": { "ko": "...", "en": "..." },
  "genre": "noir|mystery|thriller|historical|fantasy",
  "characters": [
    {
      "name": "이름",
      "role": "culprit|victim|witness|suspect",
      "description": "설명",
      "alibi": "알리바이 (선택)",
      "relationships": [{ "targetName": "다른 인물명", "relationship": "관계" }]
    }
  ],
  "scenes": [
    {
      "tempId": "scene_1",
      "name": { "ko": "씬 이름", "en": "Scene Name" },
      "description": "AI 배경 생성용 설명",
      "connections": ["scene_2"],
      "hotspotHints": [
        {
          "label": "핫스팟 이름",
          "actionType": "examine|word_reveal|navigate",
          "contentHint": "내용 힌트",
          "relatedWordId": "word_1 (word_reveal 시)"
        }
      ]
    }
  ],
  "words": [
    {
      "tempId": "word_1",
      "display": { "ko": "단어", "en": "Word" },
      "category": "person|place|object|action|time|motive|evidence",
      "hint": { "ko": "힌트", "en": "Hint" },
      "sourceSceneTempId": "scene_1"
    }
  ],
  "mainPuzzle": {
    "titleHint": "퍼즐 제목 힌트",
    "descriptionHint": "퍼즐 설명 힌트",
    "templateDescription": "빈칸 퍼즐 구조 설명 (예: '진범은 [빈칸1]이며 동기는 [빈칸2]이었다')",
    "requiredWordTempIds": ["word_1", "word_2"]
  },
  "subPuzzles": [
    {
      "type": "character_id|scenario|timeline|relationship",
      "description": "서브 퍼즐 설명",
      "characterNames": ["이름1", "이름2"],
      "events": ["사건1", "사건2"]
    }
  ]
}`;
}
