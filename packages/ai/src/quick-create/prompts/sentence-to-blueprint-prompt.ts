/**
 * 1문장 → 전체 CaseBlueprint JSON 프롬프트 빌더 (고도화 버전)
 *
 * 향상된 포인트:
 * - 씬 설명에 시간대/조명/색감/분위기 키워드 포함
 * - 핫스팟 위치 가이드 (normalized position)
 * - 퍼즐 다양성 강화
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

## 씬(scene) 설명 품질 — 매우 중요

배경 이미지 생성 품질을 위해 각 씬 description에 다음 요소를 반드시 포함하세요:

1. **시간대**: "낮의", "심야의", "황혼의", "새벽의", "석양의"
2. **조명**: "탁한 조명", "네온 불빛", "은은한 촛불", "형광등", "달빛", "스팟라이트", "그늘진"
3. **색감**: "어두운 갈색 톤", "차가운 청회색", "따뜻한 앰버색", "고딕적 암색", "파스텔 톤"
4. **주요 오브젝트**: "낡은 나무 책상 위", "피 묻은 카펫", "깨진 유리창", "압묻힌 액자", "녹슨 열쇠"
5. **분위기 키워드**: "불길한", "미스터리한", "압도적인", "아늑한", "냉담한", "고요한"

예시:
"심야의 낙양 극장 로비, 꺼진 형광등, 먼지 쌓인 붉은 카펫, 구겨진 프로그램, 불길한 고요함"

## 캐릭터 (characters)
- 최소 4명, 최대 7명
- 반드시 포함: culprit(진범) 1명, victim(피해자) 1명
- 권장: witness(목격자) 1~2명, suspect(용의자) 1~2명
- 각 캐릭터: 이름, 역할, 설명, 알리바이(culprit/suspect), 관계(2개 이상)
- **레드 헤링 포함**: 진범과 비슷한 알리바이를 가진 의심스러운 인물 1명 추가

## 씬 (scenes)
- 3~5개
- 범행 현장 1개 포함 필수 + 주변 장소 1~2개 + 수상한 장소 1개
- **시간대 차별화**: 각 씬마다 다른 시간대(낮/저녁/밤) 활용
- connections: 실제 이동 가능한 씬 tempId 목록

### 핫스팟 (hotspotHints) — 필수 포함

**위치 가이드 (normalized position, 16:9 기준):**
- 왼쪽 상단: x=0.1~0.3, y=0.1~0.3
- 오른쪽 상단: x=0.7~0.9, y=0.1~0.3
- 중앙: x=0.4~0.6, y=0.4~0.6
- 왼쪽 하단: x=0.1~0.3, y=0.7~0.9
- 오른쪽 하단: x=0.7~0.9, y=0.7~0.9
- 테두리/모서리: x=0.05~0.15 또는 0.85~0.95

**씬당 5~8개 핫스팟 (분포:**
- examine: 2~3개 (조사 가능 오브젝트, 다양한 위치)
- examine_image: 1~2개 (이미지 단서, 왼쪽 상단/오른쪽 상단 추천)
- word_reveal: 1~2개 (핵심 단서 획득, 중앙/하단 추천, relatedWordId 필수)
- navigate: 0~1개 (다른 씬으로 이동)

## 단어 (words)
- 12~18개 (증거+인물+동기+방법+장소+시간 조합)
- 카테고리 다양하게: person/place/object/action/time/motive/evidence
- 진범 이름, 피해자 이름, 범행 장소, 사용 도구, 동기는 반드시 포함
- sourceSceneTempId: 해당 단어를 얻을 수 있는 씬
- **중요한 레드 헤링 단서 2~3개 추가** (플레이어를 혼란시키는误导 단서)

## 메인 퍼즐 (mainPuzzle)
- requiredWordTempIds: 6~10개 (정답 조합 + 레드 헤링 조합)
- templateDescription: "[빈칸1]이(가) [빈칸2]에서 [빈칸3]을 이용해 [빈칸4]을(를) [빈칸5]했다" 형식
-descriptionHint: 플레이어가 단서를 조합하는 방법을 설명

## 서브 퍼즐 (subPuzzles)
- 2~3개, 서로 다른 타입 조합 필수
- 권장 조합: timeline + relationship + scenario 중 2개 이상
- 각 서브퍼즐의 characterNames/events: 반드시 실제 캐릭터 이름/사건 사용
- **레드 헤링 서브퍼즐 1개**: 잘못된 결론으로 유도하는 서브퍼즐

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
      "description": "배경 이미지 생성용 상세 설명 (시간대+조명+색감+주요오브젝트+분위기 키워드 포함)",
      "connections": ["scene_2"],
      "hotspotHints": [
        {
          "label": "핫스팟 레이블",
          "actionType": "examine|examine_image|word_reveal|navigate",
          "contentHint": "핫스팟 내용 힌트",
          "positionHint": { "x": 0.15, "y": 0.3, "description": "왼쪽 상단 근처의 작은 오브젝트" },
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
    "templateDescription": "빈칸 퍼즐 구조",
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
