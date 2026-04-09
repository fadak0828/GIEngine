/**
 * fun-metric.ts — AI 게임 품질 점수 시스템
 *
 * 생성된 CaseBlueprint를 Fun-Metric 차원에서 평가:
 * 1. game_length_balance — 게임 길이 균형
 * 2. clue_clarity — 단서 명확성
 * 3. puzzle_variety — 퍼즐 다양성
 * 4. character_depth — 캐릭터 깊이
 * 5. narrative_coherence — 서사 일관성
 */

import type { Locale } from '@gi-engine/core';
import type { CaseBlueprint } from '../interview/types.js';
import { getProvider } from '../providers/factory.js';
import { buildQualityScorePrompt } from './prompts/quality-score-prompt.js';

export interface FunMetricScore {
  game_length_balance: number; // 0-100
  clue_clarity: number;        // 0-100
  puzzle_variety: number;      // 0-100
  character_depth: number;      // 0-100
  narrative_coherence: number; // 0-100
}

export interface FunMetricResult {
  scores: FunMetricScore;
  overall_score: number; // 0-100
  summary: string;
  top_issue: string;
  suggestions: Array<{ dimension: string; suggestion: string }>;
}

export interface ScoredBlueprint {
  blueprint: CaseBlueprint;
  metrics: FunMetricResult;
  scoredAt: number;
}

// ── 파싱 헬퍼 ────────────────────────────────────────────────────────

function parseQualityResponse(raw: string): FunMetricResult {
  const jsonText = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonText) as {
      scores: FunMetricScore;
      overall_score: number;
      summary?: { ko?: string; en?: string; [key: string]: string | undefined };
      top_issue?: { ko?: string; en?: string; [key: string]: string | undefined };
      suggestions?: Array<{ dimension?: string; ko?: string; en?: string; [key: string]: string | undefined }>;
    };

    // Extract localized strings
    const getStr = (obj: unknown, locale: string): string => {
      if (typeof obj === 'string') return obj;
      if (obj && typeof obj === 'object') {
        const o = obj as Record<string, unknown>;
        if (o[locale]) return String(o[locale]);
        if (o['ko']) return String(o['ko']);
        if (o['en']) return String(o['en']);
      }
      return String(obj ?? '');
    };

    const locale = 'ko'; // default to Korean

    return {
      scores: {
        game_length_balance: clampScore(parsed.scores?.game_length_balance ?? 0),
        clue_clarity: clampScore(parsed.scores?.clue_clarity ?? 0),
        puzzle_variety: clampScore(parsed.scores?.puzzle_variety ?? 0),
        character_depth: clampScore(parsed.scores?.character_depth ?? 0),
        narrative_coherence: clampScore(parsed.scores?.narrative_coherence ?? 0),
      },
      overall_score: clampScore(parsed.overall_score ?? 0),
      summary: getStr(parsed.summary, locale),
      top_issue: getStr(parsed.top_issue, locale),
      suggestions: (parsed.suggestions ?? []).map(s => ({
        dimension: s.dimension ?? 'unknown',
        suggestion: getStr(s, locale),
      })),
    };
  } catch {
    // Parse failure — return default low score
    return {
      scores: {
        game_length_balance: 0,
        clue_clarity: 0,
        puzzle_variety: 0,
        character_depth: 0,
        narrative_coherence: 0,
      },
      overall_score: 0,
      summary: '품질 평가 실패',
      top_issue: 'AI 응답을 파싱할 수 없습니다',
      suggestions: [],
    };
  }
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── FunMetricScorer ──────────────────────────────────────────────────

/**
 * FunMetricScorer — 생성된 CaseBlueprint의 품질을 AI로 평가
 *
 * 사용법:
 * ```ts
 * const scorer = new FunMetricScorer();
 * const result = await scorer.scoreBlueprint(blueprint, 'ko');
 * console.log(result.overall_score); // 0-100
 * ```
 */
export class FunMetricScorer {
  /**
   * CaseBlueprint를 Fun-Metric 차원에서 평가합니다.
   * 평가 결과와 원본 블루프린트를 함께 반환합니다.
   */
  async scoreBlueprint(
    blueprint: CaseBlueprint,
    locale: Locale = 'ko',
  ): Promise<ScoredBlueprint> {
    const blueprintJson = JSON.stringify(
      {
        title: blueprint.title,
        description: blueprint.description,
        genre: blueprint.genre,
        characters: blueprint.characters.map(c => ({
          name: c.name,
          role: c.role,
          description: c.description,
          alibi: c.alibi,
          relationships: c.relationships,
        })),
        scenes: blueprint.scenes.map(s => ({
          tempId: s.tempId,
          name: s.name,
          description: s.description,
          connections: s.connections,
          hotspotCount: s.hotspotHints.length,
        })),
        words: blueprint.words.map(w => ({
          tempId: w.tempId,
          display: w.display,
          category: w.category,
          hint: w.hint,
          sourceSceneTempId: w.sourceSceneTempId,
        })),
        mainPuzzle: blueprint.mainPuzzle,
        subPuzzles: blueprint.subPuzzles,
      },
      null,
      2,
    );

    const prompt = buildQualityScorePrompt({ blueprintJson, locale });
    const raw = await getProvider().generateText(prompt);
    const metrics = parseQualityResponse(raw);

    return {
      blueprint,
      metrics,
      scoredAt: Date.now(),
    };
  }

  /**
   * 점수 등급 반환 (A/B/C/D/F)
   */
  static grade(overallScore: number): string {
    if (overallScore >= 90) return 'A';
    if (overallScore >= 75) return 'B';
    if (overallScore >= 60) return 'C';
    if (overallScore >= 40) return 'D';
    return 'F';
  }

  /**
   * 점수를 기반으로 품질 등급 설명 반환
   */
  static gradeLabel(overallScore: number, locale: Locale = 'ko'): string {
    const labels: Record<string, Record<string, string>> = {
      ko: {
        A: '훌륭함 (90+)',
        B: '좋음 (75-89)',
        C: '보통 (60-74)',
        D: '미흡 (40-59)',
        F: '불량 (0-39)',
      },
      en: {
        A: 'Excellent (90+)',
        B: 'Good (75-89)',
        C: 'Average (60-74)',
        D: 'Poor (40-59)',
        F: 'Failing (0-39)',
      },
    };
    return labels[locale]?.[FunMetricScorer.grade(overallScore)] ?? labels['ko']['F'];
  }
}

/** 싱글톤 인스턴스 */
export const funMetricScorer = new FunMetricScorer();
