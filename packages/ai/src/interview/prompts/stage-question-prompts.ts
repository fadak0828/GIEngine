/**
 * 단계별 질문 생성 프롬프트
 */

import type { InterviewStage, CollectedCaseInfo } from '../types.js';
import { STAGE_META } from '../types.js';
import type { Locale } from '@gi-engine/core';

function formatCollectedContext(info: CollectedCaseInfo): string {
  const parts: string[] = [];

  if (info.overview) {
    const ov = info.overview;
    parts.push(
      `[사건 개요] 장르: ${ov.genre ?? '미정'}, 배경: ${ov.setting ?? '미정'}, 시대: ${ov.era ?? '미정'}, 분위기: ${ov.atmosphere ?? '미정'}`,
    );
  }
  if (info.corePlot) {
    const cp = info.corePlot;
    parts.push(
      `[핵심 줄거리] 사건: ${cp.incidentSummary ?? '미정'}, 진범: ${cp.culprit ?? '미정'}, 동기: ${cp.motive ?? '미정'}`,
    );
  }
  if (info.characters?.length) {
    const names = info.characters.map((c) => `${c.name}(${c.role})`).join(', ');
    parts.push(`[등장인물] ${names}`);
  }
  if (info.locations?.length) {
    const names = info.locations.map((l) => l.name).join(', ');
    parts.push(`[장소] ${names}`);
  }
  if (info.evidence?.length) {
    parts.push(`[증거] ${info.evidence.length}개 수집됨`);
  }
  if (info.puzzle) {
    parts.push(`[퍼즐 힌트] ${info.puzzle.mainPuzzleHint ?? '미정'}`);
  }

  return parts.length > 0 ? parts.join('\n') : '(아직 수집된 정보 없음)';
}

export function buildStageQuestionPrompt(
  stage: InterviewStage,
  collectedInfo: CollectedCaseInfo,
  followUpCount: number,
  locale: Locale,
): string {
  const meta = STAGE_META[stage];
  const context = formatCollectedContext(collectedInfo);
  const isFollowUp = followUpCount > 0;
  const langInstruction = locale === 'ko' ? '한국어로' : 'in English';

  return `당신은 추리 게임 사건 설계를 도와주는 전문 AI 인터뷰어입니다.

현재 단계: ${meta.label.ko} (${meta.label.en})
단계 목표: ${meta.description}

지금까지 수집된 정보:
${context}

역할: 게임 디자이너를 인터뷰하여 현재 단계에 필요한 정보를 자연스럽게 수집하세요.

${isFollowUp ? `이전 답변이 불충분했습니다. 후속 질문(${followUpCount}회차)으로 더 구체적인 정보를 요청하세요.` : '현재 단계의 초기 질문을 시작하세요.'}

응답 규칙:
- ${langInstruction} 응답하세요
- 자연스러운 대화체 질문 1-2개만 작성하세요
- JSON 형식 금지, 순수 텍스트로만 응답하세요
- 친근하고 격려하는 톤을 유지하세요
- 이전에 수집된 정보를 언급하며 연결감을 주세요

다음 JSON 형식으로 응답하세요:
{
  "aiResponse": "자연스러운 질문 텍스트",
  "questionType": "${isFollowUp ? 'follow_up' : 'initial'}"
}`;
}

export function buildInfoExtractionPrompt(
  stage: InterviewStage,
  userMessage: string,
  collectedInfo: CollectedCaseInfo,
): string {
  const meta = STAGE_META[stage];

  return `사용자의 인터뷰 응답에서 현재 단계(${meta.label.ko})에 필요한 정보를 추출하고 충분성을 평가하세요.

현재 단계: ${meta.label.ko}
필수 수집 항목: ${meta.requiredFields.join(', ')}
충분성 임계값: ${meta.sufficiencyThreshold}점

지금까지 수집된 정보:
${JSON.stringify(collectedInfo, null, 2)}

사용자 응답:
"${userMessage}"

다음 JSON 형식으로 응답하세요:
{
  "aiResponse": "사용자 응답에 대한 자연스러운 반응 및 다음 행동 안내 (순수 텍스트, 1-3문장)",
  "extractedInfo": {
    // 현재 단계에서 추출된 새 정보 (기존 collectedInfo 구조에 맞게)
    // 예: "overview": { "genre": "noir", "era": "1920년대" }
    // 추출 불가 시 빈 객체 {}
  },
  "sufficiencyScore": 0-100,
  "isStageComplete": true/false
}

판단 기준:
- sufficiencyScore: 0-100점, ${meta.sufficiencyThreshold}점 이상이면 단계 완료 가능
- isStageComplete: sufficiencyScore >= ${meta.sufficiencyThreshold} AND 최소 교환 횟수(${meta.minExchanges}회) 충족 시 true
- extractedInfo: 사용자 응답에서 구체적으로 언급된 정보만 포함`;
}
