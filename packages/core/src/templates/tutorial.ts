// ============================================================
// Tutorial Template — 3씬 구성의 튜토리얼 게임
// 엔진 기능(이동, 단서 수집, 퍼즐)을 순서대로 가르칩니다
// ============================================================

import type { GameDefinition } from '../models/types.js';
import type { ProjectTemplate, CreateProjectOptions } from './types.js';

function createTutorialProject(options?: CreateProjectOptions): GameDefinition {
  const id = options?.projectId ?? 'tutorial-project';
  const title = options?.title ?? {
    ko: '튜토리얼',
    en: 'Tutorial',
  };

  return {
    id,
    version: '1.0.0',
    title,
    description: {
      ko: 'GI Engine의 기본 기능을 단계별로 배울 수 있는 튜토리얼입니다.',
      en: 'A step-by-step tutorial to learn the basic features of GI Engine.',
    },
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 3000,
      autoSaveInterval: 30000,
      debug: true,
      unlockMode: 'sequential',
      cssPrefix: 'gi-',
    },
    // 게임 단위 단어 사전
    words: {
      'word-red-cloth': {
        id: 'word-red-cloth',
        display: { ko: '빨간 천 조각', en: 'Red Cloth Fragment' },
        category: 'evidence',
        hint: { ko: '현장에서 발견된 빨간 천 조각', en: 'A red cloth fragment found at the scene' },
      },
      'word-letter': {
        id: 'word-letter',
        display: { ko: '편지 조각', en: 'Letter Fragment' },
        category: 'evidence',
        hint: { ko: '현장에서 발견된 편지 조각', en: 'A letter fragment found at the scene' },
      },
      'word-guilty': {
        id: 'word-guilty',
        display: { ko: '범인', en: 'Culprit' },
        category: 'person',
        hint: { ko: '이 튜토리얼의 정답 단어', en: 'The correct answer for this tutorial' },
      },
    },
    acts: [
      {
        id: 'act-tutorial',
        title: { ko: '튜토리얼', en: 'Tutorial' },
        cases: [
          {
            id: 'case-tutorial',
            title: { ko: '기초 탐정 훈련', en: 'Basic Detective Training' },
            description: {
              ko: '탐정의 기본 기술을 배워봅시다. 이동, 단서 수집, 추리 퍼즐을 차례로 연습합니다.',
              en: "Let's learn the basic skills of a detective. Practice movement, clue collection, and deduction puzzles in order.",
            },
            prerequisites: [],
            thumbnail: '',
            scenes: [
              // Scene 1: 이동 튜토리얼
              {
                id: 'scene-tutorial-move',
                name: { ko: '1단계: 이동하기', en: 'Step 1: Moving Around' },
                background: '',
                dimensions: { width: 1920, height: 1080 },
                layers: [],
                hotspots: [
                  {
                    id: 'hotspot-tutorial-intro',
                    name: '튜토리얼 안내',
                    area: { type: 'rect', x: 760, y: 440, width: 400, height: 200 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '튜토리얼 시작', en: 'Start tutorial' },
                    action: {
                      type: 'examine',
                      content: {
                        ko: '안녕하세요! 이 튜토리얼에서 GI Engine의 기본 기능을 배우게 됩니다.\n\n먼저 화면 우측의 문을 클릭하여 다음 씬으로 이동해 보세요.',
                        en: 'Welcome! In this tutorial, you will learn the basic features of GI Engine.\n\nFirst, click the door on the right side of the screen to move to the next scene.',
                      },
                    },
                  },
                  {
                    id: 'hotspot-door-to-clue',
                    name: '다음 씬 입구',
                    area: { type: 'rect', x: 1650, y: 300, width: 200, height: 600 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '단서 수집 씬으로 이동', en: 'Go to clue collection scene' },
                    action: {
                      type: 'navigate',
                      targetSceneId: 'scene-tutorial-clues',
                    },
                  },
                ],
              },
              // Scene 2: 단서 수집 튜토리얼
              {
                id: 'scene-tutorial-clues',
                name: { ko: '2단계: 단서 수집', en: 'Step 2: Collecting Clues' },
                background: '',
                dimensions: { width: 1920, height: 1080 },
                layers: [
                  {
                    id: 'layer-clue-marker',
                    image: '',
                    position: { x: 300, y: 400 },
                    zIndex: 1,
                    visible: true,
                  },
                ],
                hotspots: [
                  {
                    id: 'hotspot-clue-a',
                    name: '단서 A',
                    area: { type: 'circle', cx: 400, cy: 500, radius: 80 },
                    cursor: 'zoom-in',
                    ariaLabel: { ko: '빨간 천 조각 조사', en: 'Examine red cloth fragment' },
                    action: {
                      type: 'examine',
                      content: {
                        ko: '빨간 천 조각을 발견했습니다. 단서로 수집됩니다.',
                        en: 'You found a red cloth fragment. It has been added to your clues.',
                      },
                      collectibleWords: [
                        {
                          wordId: 'word-red-cloth',
                          textMatch: { ko: '빨간 천 조각', en: 'Red Cloth Fragment' },
                        },
                      ],
                    },
                  },
                  {
                    id: 'hotspot-clue-b',
                    name: '단서 B',
                    area: { type: 'rect', x: 900, y: 350, width: 180, height: 180 },
                    cursor: 'zoom-in',
                    ariaLabel: { ko: '편지 조각 조사', en: 'Examine letter fragment' },
                    action: {
                      type: 'examine',
                      content: {
                        ko: '편지 조각을 발견했습니다. 무언가 쓰여 있습니다.',
                        en: 'You found a letter fragment. Something is written on it.',
                      },
                      collectibleWords: [
                        {
                          wordId: 'word-letter',
                          textMatch: { ko: '편지 조각', en: 'Letter Fragment' },
                        },
                      ],
                    },
                  },
                  {
                    id: 'hotspot-door-to-puzzle',
                    name: '퍼즐 씬으로',
                    area: { type: 'rect', x: 1650, y: 300, width: 200, height: 600 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '추리 퍼즐 씬으로 이동', en: 'Go to deduction puzzle scene' },
                    action: {
                      type: 'navigate',
                      targetSceneId: 'scene-tutorial-puzzle',
                    },
                  },
                ],
              },
              // Scene 3: 추리 퍼즐 튜토리얼
              {
                id: 'scene-tutorial-puzzle',
                name: { ko: '3단계: 추리 퍼즐', en: 'Step 3: Deduction Puzzle' },
                background: '',
                dimensions: { width: 1920, height: 1080 },
                layers: [],
                hotspots: [
                  {
                    id: 'hotspot-puzzle-guide',
                    name: '퍼즐 안내',
                    area: { type: 'rect', x: 760, y: 440, width: 400, height: 200 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '추리 퍼즐 안내', en: 'Deduction puzzle guide' },
                    action: {
                      type: 'examine',
                      content: {
                        ko: '잘 오셨습니다! 수집한 단서 카드를 퍼즐 판의 빈칸에 끌어다 놓아 추리를 완성하세요.\n\n화면 하단의 [추리 시작] 버튼을 눌러 퍼즐을 시작할 수 있습니다.',
                        en: 'Welcome! Drag the clue cards you collected into the blank spaces on the puzzle board to complete your deduction.\n\nClick the [Start Deduction] button at the bottom of the screen to begin.',
                      },
                    },
                  },
                ],
              },
            ],
            puzzles: {
              main: {
                id: 'puzzle-tutorial-main',
                title: { ko: '첫 번째 추리', en: 'First Deduction' },
                description: {
                  ko: '수집한 단서를 빈칸에 끌어다 놓아 추리를 완성하세요.',
                  en: 'Drag the clues you collected into the blank spaces to complete your deduction.',
                },
                type: 'fill_in_blank',
                template: {
                  segments: [
                    {
                      type: 'text',
                      content: { ko: '발견된 ', en: 'The discovered ' },
                    },
                    {
                      type: 'slot',
                      slotId: 'slot-evidence',
                      placeholder: { ko: '[단서]', en: '[evidence]' },
                      acceptCategory: 'evidence',
                    },
                    {
                      type: 'text',
                      content: {
                        ko: '은(는) 사건과 연관이 있다. 따라서 이 사건의 핵심은 ',
                        en: ' is related to the incident. Therefore, the key to this case is ',
                      },
                    },
                    {
                      type: 'slot',
                      slotId: 'slot-conclusion',
                      placeholder: { ko: '[결론]', en: '[conclusion]' },
                      acceptCategory: 'person',
                    },
                    {
                      type: 'text',
                      content: { ko: '이다.', en: '.' },
                    },
                  ],
                },
                answers: {
                  'slot-evidence': { correctWordId: 'word-red-cloth' },
                  'slot-conclusion': { correctWordId: 'word-guilty' },
                },
              },
              sub: [],
            },
          },
        ],
      },
    ],
    assets: { items: {} },
  };
}

export const tutorialTemplate: ProjectTemplate = {
  id: 'tutorial',
  name: { ko: '튜토리얼', en: 'Tutorial' },
  description: {
    ko: '3단계(이동 → 단서 수집 → 추리 퍼즐)로 구성된 튜토리얼 게임입니다. 엔진 사용법을 배우는 데 적합합니다.',
    en: 'A 3-step tutorial game (movement → clue collection → deduction puzzle). Ideal for learning how to use the engine.',
  },
  category: 'tutorial',
  defaultProperties: {
    suggestedSceneCount: 3,
    suggestedActCount: 1,
    features: ['navigation', 'clue-collection', 'deduction-puzzle', 'layers'],
  },
  createProject: createTutorialProject,
};
