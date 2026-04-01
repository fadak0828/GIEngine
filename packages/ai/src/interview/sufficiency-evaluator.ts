/**
 * 충분성 평가기 — 단계별 점수 계산 및 완료 여부 판단
 */

import type { InterviewStage, CollectedCaseInfo, SufficiencyScore } from './types.js';
import { STAGE_META } from './types.js';

/**
 * 수집된 정보를 기반으로 단계 충분성 점수를 계산합니다.
 * AI 호출 없이 로컬에서 휴리스틱 평가를 수행합니다.
 */
export function evaluateSufficiency(
  stage: InterviewStage,
  collectedInfo: CollectedCaseInfo,
  exchangeCount: number,
): SufficiencyScore {
  const meta = STAGE_META[stage];
  let score = 0;
  const reasons: string[] = [];

  switch (stage) {
    case 'case_overview': {
      const ov = collectedInfo.overview;
      if (ov?.genre) { score += 25; }
      if (ov?.setting) { score += 25; }
      if (ov?.era) { score += 20; }
      if (ov?.atmosphere) { score += 15; }
      if (ov?.title) { score += 15; }
      break;
    }
    case 'core_plot': {
      const cp = collectedInfo.corePlot;
      if (cp?.incidentSummary) { score += 30; }
      if (cp?.culprit) { score += 30; }
      if (cp?.motive) { score += 25; }
      if (cp?.method) { score += 10; }
      if (cp?.victimName) { score += 5; }
      break;
    }
    case 'characters': {
      const chars = collectedInfo.characters ?? [];
      const hasCulprit = chars.some((c) => c.role === 'culprit');
      const hasOther = chars.some((c) => c.role !== 'culprit');
      if (hasCulprit) { score += 40; }
      if (hasOther) { score += 20; }
      // 각 캐릭터당 alibi/description에 따라 추가 점수
      for (const c of chars) {
        if (c.description) { score += 5; }
        if (c.alibi) { score += 5; }
      }
      score = Math.min(score, 100);
      break;
    }
    case 'locations': {
      const locs = collectedInfo.locations ?? [];
      if (locs.length >= 2) { score += 50; }
      else if (locs.length === 1) { score += 25; }
      for (const l of locs) {
        if (l.description) { score += 8; }
        if (l.connections?.length) { score += 5; }
        if (l.discoverableClues?.length) { score += 7; }
      }
      score = Math.min(score, 100);
      break;
    }
    case 'evidence': {
      const evs = collectedInfo.evidence ?? [];
      if (evs.length >= 3) { score += 50; }
      else if (evs.length === 2) { score += 35; }
      else if (evs.length === 1) { score += 15; }
      for (const e of evs) {
        if (e.relatedCharacter) { score += 5; }
        if (e.relatedLocation) { score += 5; }
        if (e.isKeyEvidence) { score += 5; }
      }
      score = Math.min(score, 100);
      break;
    }
    case 'puzzle_structure': {
      const pz = collectedInfo.puzzle;
      if (pz?.mainPuzzleHint) { score += 40; }
      if ((pz?.keyWords?.length ?? 0) >= 3) { score += 30; }
      else if ((pz?.keyWords?.length ?? 0) >= 1) { score += 15; }
      if ((pz?.subPuzzleTypes?.length ?? 0) >= 1) { score += 30; }
      break;
    }
    default:
      score = 0;
  }

  const minExchangesMet = exchangeCount >= meta.minExchanges;
  const thresholdMet = score >= meta.sufficiencyThreshold;
  const isComplete = minExchangesMet && thresholdMet;

  if (!minExchangesMet) {
    reasons.push(`최소 ${meta.minExchanges}회 교환 필요 (현재 ${exchangeCount}회)`);
  }
  if (!thresholdMet) {
    reasons.push(`충분성 점수 부족: ${score}/${meta.sufficiencyThreshold}`);
  }

  return {
    stage,
    score,
    isComplete,
    reason: reasons.length > 0 ? reasons.join(', ') : '충분한 정보 수집 완료',
  };
}

/**
 * AI 응답에서 파싱된 충분성 점수로 SufficiencyScore를 생성합니다.
 */
export function createSufficiencyScoreFromAI(
  stage: InterviewStage,
  aiScore: number,
  exchangeCount: number,
): SufficiencyScore {
  const meta = STAGE_META[stage];
  const minExchangesMet = exchangeCount >= meta.minExchanges;
  const thresholdMet = aiScore >= meta.sufficiencyThreshold;
  return {
    stage,
    score: aiScore,
    isComplete: minExchangesMet && thresholdMet,
  };
}

/**
 * CollectedCaseInfo를 병합합니다 (기존 + 새 추출 정보).
 */
export function mergeCollectedInfo(
  existing: CollectedCaseInfo,
  extracted: Partial<CollectedCaseInfo>,
): CollectedCaseInfo {
  const merged: CollectedCaseInfo = { ...existing };

  if (extracted.overview) {
    merged.overview = { ...existing.overview, ...extracted.overview };
  }
  if (extracted.corePlot) {
    merged.corePlot = { ...existing.corePlot, ...extracted.corePlot };
  }
  if (extracted.characters?.length) {
    const existingChars = existing.characters ?? [];
    const newChars = extracted.characters.filter(
      (nc) => !existingChars.some((ec) => ec.name === nc.name),
    );
    // 기존 캐릭터 업데이트
    const updatedChars = existingChars.map((ec) => {
      const nc = extracted.characters!.find((c) => c.name === ec.name);
      return nc ? { ...ec, ...nc } : ec;
    });
    merged.characters = [...updatedChars, ...newChars];
  }
  if (extracted.locations?.length) {
    const existingLocs = existing.locations ?? [];
    const newLocs = extracted.locations.filter(
      (nl) => !existingLocs.some((el) => el.name === nl.name),
    );
    const updatedLocs = existingLocs.map((el) => {
      const nl = extracted.locations!.find((l) => l.name === el.name);
      return nl ? { ...el, ...nl } : el;
    });
    merged.locations = [...updatedLocs, ...newLocs];
  }
  if (extracted.evidence?.length) {
    merged.evidence = [...(existing.evidence ?? []), ...extracted.evidence];
  }
  if (extracted.puzzle) {
    merged.puzzle = { ...existing.puzzle, ...extracted.puzzle };
  }

  return merged;
}
