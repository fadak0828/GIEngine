/**
 * 선택지 반영 블루프린트 재생성 프롬프트 빌더
 *
 * 원본 문장 + 선택 사항을 기반으로 개선된 CaseBlueprint를 생성합니다.
 */

import type { Locale } from '@gi-engine/core';
import type { CaseBlueprint } from '../../interview/types.js';
import type { ChoiceSelection, SectionChoices } from '../types.js';

export interface ChoiceRefinedOptions {
  /** 선택된 캐릭터 구성 변형 ID */
  charactersChoiceId?: string;
  /** 선택된 씬 배치 변형 ID */
  scenesChoiceId?: string;
  /** 선택된 퍼즐 구조 변형 ID */
  puzzleStructureChoiceId?: string;
  /** 선택된 분위기 변형 ID */
  atmosphereChoiceId?: string;
  /** 사용자가 직접 입력한 커스텀 내용 */
  customCharacters?: string;
  customScenes?: string;
  customPuzzleStructure?: string;
  customAtmosphere?: string;
}

const CHOICE_VARIANTS: Record<string, Record<string, string>> = {
  characters: {
    option_1: '기본 구성 유지',
    option_2: '용의자 추가: 용의자를 한 명 더 추가해 플레이어를 혼란시킴',
    option_3: '관계 복잡화: 캐릭터 간 삼각 관계 또는 가족 갈등 추가',
    option_4: '미니멀: 핵심 인물만 남겨 단순하고 집중된 구성',
  },
  scenes: {
    option_1: '기본 배치 유지',
    option_2: '확장 지도: 씬을 1~2개 더 추가해 탐색 범위를 넓힘',
    option_3: '밀실 구성: 씬을 줄이고 폐쇄적인 공간에 집중',
    option_4: '이중 현장: 범행 현장이 두 곳으로 나뉘어 플레이어를 헷갈리게 함',
  },
  puzzleStructure: {
    option_1: '기본 퍼즐 유지',
    option_2: '논리 추론: 타임라인 재구성에 집중한 퍼즐',
    option_3: '심리 분석: 동기와 거짓말을 파헤치는 퍼즐',
    option_4: '물증 연결: 물리적 증거물을 연결하는 퍼즐',
  },
  atmosphere: {
    option_1: '기본 분위기 유지',
    option_2: '클래식 누아르: 1950년대 암울한 분위기',
    option_3: '코지 미스터리: 밝은 톤의 아마추어 탐정 분위기',
    option_4: '심리 스릴러: 긴장감 넘치는 현대적 반전 분위기',
  },
};

function summarizeSelection(
  selection: ChoiceSelection,
  choices: SectionChoices,
  options: ChoiceRefinedOptions,
): string {
  const parts: string[] = [];

  if (selection.characters) {
    const variantLabel = CHOICE_VARIANTS.characters[selection.characters] ?? selection.characters;
    parts.push(`[캐릭터] ${variantLabel}`);
  }
  if (selection.scenes) {
    const variantLabel = CHOICE_VARIANTS.scenes[selection.scenes] ?? selection.scenes;
    parts.push(`[씬] ${variantLabel}`);
  }
  if (selection.puzzleStructure) {
    const variantLabel = CHOICE_VARIANTS.puzzleStructure[selection.puzzleStructure] ?? selection.puzzleStructure;
    parts.push(`[퍼즐] ${variantLabel}`);
  }
  if (selection.atmosphere) {
    const variantLabel = CHOICE_VARIANTS.atmosphere[selection.atmosphere] ?? selection.atmosphere;
    parts.push(`[분위기] ${variantLabel}`);
  }
  if (options.customCharacters) {
    parts.push(`[캐릭터 커스텀] ${options.customCharacters}`);
  }
  if (options.customScenes) {
    parts.push(`[씬 커스텀] ${options.customScenes}`);
  }
  if (options.customPuzzleStructure) {
    parts.push(`[퍼즐 커스텀] ${options.customPuzzleStructure}`);
  }
  if (options.customAtmosphere) {
    parts.push(`[분위기 커스텀] ${options.customAtmosphere}`);
  }

  return parts.length > 0 ? parts.join('\n') : '사용자가 선택 사항 없이 재생성을 요청함.';
}

