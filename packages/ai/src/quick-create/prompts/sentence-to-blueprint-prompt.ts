/**
 * 1문장 → 전체 CaseBlueprint JSON 프롬프트 빌더 (고도화 버전)
 *
 * 향상된 포인트:
 * - 씬 설명에 시간대/조명/색감/분위기 키워드 포함
 * - 핫스팟 위치 가이드 (normalized position) + positionHint 필수
 * - 퍼즐 다양성 강화
 * - 조사 단어 우선, 습득 단어 텍스트 표시 조건
 * - 모든 단어가 수집 가능해야 함 (미연결 핫스팟 불허)
 * - 카테고리별 여유분 수집 단어 존재
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
6. **글자/텍스트 포함 여부**: description에 "문서에 적힌 글자", "전단지", "낙서", "간판 글씨" 등 텍스트 오브젝트 명시 여부 — 이것이 습득 단어(word_reveal) 허용 조건

예시:
"심야의 낙양 극장 로비, 꺼진 형광등, 먼지 쌓인 붉은 카펫, 구겨진 프로그램, 불길한 고요함, 벽에 낙서된 전화번호"
→ 여기서 "전화번호"는 word_reveal 핫스팟과 연결 가능

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

**모든 hotspotHints에 positionHint를 반드시 포함하세요** (AI 핫스팟 위치와 배경 이미지 위치 일치를 위해):
"positionHint": { "x": 0.15, "y": 0.3, "description": "왼쪽 상단 근처의 작은 오브젝트" }

**씬당 5~8개 핫스팟 (분포):**
- examine: 2~3개 (조사 가능 오브젝트, 다양한 위치) — **조사 단어优先**
- examine_image: 1~2개 (이미지 단서, 왼쪽 상단/오른쪽 상단 추천)
- word_reveal: 1~2개 (핵심 단서 획득, 중앙/하단 추천, **relatedWordId 필수**)
- navigate: 0~1개 (다른 씬으로 이동)

## 단어 (words)

**수집 가능성 규칙 (매우 중요 — 모든 단어가 반드시 수집 가능해야 함):**
1. 모든 단어는 반드시 1개 이상의 핫스팟과 연결되어야 함
2. 핫스팟과 연결되지 않은 고립된 단서는 생성 금지
3. sourceSceneTempId는 해당 단어가 획득 가능한 씬을 지정

**조사 단어 우선 원칙:**
- examine 핫스팟의 contentHint에 기반한 조사 단어를 먼저 배치
- player가 hotspot을 examine하면 획득 가능한 evidence/object/person 단어 우선

**습득 단어 조건부 허용 (word_reveal):**
- 배경 이미지에 실제로 보일 수 있는 텍스트/글씨만 word_reveal으로 생성
- "문서에 적힌 내용", "낙서", "간판", "표지" 등 이미지 내 텍스트 오브젝트가 있는 경우에만 word_reveal 사용
- 이미지에 글자가 보이지 않는 씬에서는 word_reveal 사용 금지

**카테고리별 여유분 단어 (각 카테고리당 +1~2개 여유분):**
- 총 12~18개 단어 구성:
  - 핵심 필수 단어: 6~8개 (mainPuzzle.requiredWordTempIds에 포함)
  - 레드 헤링 단어: 2~3개 (플레이어 혼란용, 핵심과 유사해 보이지만 잘못된 답으로 유도)
  - 여유분(flush) 단어: 2~4개 (각 카테고리당 +1개, 실제 게임에 영향을 주지 않지만 수집 가능)
- 카테고리별 권장 구성:
  - person: 2~3개 (1명 culprit + 1~2명其他人)
  - place: 2~3개 (1개 범행 장소 + 1~2개 주변 장소)
  - object: 3~5개 (1~2개 핵심 증거 + 1~2개 레드 헤링 + 1개 여유분)
  - motive: 1~2개 (핵심 동기 + 1개 레드 헤링 동기)
  - evidence: 2~3개 (핵심 증거물 + 1개 여유분)

**레드 헤링 단서 가이드:**
- 핵심 단서와 비슷해 보이지만 실제案情과 무관한 단서 2~3개 추가
- 예: 실제 동기는 "금품"인데 "복수"라는 레드 헤링 동기 단서 포함
- 또는 실제 범행 도구는 "독"인데 "총"이라는 레드 헤링 포함

## 메인 퍼즐 (mainPuzzle)
- requiredWordTempIds: 6~10개 (정답 조합 + 레드 헤링 조합)
- templateDescription: "[빈칸1]이(가) [빈칸2]에서 [빈칸3]을 이용해 [빈칸4]을(를) [빈칸5]했다" 형식
- descriptionHint: 플레이어가 단서를 조합하는 방법을 설명

## 서브 퍼즐 (subPuzzles)
- 2~3개, 서로 다른 타입 조합 필수
- 권장 조합: timeline + relationship + scenario 중 2개 이상
- 각 서브퍼즐의 characterNames/events: 반드시 실제 캐릭터 이름/사건 사용
- **레드 헤링 서브퍼즐 1개**: 잘못된 결론으로 유도하는 서브퍼즐

## 품질 가이드라인 (매우 중요 — 80%+ 점수를 위한)

### 단서 명확성 (clue_clarity)
- 각 단서의 hint는 플레이어가 "생각할 거리를 줌"이 목표
- **나쁜 예**: "범인은 마트에서 독을 샀다" (너무 직접적)
- **좋은 예**: "가운데 창가 근처에서 이상한 화학 냄새가 났다" (플레이어가 스스로 연결)

### 수집 가능성 보장 (collectibility)
- 모든 단어의 sourceSceneTempId는 반드시 존재하는 scene tempId여야 함
- 모든 sourceSceneTempId에 해당하는 씬에는 반드시 해당 단어와 연결된 hotspotHints가 있어야 함
- hotspotHints의 relatedWordId는 반드시 words 배열에 존재하는 tempId여야 함

### 퍼즐 다양성 (puzzle_variety)
- 메인 퍼즐 + 최소 2개 서브 퍼즐 (서로 다른 타입)
- 레드 헤링 퍼즐은 "틀려도 자연스러운" 오답을 제공
- requiredWordTempIds는 반드시 6개 이상 (4개 이하는 너무 단순)

### 캐릭터 깊이 (character_depth)
- 각 캐릭터는 최소 2개의 관계(relationships)를 가짐
- 레드 헤링 캐릭터는 진범과 1개 이상의 공통 속성을 가짐
- alibi는 "있어 보이지만破绽가 있는" 것이 최고

### 서사 일관성 (narrative_coherence)
- 씬 설명은 시간대/조명/분위기를 명시 (총 5개 키워드 이상 포함)
- connections은 "이동 가능한 거리/논리적 연결"만 허용 (복도-방-계단 등)
- 씬 수는 3~5개로 유지 (너무 많으면 품질 하락)

### 게임 길이 균형 (game_length_balance)
- 씬 수 × 2 + 캐릭터 수 + 서브퍼즐 수 = 12~22 사이가 최적
- 단어 수는 12~18개 (핵심 6~8 + 레드 헤링 4~6 + 플러시 2~4)

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
      "description": "배경 이미지 생성용 상세 설명 (시간대+조명+색감+주요오브젝트+분위기+텍스트 포함여부 포함)",
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
