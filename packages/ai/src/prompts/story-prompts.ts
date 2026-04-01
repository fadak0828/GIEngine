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
 *
 * Quality enhancements (Phase E-1):
 * - scene names now include atmospheric keywords
 * - description includes genre-specific tension hooks
 * - narrative coherence guidelines added
 */
export function buildStoryPrompt(options: StoryPromptOptions): string {
  const { caseTitle, genre = '미스터리', locale, hints = [] } = options;
  const hintText = hints.length > 0 ? `힌트: ${hints.join(', ')}` : '';
  const localeName = locale === 'ko' ? '한국어' : 'English';

  const genreDescriptions: Record<string, string> = {
    noir: '음악이 멈춘 럭키엔딩 바, 피 묻은 재킷 한 벌. 세 번째 잔을 마시던 남자가 쓰러졌다.',
    classic: '폭풍우 몰려오던 밤, 달빛 대저택의 초상권. 상속을 둘러싼 네 명의 가족이 모였다.',
    historical: '조선 궁궐, 대비의 독사가 발각됐다.宫内有内鬼.',
    thriller: '밤샘 작업 중인 스타트업, CTO가 코딩 중 쓰러졌다. 그에게 남은最后的 메시지는?',
    fantasy: '마법대학의 고대 도서관, 금이 간 수정이 깨졌다.盗賊는Wizard 학생 중 하나.',
    mystery: '저묵의 해안가 등대, 불빛이 다시 켜졌다. 等대管理인이 사라졌다.',
  };

  const genreDescription = genreDescriptions[genre.toLowerCase()] ?? genreDescriptions.mystery;

  return `You are a creative writer for a detective mystery game.

## Task
Generate a case story in JSON format for a case titled "${caseTitle}".
Genre: ${genre}
Language: ${localeName}
${hintText}

## Narrative Coherence Guidelines

**설명(description) 품질 가이드**
- 총 2~3문장으로 작성
- Genre별 톤 유지:
  - noir: 어둡고 절망적인 분위기, 현실적 갈등
  - classic: 고풍스럽고 전통적인 해결형 미스터리
  - historical: 시대적 배경이 서사와 자연스럽게融合
  - thriller: 긴박감과現代적 위협
  - fantasy: 마법적 요소가 해결의 열쇠
- Hook(벌레)를 마지막 문장에 배치하여 플레이어의 궁금증 유발

**씬 이름(suggestedSceneNames) 품질 가이드**
- Genre Atmosphere를 이름에 녹여냄
- 예시: "심야의 낙양 극장 로비" (시간대+장소+분위기)
- Spatial variety: 최소 1개는 실내, 1개는 실외, 1개는 반室外 공간
- 총 3개 씬 이름 제안

Respond ONLY with valid JSON in this exact format:
{
  "description": {
    "ko": "<Korean description, genre=${genre} style, ${genreDescription}>",
    "en": "<English description, genre=${genre} style>"
  },
  "suggestedSceneNames": [
    { "ko": "<Korean atmospheric scene name with time/place/atmosphere>", "en": "<English atmospheric scene name>" },
    { "ko": "<Korean atmospheric scene name>", "en": "<English atmospheric scene name>" },
    { "ko": "<Korean atmospheric scene name>", "en": "<English atmospheric scene name>" }
  ]
}`;
}
