/**
 * 1문장 → 전체 CaseBlueprint JSON 프롬프트 빌더
 */

import type { Locale } from '@gi-engine/core';
import type { QuickCreateOptions } from '../types.js';

export function buildSentenceToBlueprintPrompt(
  sentence: string,
  sessionId: string,
  options: QuickCreateOptions = {},
  locale: Locale = 'ko',
): string {
  const { genre, atmosphere, era } = options;

  const langNote =
    locale === 'ko'
      ? '모든 LocalizedText(name, display, hint, title, description)의 ko/en 필드를 모두 채우세요. ko는 자연스러운 한국어, en은 자연스러운 영어.'
      : 'Fill both ko/en fields for all LocalizedText. ko: natural Korean, en: natural English.';

  const genreHint = genre ? `장르: ${genre}` : '장르: 문장에서 자동 판단';
  const atmosphereHint = atmosphere ? `분위기: ${atmosphere}` : '';
  const eraHint = era ? `시대: ${era}` : '';
  const contextHints = [genreHint, atmosphereHint, eraHint].filter(Boolean).join('\n');

  return `당신은 추리 게임 사건 설계 전문가입니다.
아래 1문장 핵심 단서를 바탕으로 완성된 추리 게임 사건 구조(CaseBlueprint)를 JSON으로 생성하세요.

핵심 문장: "${sentence}"
${contextHints}
세션 ID: ${sessionId}

## 생성 요구사항

### 캐릭터 (characters)
- 최소 4명, 최대 7명
- 반드시 포함: culprit(진범) 1명, victim(피해자) 1명
- 권장: witness(목격자) 1~2명, suspect(용의자) 1~2명
- 각 캐릭터: 이름, 역할, 설명, 알리바이(culprit/suspect), 관계

### 씬 (scenes)
- 3~5개
- 범행 현장 1개 포함 필수
- connections: 실제 이동 가능한 씬 tempId 목록
- hotspotHints: 씬당 4~7개
  - examine: 조사 가능 오브젝트
  - examine_image: 이미지 단서 (씬당 1~2개)
  - word_reveal: 단어 획득 포인트 (relatedWordId 필수)
  - navigate: 다른 씬으로 이동

### 단어 (words)
- 10~15개
- 카테고리 다양하게: person/place/object/action/time/motive/evidence
- 진범 이름, 피해자 이름, 범행 장소는 반드시 포함
- sourceSceneTempId: 해당 단어를 얻을 수 있는 씬

### 메인 퍼즐 (mainPuzzle)
- requiredWordTempIds: 5~8개 (진범, 동기, 방법, 장소 관련 단어 조합)
- templateDescription: "[빈칸1]이(가) [빈칸2]에서 [빈칸3]을 이용해 [빈칸4]을(를) [빈칸5]했다" 형식

### 서브 퍼즐 (subPuzzles)
- 2~3개
- 타입 다양하게: character_id + (relationship 또는 timeline 또는 scenario)

## 규칙
- ${langNote}
- 모든 tempId: "scene_1", "scene_2", "word_1", "word_2" 형식
- word_reveal 핫스팟의 relatedWordId는 반드시 words 배열에 존재하는 tempId
- connections는 존재하는 씬 tempId만 참조
- 마크다운 코드 펜스 없이 순수 JSON만 응답

다음 형식으로만 응답:
{
  "title": { "ko": "사건 제목", "en": "Case Title" },
  "description": { "ko": "사건 설명", "en": "Case Description" },
  "genre": "mystery|noir|thriller|historical|fantasy",
  "characters": [
    {
      "name": "이름",
      "role": "culprit|victim|witness|suspect",
      "description": "인물 설명",
      "alibi": "알리바이 (culprit/suspect는 필수)",
      "relationships": [{ "targetName": "다른 인물명", "relationship": "관계 설명" }]
    }
  ],
  "scenes": [
    {
      "tempId": "scene_1",
      "name": { "ko": "씬 이름", "en": "Scene Name" },
      "description": "AI 배경 이미지 생성용 씬 설명 (영문 권장, 구체적으로)",
      "connections": ["scene_2"],
      "hotspotHints": [
        {
          "label": "핫스팟 레이블",
          "actionType": "examine|examine_image|word_reveal|navigate",
          "contentHint": "핫스팟 내용 힌트",
          "relatedWordId": "word_1 (word_reveal 타입만)"
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
    "titleHint": "메인 퍼즐 제목 힌트",
    "descriptionHint": "메인 퍼즐 설명 힌트",
    "templateDescription": "빈칸 퍼즐 구조 (예: '진범은 [빈칸1]이며 [빈칸2]에서 [빈칸3]을 이용해 범행을 저질렀다')",
    "requiredWordTempIds": ["word_1", "word_2", "word_3", "word_4", "word_5"]
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
