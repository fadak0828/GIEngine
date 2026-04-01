/**
 * quality-score-prompt.ts — AI 기반 게임 품질 평가 프롬프트
 *
 * Fun-metric 시스템의 핵심: 생성된 CaseBlueprint를 5개 차원에서 평가
 */

import type { Locale } from '@gi-engine/core';

export interface QualityScorePromptOptions {
  blueprintJson: string;
  locale: Locale;
}

/**
 * Fun-Metric 평가 차원:
 * 1. game_length_balance — 씬 수, 단어 수, 캐릭터 수가 적절한가
 * 2. clue_clarity — 단서(clue)가 논리적으로 배치되고 충분히 설명되었는가
 * 3. puzzle_variety — 퍼즐 다양성 (서브 퍼즐 타입, 레드 헤링 전략)
 * 4. character_depth — 캐릭터 간 관계, 알리바이, 동기의 풍부함
 * 5. narrative_coherence — 씬 연결, 스토리 흐름, 전체적 필연성
 */
export function buildQualityScorePrompt(options: QualityScorePromptOptions): string {
  const { blueprintJson, locale } = options;
  const lang = locale === 'ko' ? '한국어' : 'English';
  const evalLang = locale === 'ko' ? 'ko' : 'en';

  return `You are an expert mystery game designer evaluating AI-generated game content.

Evaluate the following CaseBlueprint for a mystery detective game.
Language of evaluation: ${lang}

Blueprint JSON:
${blueprintJson}

## Evaluation Dimensions (각 0-100 점수)

1. **game_length_balance** (게임 길이 균형)
   - 씬 수 3~5개, 단어 수 10~20개, 캐릭터 3~7명이 적당한가?
   - 너무 짧으면 지루하고 너무 길면 과부하

2. **clue_clarity** (단서 명확성)
   - 각 단서(hint)가 플레이어가 조사할 만한 가치가 있는가?
   - 핵심 단서와 레드 헤링 단서가 구별되는가?
   - 단서의 출처 씬이 논리적인가?

3. **puzzle_variety** (퍼즐 다양성)
   - 메인 퍼즐 + 서브 퍼즐 조합이 다양한가?
   - 레드 헤링 퍼즐이 플레이어를 충분히 혼란시키는가?
   - 타임라인/인물 관계도/시나리오 조합이 있는가?

4. **character_depth** (캐릭터 깊이)
   - 캐릭터 간 관계(relationships)가 풍부한가?
   - 각 캐릭터(culprit, victim, witness, suspect)의 알리바이가 논리적인가?
   - 레드 헤링 캐릭터가 진범과 비슷한 속성을 가진 채 도입되었는가?

5. **narrative_coherence** (서사 일관성)
   - 씬 간 연결(connections)이 논리적인가?
   - 스토리 플롯이 필연적으로 느껴지는가?
   - 시간대/장소 설정이 일관된 세계관을 형성하는가?

## 출력 형식

Respond ONLY with valid JSON:
{
  "scores": {
    "game_length_balance": 0-100,
    "clue_clarity": 0-100,
    "puzzle_variety": 0-100,
    "character_depth": 0-100,
    "narrative_coherence": 0-100
  },
  "overall_score": 0-100,
  "summary": {
    "${evalLang}": "<한 줄 요약>"
  },
  "top_issue": {
    "${evalLang}": "<가장 개선이 필요한 차원과 그 이유>"
  },
  "suggestions": [
    {
      "dimension": "affected dimension",
      "${evalLang}": "<개선 제안>"
    }
  ]
}

점수 가이드:
- 90-100: 훌륭함, 프로페셔널 수준의 품질
- 75-89: 좋음, 최소 수정으로 사용 가능
- 60-74: 보통, 몇 가지 개선 필요
- 40-59: 미흡, 재작성이 권장됨
- 0-39: 불량, 근본적 재설계 필요`;
}