export function buildChoiceRefinedPrompt(
  originalSentence: string,
  originalBlueprint: CaseBlueprint,
  selection: ChoiceSelection,
  choices: SectionChoices,
  options: ChoiceRefinedOptions,
  locale: Locale = 'ko',
): string {
  const langNote =
    locale === 'ko'
      ? '모든 LocalizedText(name, display, hint, title, description)의 ko/en 필드를 모두 채우세요.'
      : 'Fill both ko/en fields for all LocalizedText.';

  const selectionSummary = summarizeSelection(selection, choices, options);

  return `당신은 추리 게임 사건 설계 전문가입니다.
기존 추리 게임 사건을 사용자의 선택 사항에 따라 개선합니다.

원본 핵심 문장: "${originalSentence}"

사용자 선택 사항:
${selectionSummary}

기존 블루프린트 요약:
- 제목: ${originalBlueprint.title?.ko || originalBlueprint.title?.en}
- 캐릭터: ${originalBlueprint.characters.map(c => `${c.name}(${c.role})`).join(', ')}
- 씬: ${originalBlueprint.scenes.length}개 (${originalBlueprint.scenes.map(s => s.name?.ko || s.name?.en).join(', ')})
- 단어: ${originalBlueprint.words.length}개
- 메인 퍼즐: ${originalBlueprint.mainPuzzle.templateDescription}
- 서브 퍼즐: ${originalBlueprint.subPuzzles.map(p => p.type).join(', ')}

## 선택 사항 적용 규칙

**캐릭터 관련 선택지:**
- option_2(용의자 추가): 현재 용의자 외에 의심스러운 인물 1명 추가. 알리바이에 모순 포함.
- option_3(관계 복잡화): 캐릭터 간 관계를 2개 이상 추가. 적，少恨, 동업자, 가족 갈등 등.
- option_4(미니멀): 4명 이하로 축소. 진범과 피해자만 필수, 목격자 1~2명.

**씬 관련 선택지:**
- option_2(확장 지도): 기존 씬 사이에 1~2개 중간 장소 추가. connections에 모두 연결.
- option_3(밀실): 씬을 2~3개로 축소. 폐쇄적 공간(방, 연구실, 독방 등) 위주.
- option_4(이중 현장): 범행 현장을 2곳으로 분리. 각 현장마다 다른 증거셋.

**퍼즐 관련 선택지:**
- option_2(논리 추론): timeline 서브퍼즐 추가. 사건 타임라인 재구성 요소.
- option_3(심리 분석): relationship 서브퍼즐 추가. 인물의 거짓말과 동기를 추적.
- option_4(물증 연결): scenario 서브퍼즐 추가. 증거물을 조합해 새로운 사실 유도.

**분위기 관련 선택지:**
- option_2(클래식 누아르): 1950년대 배경, 흑백 영화 스타일, 어두운 조명, 모자/코트 패션.
- option_3(코지 미스터리): 작은 마을/카페 배경, 밝은 색감, 비격식 가구, 아늑한 분위기.
- option_4(심리 스릴러): 현대 배경, 시계/숨겨진 문/감시 카메라 등 첨단 요소, 긴장감 BGM.

## 필수 생성 요구사항

### 씬(scene) 설명 품질 향상 — 매우 중요
배경 이미지 생성 품질을 위해 각 씬 description에 다음을 반드시 포함:
1. **시간대**: "낮의", "심야의", "황혼의", "새벽의"
2. **조명**: "탁한 조명", "네온사인", "은은한 촛불", "형광등", "달빛"
3. **색감**: "어두운 갈색 톤", "차가운 청회색", "따뜻한 앰버색"
4. **주요 오브젝트**: "낡은 나무 책상 위", "피 묻은 카펫", "깨진 유리창"
5. **분위기 키워드**: "미스터리한", "압도적인", "불길한", "아늑한"

### 핫스팟 위치 가이드 — 필수
hotspotHints에 normalized position(x, y) 추가. 각 씬의 가로/세로 비율(16:9 기준):
- 왼쪽 상단: x=0.1~0.3, y=0.1~0.3
- 오른쪽 상단: x=0.7~0.9, y=0.1~0.3
- 중앙: x=0.4~0.6, y=0.4~0.6
- 왼쪽 하단: x=0.1~0.3, y=0.7~0.9
- 오른쪽 하단: x=0.7~0.9, y=0.7~0.9
- 테두리/모서리: x=0.05~0.15 또는 0.85~0.95

### 퍼즐 다양성
- 서브퍼즐 최소 2개, 서로 다른 타입 조합
- requiredWordTempIds: 5~10개 (증거, 인물, 동기, 방법, 장소 관련 조합)
- 서브퍼즐의 characterNames/events: 반드시 실제 캐릭터 이름/사건 사용

## 규칙
- ${langNote}
- 모든 tempId: "scene_1", "scene_2", "word_1", "word_2" 형식
- 원본 문장의 핵심 설정("${originalSentence}")은 반드시 유지
- 마크다운 코드 펜스 없이 순수 JSON만 응답

다음 형식으로만 응답:
{
  "title": { "ko": "사건 제목", "en": "Case Title" },
  "description": { "ko": "사건 설명", "en": "Case Description" },
  "genre": "mystery|noir|thriller|historical|fantasy",
  "characters": [...],
  "scenes": [
    {
      "tempId": "scene_1",
      "name": { "ko": "씬 이름", "en": "Scene Name" },
      "description": "배경 이미지 생성용 상세 설명 (시간대+조명+색감+주요오브젝트+분위기 포함)",
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
  "words": [...],
  "mainPuzzle": {...},
  "subPuzzles": [...]
}`;
}
