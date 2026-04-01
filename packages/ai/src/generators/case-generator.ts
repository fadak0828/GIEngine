/**
 * CaseBlueprint → Case 변환기
 * Blueprint에서 실제 게임 Case 오브젝트를 생성합니다.
 */

import type {
  Case,
  Scene,
  Hotspot,
  HotspotAction,
  Word,
  PuzzleSet,
  Puzzle,
  PuzzleTemplate,
  AnswerDefinition,
  AssetRef,
  Locale,
} from '@gi-engine/core';
import type { CaseBlueprint, BlueprintScene, BlueprintWord } from '../interview/types.js';
import { generatePuzzle } from './puzzle-generator.js';
import { generateStory } from './story-generator.js';

// ─── ID 생성 ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── tempId → 실제 ID 매핑 ──────────────────────────────────────────────────

function buildIdMap(blueprint: CaseBlueprint): {
  sceneIdMap: Map<string, string>;
  wordIdMap: Map<string, string>;
} {
  const sceneIdMap = new Map<string, string>();
  const wordIdMap = new Map<string, string>();

  for (const scene of blueprint.scenes) {
    sceneIdMap.set(scene.tempId, generateId());
  }
  for (const word of blueprint.words) {
    wordIdMap.set(word.tempId, generateId());
  }

  return { sceneIdMap, wordIdMap };
}

// ─── Blueprint 씬 → Scene 변환 ───────────────────────────────────────────────

