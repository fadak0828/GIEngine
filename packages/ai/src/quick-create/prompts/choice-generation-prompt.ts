/**
 * 섹션별 4가지 선택지 생성 프롬프트 빌더
 */

import type { CaseBlueprint } from '../../interview/types.js';

export type ChoiceSection = 'characters' | 'scenes' | 'puzzleStructure' | 'atmosphere';

export function buildChoiceGenerationPrompt(
  section: ChoiceSection,
  blueprint: CaseBlueprint,
  originalSentence: string,
): string {
  const blueprintSummary = summarizeBlueprint(blueprint);

  const sectionPrompts: Record<ChoiceSection, string> = {
    characters: `
현재 캐릭터 구성:
${JSON.stringify(blueprint.characters, null, 2)}

위 캐릭터 구성의 4가지 변형을 제안하세요. 각 변형은 다음 축 중 하나를 강조합니다:
1. 인물 수 늘리기 (용의자 추가)
2. 인물 관계 복잡화 (삼각관계, 가족 갈등)
3. 반전 구조 (예상치 못한 진범)
4. 미니멀 구성 (핵심 인물만)
`,
    scenes: `
현재 씬 구성:
${JSON.stringify(blueprint.scenes.map(s => ({ tempId: s.tempId, name: s.name, connections: s.connections })), null, 2)}

위 씬 배치의 4가지 변형을 제안하세요. 각 변형은 다음 축 중 하나를 강조합니다:
1. 오픈 월드 (씬 확장, 더 많은 장소)
2. 밀실 미스터리 (씬 축소, 폐쇄적 공간)
3. 시간 여행 (과거/현재 씬 대비)
4. 이중 현장 (범행 현장 2곳)
`,
    puzzleStructure: `
현재 퍼즐 구조:
메인 퍼즐: ${blueprint.mainPuzzle.templateDescription}
서브 퍼즐: ${JSON.stringify(blueprint.subPuzzles, null, 2)}

위 퍼즐 구조의 4가지 변형을 제안하세요. 각 변형은 다음 축 중 하나를 강조합니다:
1. 논리 중심 (타임라인 재구성)
2. 심리 중심 (동기/거짓말 분석)
3. 물증 중심 (증거물 연결)
4. 관계도 중심 (인물 관계 퍼즐)
`,
    atmosphere: `
현재 장르/분위기: ${blueprint.genre}
사건 개요: ${blueprint.description?.ko || blueprint.description?.en || ''}

위 분위기의 4가지 변형을 제안하세요. 각 변형은 다음 스타일 중 하나를 강조합니다:
1. 클래식 누아르 (1950년대, 암울, 하드보일드)
2. 코지 미스터리 (아늑한 마을, 밝은 톤, 아마추어 탐정)
3. 심리 스릴러 (현대적, 긴장감, 반전)
4. 역사 미스터리 (전통적 배경, 시대극)
`,
  };

  return `당신은 추리 게임 사건 설계 전문가입니다.
다음 추리 게임 사건의 "${section}" 섹션에 대해 4가지 다양한 변형 선택지를 생성하세요.

원본 핵심 문장: "${originalSentence}"

사건 요약:
${blueprintSummary}

${sectionPrompts[section]}

각 선택지는 반드시 기본 사건 설정("${originalSentence}")을 유지하면서 해당 섹션만 변형해야 합니다.

다음 JSON 형식으로만 응답 (마크다운 코드 펜스 없이):
[
  {
    "id": "option_1",
    "label": "선택지 이름 (10자 이내)",
    "summary": "이 선택지가 어떻게 다른지 1~2문장 설명"
  },
  {
    "id": "option_2",
    "label": "선택지 이름",
    "summary": "설명"
  },
  {
    "id": "option_3",
    "label": "선택지 이름",
    "summary": "설명"
  },
  {
    "id": "option_4",
    "label": "선택지 이름",
    "summary": "설명"
  }
]`;
}

function summarizeBlueprint(blueprint: CaseBlueprint): string {
  const culprit = blueprint.characters.find(c => c.role === 'culprit');
  const victim = blueprint.characters.find(c => c.role === 'victim');
  return [
    `제목: ${blueprint.title?.ko || blueprint.title?.en}`,
    `장르: ${blueprint.genre}`,
    `진범: ${culprit?.name || '미정'}`,
    `피해자: ${victim?.name || '미정'}`,
    `씬 수: ${blueprint.scenes.length}개`,
    `단어 수: ${blueprint.words.length}개`,
  ].join('\n');
}
