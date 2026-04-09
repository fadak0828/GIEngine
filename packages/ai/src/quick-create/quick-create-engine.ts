/**
 * QuickCreateEngine — 1문장 입력으로 전체 CaseBlueprint 생성
 *
 * gemini-2.5-pro로 블루프린트 생성, gemini-2.5-flash로 선택지 생성
 */

import { getProvider } from '../providers/factory.js';
import type { CaseBlueprint } from '../interview/types.js';
import { buildSentenceToBlueprintPrompt } from './prompts/sentence-to-blueprint-prompt.js';
import { buildChoiceRefinedPrompt } from './prompts/choice-refined-prompt.js';
import { choiceGenerator } from './choice-generator.js';
import type {
  QuickCreateOptions,
  QuickCreateResult,
  OnQuickCreateProgress,
  ChoiceSelection,
  SectionChoices,
} from './types.js';

export interface StartFromSentenceOptions extends QuickCreateOptions {
  /** 선택지 생성 포함 여부 (기본: false) */
  withChoices?: boolean;
  /** 진행률 콜백 */
  onProgress?: OnQuickCreateProgress;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class QuickCreateEngine {
  private readonly proModel = 'gemini-2.5-pro';

  /**
   * 1문장 핵심 단서에서 전체 CaseBlueprint를 생성합니다.
   *
   * @param sentence 핵심 문장 (예: "점심시간 카페에서 파티시에 바리스타가 독을 넣었다")
   * @param options  선택적 생성 옵션
   */
  async startFromSentence(
    sentence: string,
    options: StartFromSentenceOptions = {},
  ): Promise<QuickCreateResult> {
    const { withChoices = false, onProgress, locale = 'ko', ...createOptions } = options;
    const sessionId = generateId();

    onProgress?.({
      step: 'blueprint_generating',
      message: '사건 구조를 생성하는 중...',
      percent: 10,
    });

    const blueprint = await this.generateBlueprint(sentence, sessionId, createOptions, locale);

    onProgress?.({
      step: 'blueprint_done',
      message: '사건 구조 생성 완료',
      percent: withChoices ? 50 : 100,
    });

    if (!withChoices) {
      onProgress?.({ step: 'completed', message: '생성 완료', percent: 100 });
      return { blueprint };
    }

    onProgress?.({
      step: 'choices_generating',
      message: '선택지를 생성하는 중...',
      percent: 60,
    });

    const choices = await choiceGenerator.generateAllChoices(blueprint, sentence);

    onProgress?.({
      step: 'choices_done',
      message: '선택지 생성 완료',
      percent: 100,
    });

    onProgress?.({ step: 'completed', message: '생성 완료', percent: 100 });

    return { blueprint, choices };
  }

  /**
   * 사용자가 선택지를 고른 후 블루프린트를 개선 재생성합니다.
   * 선택 사항을 프롬프트에 반영하여 원본 설정은 유지하면서 해당 섹션만 개선합니다.
   */
  async applyChoicesToBlueprint(
    originalSentence: string,
    currentBlueprint: CaseBlueprint,
    selection: ChoiceSelection,
    choices: SectionChoices,
    options: QuickCreateOptions = {},
    onProgress?: OnQuickCreateProgress,
  ): Promise<QuickCreateResult> {
    const { locale = 'ko' } = options;
    const sessionId = currentBlueprint.sessionId;

    onProgress?.({
      step: 'applying_selection',
      message: '선택 사항을 반영하는 중...',
      percent: 20,
    });

    const prompt = buildChoiceRefinedPrompt(
      originalSentence,
      currentBlueprint,
      selection,
      choices,
      {},
      locale,
    );

    onProgress?.({
      step: 'blueprint_generating',
      message: '개선된 사건 구조 생성 중...',
      percent: 50,
    });

    const refinedBlueprint = await this.generateBlueprintFromPrompt(prompt, sessionId);

    onProgress?.({
      step: 'blueprint_done',
      message: '선택 사항 반영 완료',
      percent: 90,
    });

    onProgress?.({ step: 'completed', message: '생성 완료', percent: 100 });

    return { blueprint: refinedBlueprint };
  }

  // ─── 내부 메서드 ─────────────────────────────────────────────────────────────

  private async generateBlueprint(
    sentence: string,
    sessionId: string,
    options: QuickCreateOptions,
    locale: 'ko' | 'en',
  ): Promise<CaseBlueprint> {
    const prompt = buildSentenceToBlueprintPrompt(sentence, sessionId, options, locale);
    return this.generateBlueprintFromPrompt(prompt, sessionId);
  }

  private async generateBlueprintFromPrompt(prompt: string, sessionId: string): Promise<CaseBlueprint> {
    const raw = await getProvider().generateText(prompt, this.proModel);
    return this.parseAndEnrichBlueprint(raw, sessionId);
  }

  private parseAndEnrichBlueprint(raw: string, sessionId: string): CaseBlueprint {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed: Omit<CaseBlueprint, 'id' | 'sessionId' | 'generatedAt'>;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`CaseBlueprint 파싱 실패: ${String(err)}\n원문: ${cleaned.slice(0, 200)}`);
    }

