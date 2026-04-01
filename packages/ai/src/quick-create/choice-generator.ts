/**
 * ChoiceGenerator — 섹션별 4가지 변형 선택지 생성
 *
 * gemini-2.5-flash 사용 (비용 최적화)
 */

import { geminiClient } from '../client.js';
import type { CaseBlueprint } from '../interview/types.js';
import {
  buildChoiceGenerationPrompt,
  type ChoiceSection,
} from './prompts/choice-generation-prompt.js';
import type { ChoiceItem, SectionChoices } from './types.js';

export class ChoiceGenerator {
  private readonly flashModel = 'gemini-2.5-flash';

  /**
   * 특정 섹션의 4가지 변형 선택지 생성
   */
  async generateSectionChoices(
    section: ChoiceSection,
    blueprint: CaseBlueprint,
    originalSentence: string,
  ): Promise<ChoiceItem[]> {
    const prompt = buildChoiceGenerationPrompt(section, blueprint, originalSentence);
    const raw = await geminiClient.generateText(prompt, this.flashModel);
    return parseChoiceItems(raw);
  }

  /**
   * 모든 섹션의 선택지를 병렬로 생성
   */
  async generateAllChoices(
    blueprint: CaseBlueprint,
    originalSentence: string,
  ): Promise<SectionChoices> {
    const sections: ChoiceSection[] = ['characters', 'scenes', 'puzzleStructure', 'atmosphere'];

    const [characters, scenes, puzzleStructure, atmosphere] = await Promise.all(
      sections.map(section =>
        this.generateSectionChoices(section, blueprint, originalSentence).catch(() =>
          getFallbackChoices(section),
        ),
      ),
    );

    return { characters, scenes, puzzleStructure, atmosphere };
  }
}

/** JSON 파싱 (마크다운 펜스 제거 포함) */
function parseChoiceItems(raw: string): ChoiceItem[] {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 4).map((item, idx) => ({
        id: String(item.id || `option_${idx + 1}`),
        label: String(item.label || `선택지 ${idx + 1}`),
        summary: String(item.summary || ''),
      }));
    }
  } catch {
    // 파싱 실패 시 폴백
  }
  return [];
}

/** 파싱 실패 등 오류 시 폴백 선택지 */
function getFallbackChoices(section: ChoiceSection): ChoiceItem[] {
  const fallbacks: Record<ChoiceSection, ChoiceItem[]> = {
    characters: [
      { id: 'option_1', label: '기본 구성', summary: '원본 캐릭터 구성 유지' },
      { id: 'option_2', label: '용의자 추가', summary: '용의자를 한 명 더 추가해 플레이어를 혼란시킵니다' },
      { id: 'option_3', label: '관계 복잡화', summary: '캐릭터 간 삼각 관계 또는 가족 갈등 추가' },
      { id: 'option_4', label: '미니멀', summary: '핵심 인물만 남겨 단순하고 집중된 구성' },
    ],
    scenes: [
      { id: 'option_1', label: '기본 배치', summary: '원본 씬 배치 유지' },
      { id: 'option_2', label: '확장 지도', summary: '씬을 1~2개 더 추가해 탐색 범위를 넓힙니다' },
      { id: 'option_3', label: '밀실 구성', summary: '씬을 줄이고 폐쇄적인 공간에 집중합니다' },
      { id: 'option_4', label: '이중 현장', summary: '범행 현장이 두 곳으로 나뉘어 플레이어를 헷갈리게 합니다' },
    ],
    puzzleStructure: [
      { id: 'option_1', label: '기본 퍼즐', summary: '원본 퍼즐 구조 유지' },
      { id: 'option_2', label: '논리 추론', summary: '타임라인 재구성에 집중한 퍼즐' },
      { id: 'option_3', label: '심리 분석', summary: '동기와 거짓말을 파헤치는 퍼즐' },
      { id: 'option_4', label: '물증 연결', summary: '물리적 증거물을 연결하는 퍼즐' },
    ],
    atmosphere: [
      { id: 'option_1', label: '기본 분위기', summary: '원본 분위기 유지' },
      { id: 'option_2', label: '클래식 누아르', summary: '1950년대 스타일의 암울한 분위기' },
      { id: 'option_3', label: '코지 미스터리', summary: '아늑하고 밝은 톤의 아마추어 탐정 분위기' },
      { id: 'option_4', label: '심리 스릴러', summary: '긴장감 넘치는 현대적 반전 분위기' },
    ],
  };
  return fallbacks[section];
}

export const choiceGenerator = new ChoiceGenerator();