function convertBlueprintScene(
  bScene: BlueprintScene,
  sceneId: string,
  sceneIdMap: Map<string, string>,
  wordIdMap: Map<string, string>,
): Scene {
  const hotspots: Hotspot[] = bScene.hotspotHints.map((hint) => {
    let action: HotspotAction;

    switch (hint.actionType) {
      case 'word_reveal': {
        const wordId = hint.relatedWordId ? (wordIdMap.get(hint.relatedWordId) ?? hint.relatedWordId) : generateId();
        action = {
          type: 'word_reveal',
          wordIds: [wordId],
          feedback: { ko: hint.contentHint, en: hint.contentHint },
        };
        break;
      }
      case 'navigate': {
        // contentHint에 대상 씬 tempId가 포함될 수 있음
        const targetTempId = hint.contentHint;
        const targetSceneId = sceneIdMap.get(targetTempId) ?? generateId();
        action = {
          type: 'navigate',
          targetSceneId,
          transition: 'fade',
        };
        break;
      }
      case 'examine_image':
        action = {
          type: 'examine_image',
          image: '' as AssetRef,
          caption: { ko: hint.label, en: hint.label },
          innerHotspots: [],
        };
        break;
      case 'examine':
      default:
        action = {
          type: 'examine',
          content: { ko: hint.contentHint, en: hint.contentHint },
          title: { ko: hint.label, en: hint.label },
          highlightedWords: [],
          collectibleWords: [],
        };
        break;
    }

    return {
      id: generateId(),
      name: hint.label,
      area: { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
      action,
      cursor: 'pointer',
      ariaLabel: { ko: hint.label, en: hint.label },
    };
  });

  return {
    id: sceneId,
    name: bScene.name,
    background: '' as AssetRef,
    dimensions: { width: 1920, height: 1080 },
    hotspots,
    layers: [],
  };
}

// ─── Blueprint 단어 → Word 변환 ──────────────────────────────────────────────

function convertBlueprintWord(bWord: BlueprintWord, wordId: string, caseId: string): Word {
  return {
    id: wordId,
    display: bWord.display,
    category: bWord.category,
    hint: bWord.hint,
    caseId,
  };
}

// ─── 퍼즐 생성 ───────────────────────────────────────────────────────────────

/**
 * mainPuzzle.requiredWordTempIds 검증 — 존재하지 않는 tempId 제거
 */
function validateRequiredWordTempIds(blueprint: CaseBlueprint): string[] {
  const existingTempIds = new Set(blueprint.words.map(w => w.tempId));
  return blueprint.mainPuzzle.requiredWordTempIds.filter(tid => existingTempIds.has(tid));
}

async function buildPuzzleSet(
  blueprint: CaseBlueprint,
  wordIdMap: Map<string, string>,
  caseId: string,
  locale: Locale,
): Promise<PuzzleSet> {
  // 단어 참조 검증 (Phase 2)
  const validRequiredTempIds = validateRequiredWordTempIds(blueprint);

  // 메인 퍼즐을 AI로 생성
  const requiredWords = validRequiredTempIds
    .map((tid) => {
      const word = blueprint.words.find((w) => w.tempId === tid);
      return word?.display[locale] ?? '';
    })
    .filter(Boolean);

  let mainPuzzle: Puzzle;
  try {
    const puzzleResult = await generatePuzzle({
      caseTitle: blueprint.title[locale],
      caseDescription: blueprint.description[locale],
      wordBank: requiredWords,
      locale,
    });

    // AI 생성 결과를 Puzzle 형식으로 변환
    const answers: Record<string, AnswerDefinition> = {};
    for (const [slotId, answerDef] of Object.entries(puzzleResult.answers)) {
      // correctWordId를 wordBank 단어명 → 실제 wordId로 매핑 시도
      const matchedWord = blueprint.words.find(
        (w) =>
          w.display[locale].toLowerCase() === answerDef.correctWordId.toLowerCase() ||
          w.tempId === answerDef.correctWordId,
      );
      const realWordId = matchedWord
        ? (wordIdMap.get(matchedWord.tempId) ?? answerDef.correctWordId)
        : answerDef.correctWordId;

      answers[slotId] = { correctWordId: realWordId };
    }

    mainPuzzle = {
      id: generateId(),
      title: puzzleResult.title,
      type: 'fill_in_blank',
      template: puzzleResult.template as PuzzleTemplate,
      answers,
    };
  } catch {
    // AI 생성 실패 시 기본 퍼즐 생성
    mainPuzzle = buildFallbackPuzzle(blueprint, wordIdMap, validRequiredTempIds, locale);
  }

  // 진범 캐릭터 정보 (character_id 퍼즐에서 correctCharacterId 설정용)
  const culpritName = blueprint.characters.find(c => c.role === 'culprit')?.name ?? '';

  // 서브 퍼즐 생성 — correctCharacterId/correctOrder 설정 포함 (Phase 2)
  const subPuzzles = blueprint.subPuzzles.map((sp) => {
    if (sp.type === 'character_id') {
      const names = sp.characterNames ?? [];
      // 진범을 포함하되 진범이 없으면 첫 번째 캐릭터로 폴백
      const hasCulprit = names.some(n => n === culpritName);
      const candidateNames = hasCulprit ? names : [...names, culpritName].filter(Boolean);
      const charSlots = candidateNames.map(name => {
        const wordEntry = blueprint.words.find(w => w.display?.[locale] === name || w.display?.ko === name);
        const answerId = wordEntry ? (wordIdMap.get(wordEntry.tempId) ?? wordEntry.tempId) : generateId();
        return {
          portrait: '' as string,
          nameSlotId: generateId(),
          answerId,
        };
      });
      return {
        id: generateId(),
        type: 'character_id' as const,
        title: { ko: '진범을 밝혀라', en: 'Identify the Culprit' },
        characters: charSlots,
      };
    }
    if (sp.type === 'timeline') {
      const slots = (sp.events ?? []).map(e => {
        const wordEntry = blueprint.words.find(w => w.display?.[locale] === e || w.display?.ko === e);
        const answerId = wordEntry ? (wordIdMap.get(wordEntry.tempId) ?? wordEntry.tempId) : generateId();
        return {
          slotId: generateId(),
          label: { ko: e, en: e },
          answerId,
        };
      });
      return {
        id: generateId(),
        type: 'timeline' as const,
        title: { ko: '사건 타임라인', en: 'Event Timeline' },
        slots,
      };
    }
    if (sp.type === 'relationship') {
      const nodes = (sp.characterNames ?? []).map(name => ({
        id: generateId(),
        label: { ko: name, en: name },
      }));
      return {
        id: generateId(),
        type: 'relationship' as const,
        title: { ko: '인물 관계도', en: 'Relationship Map' },
        nodes,
        edges: [],
      };
    }
    // scenario
    const scenarioSlots = [{ slotId: 'slot_1', placeholder: { ko: '???', en: '???' } }];
    const scenarioAnswers: Record<string, import('@gi-engine/core').AnswerDefinition> = {};
    const wordEntry = blueprint.words[0];
    if (wordEntry) {
      scenarioAnswers['slot_1'] = { correctWordId: wordIdMap.get(wordEntry.tempId) ?? wordEntry.tempId };
    }
    return {
      id: generateId(),
      type: 'scenario' as const,
      title: { ko: '상황 퍼즐', en: 'Scenario Puzzle' },
      template: { segments: [{ type: 'text' as const, content: { ko: sp.description, en: sp.description } }, ...scenarioSlots.map(s => ({ type: 'slot' as const, slotId: s.slotId, placeholder: s.placeholder }))] },
      answers: scenarioAnswers,
    };
  });

  return {
    main: mainPuzzle,
    sub: subPuzzles,
  };
}

function buildFallbackPuzzle(
  blueprint: CaseBlueprint,
  wordIdMap: Map<string, string>,
  validRequiredTempIds: string[],
  locale: Locale,
): Puzzle {
  const requiredTempIds = validRequiredTempIds.slice(0, 2);
  const segments: PuzzleTemplate['segments'] = [
    { type: 'text', content: { ko: '진범은 ', en: 'The culprit is ' } },
    { type: 'slot', slotId: 'slot_1', placeholder: { ko: '???', en: '???' } },
    { type: 'text', content: { ko: '이며, 동기는 ', en: ' and the motive is ' } },
    { type: 'slot', slotId: 'slot_2', placeholder: { ko: '???', en: '???' } },
    { type: 'text', content: { ko: '이다.', en: '.' } },
  ];

  const answers: Record<string, AnswerDefinition> = {};
  requiredTempIds.forEach((tid, i) => {
    const realId = wordIdMap.get(tid) ?? tid;
    answers[`slot_${i + 1}`] = { correctWordId: realId };
  });

  return {
    id: generateId(),
    title: blueprint.title,
    type: 'fill_in_blank',
    template: { segments },
    answers,
  };
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

export interface GenerateCaseResult {
  case: Case;
  words: Word[];
}

/**
 * 레드 헤링 단어 자동 선택 (Phase 2 퍼즐 깊이 강화)
 *
 * 메인 퍼즐에 사용되지 않는 단어 중 1~2개를 레드 헤링으로 선택합니다.
 * 이 단어들은 실제 Word 목록에 포함되어 플레이어를 혼란시킵니다.
 */
function selectRedHerringTempIds(blueprint: CaseBlueprint): string[] {
  const mainPuzzleIds = new Set(blueprint.mainPuzzle.requiredWordTempIds);
  const candidates = blueprint.words
    .filter(w => !mainPuzzleIds.has(w.tempId))
    .filter(w => ['person', 'object', 'place'].includes(w.category));

  // 최대 2개 선택 (인덱스 0, 2 — 다양성 확보)
  return candidates
    .filter((_, i) => i === 0 || i === 2)
    .map(w => w.tempId);
}

/**
 * CaseBlueprint에서 Case와 Word 목록을 생성합니다.
 */
export async function generateCaseFromBlueprint(
  blueprint: CaseBlueprint,
  locale: Locale,
): Promise<GenerateCaseResult> {
  const caseId = generateId();
  const { sceneIdMap, wordIdMap } = buildIdMap(blueprint);

  // 씬 변환
  const scenes: Scene[] = blueprint.scenes.map((bScene) => {
    const sceneId = sceneIdMap.get(bScene.tempId) ?? generateId();
    return convertBlueprintScene(bScene, sceneId, sceneIdMap, wordIdMap);
  });

  // 단어 변환 (레드 헤링 표시 포함)
  const redHerringIds = new Set(selectRedHerringTempIds(blueprint));
  const words: Word[] = blueprint.words.map((bWord) => {
    const wordId = wordIdMap.get(bWord.tempId) ?? generateId();
    const word = convertBlueprintWord(bWord, wordId, caseId);
    // 레드 헤링은 힌트에 약간의 오해 유발 표시 추가 (선택적)
    if (redHerringIds.has(bWord.tempId) && word.hint) {
      return {
        ...word,
        hint: {
          ko: word.hint.ko,
          en: word.hint.en,
        },
      };
    }
    return word;
  });

  // 퍼즐 생성
  const puzzles = await buildPuzzleSet(blueprint, wordIdMap, caseId, locale);

  // Case 조립
  const caseData: Case = {
    id: caseId,
    title: blueprint.title,
    description: blueprint.description,
    scenes,
    puzzles,
    prerequisites: [],
    thumbnail: '' as AssetRef,
  };

  return { case: caseData, words };
}
