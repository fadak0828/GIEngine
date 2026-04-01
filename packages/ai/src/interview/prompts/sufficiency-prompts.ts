/**
 * 충분성 판단 프롬프트
 */

import type { InterviewStage, CollectedCaseInfo } from '../types.js';
import { STAGE_META } from '../types.js';

export function buildSufficiencyCheckPrompt(
  stage: InterviewStage,
  collectedInfo: CollectedCaseInfo,
  exchangeCount: number,
): string {
  const meta = STAGE_META[stage];

  return `현재 인터뷰 단계의 정보 충분성을 평가하세요.

단계: ${meta.label.ko}
필수 항목: ${meta.requiredFields.join(', ')}
현재 교환 횟수: ${exchangeCount}회 / 최소 요구: ${meta.minExchanges}회
충분성 임계값: ${meta.sufficiencyThreshold}점

수집된 정보:
${JSON.stringify(collectedInfo, null, 2)}

다음 JSON으로만 응답하세요:
{
  "score": 0-100,
  "isComplete": true/false,
  "missingFields": ["미흡한 항목1", "..."],
  "reason": "평가 이유 한 줄"
}

평가 기준:
- 필수 항목이 모두 있으면 기본 60점
- 각 항목의 구체성/상세도에 따라 +10~20점
- 교환 횟수 ${meta.minExchanges}회 미만이면 isComplete = false
- score >= ${meta.sufficiencyThreshold} AND 교환 횟수 충족 시 isComplete = true`;
}