    this.validateBlueprint(parsed);

    return {
      id: generateId(),
      sessionId,
      generatedAt: Date.now(),
      ...parsed,
    };
  }

  private validateBlueprint(
    bp: Partial<CaseBlueprint & { id?: string; sessionId?: string; generatedAt?: number }>,
  ): void {
    if (!bp.title || !bp.characters || !bp.scenes || !bp.words || !bp.mainPuzzle) {
      throw new Error(
        'CaseBlueprint 검증 실패: 필수 필드(title, characters, scenes, words, mainPuzzle) 누락',
      );
    }
    if (!Array.isArray(bp.characters) || bp.characters.length < 2) {
      throw new Error('캐릭터가 최소 2명 이상 필요합니다');
    }
    if (!Array.isArray(bp.scenes) || bp.scenes.length < 2) {
      throw new Error('씬이 최소 2개 이상 필요합니다');
    }
    if (!Array.isArray(bp.words) || bp.words.length < 5) {
      throw new Error('단어가 최소 5개 이상 필요합니다');
    }
  }

  /**
   * AI 실패 시 최소한의 기본 블루프린트를 반환하는 폴백
   */
  createFallbackBlueprint(sentence: string): CaseBlueprint {
    const sessionId = generateId();
    const now = Date.now();

    return {
      id: generateId(),
      sessionId,
      generatedAt: now,
      title: { ko: '미완성 사건', en: 'Incomplete Case' },
      description: { ko: sentence, en: sentence },
      genre: 'mystery',
      characters: [
        {
          name: '용의자 A',
          role: 'culprit',
          description: '핵심 용의자',
          alibi: '없음',
          relationships: [],
        },
        {
          name: '피해자 B',
          role: 'victim',
          description: '사건의 피해자',
          relationships: [],
        },
      ],
      scenes: [
        {
          tempId: 'scene_1',
          name: { ko: '범행 현장', en: 'Crime Scene' },
          description: 'A mysterious crime scene',
          connections: [],
          hotspotHints: [
            {
              label: '단서',
              actionType: 'examine',
              contentHint: '무언가 이상한 것이 있다',
            },
          ],
        },
      ],
      words: [
        {
          tempId: 'word_1',
          display: { ko: '용의자 A', en: 'Suspect A' },
          category: 'person',
          hint: { ko: '진범으로 의심되는 인물', en: 'A suspicious person' },
          sourceSceneTempId: 'scene_1',
        },
        {
          tempId: 'word_2',
          display: { ko: '범행 현장', en: 'Crime Scene' },
          category: 'place',
          hint: { ko: '사건이 발생한 장소', en: 'Where it happened' },
          sourceSceneTempId: 'scene_1',
        },
      ],
      mainPuzzle: {
        titleHint: '범인을 밝혀라',
        descriptionHint: '수집한 단서를 조합하세요',
        templateDescription: '진범은 [빈칸1]이다',
        requiredWordTempIds: ['word_1'],
      },
      subPuzzles: [],
    };
  }
}

export const quickCreateEngine = new QuickCreateEngine();
