// ============================================================
// Classic Mystery Template — 고전 추리 미스터리 기반 구조
// examples/classic-mystery 를 참고한 스타터 템플릿
// ============================================================

import type { GameDefinition } from '../models/types.js';
import type { ProjectTemplate, CreateProjectOptions } from './types.js';

function createClassicMysteryProject(options?: CreateProjectOptions): GameDefinition {
  const id = options?.projectId ?? 'classic-mystery-project';
  const title = options?.title ?? {
    ko: '클래식 미스터리',
    en: 'Classic Mystery',
  };

  return {
    id,
    version: '1.0.0',
    title,
    description: {
      ko: '고전 추리 미스터리 게임입니다. 현장을 조사하고 단서를 모아 범인을 찾으세요.',
      en: 'A classic mystery game. Investigate the scene, collect clues, and find the culprit.',
    },
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 2500,
      autoSaveInterval: 30000,
      debug: false,
      unlockMode: 'sequential',
      cssPrefix: 'gi-',
    },
    // 게임 단위 단어 사전
    words: {
      'word-clue-1': {
        id: 'word-clue-1',
        display: { ko: '단서', en: 'Clue' },
        category: 'evidence',
        hint: { ko: '현장에서 발견된 단서', en: 'A clue found at the scene' },
      },
      'word-alibi': {
        id: 'word-alibi',
        display: { ko: '알리바이', en: 'Alibi' },
        category: 'evidence',
        hint: { ko: '용의자의 알리바이', en: "Suspect's alibi" },
      },
      'word-suspect': {
        id: 'word-suspect',
        display: { ko: '용의자 A', en: 'Suspect A' },
        category: 'person',
        hint: { ko: '유력한 용의자', en: 'A prime suspect' },
      },
    },
    acts: [
      {
        id: 'act-1',
        title: { ko: '제1막: 사건 현장', en: 'Act 1: The Crime Scene' },
        cases: [
          {
            id: 'case-main',
            title: { ko: '핵심 사건', en: 'The Main Case' },
            description: {
              ko: '의문의 사건이 발생했다. 현장을 조사하고 진실을 밝혀라.',
              en: 'A mysterious incident has occurred. Investigate the scene and uncover the truth.',
            },
            prerequisites: [],
            thumbnail: '',
            scenes: [
              {
                id: 'scene-crime-scene',
                name: { ko: '사건 현장', en: 'Crime Scene' },
                background: '',
                dimensions: { width: 1920, height: 1080 },
                layers: [],
                hotspots: [
                  {
                    id: 'hotspot-clue-1',
                    name: '단서 1',
                    area: { type: 'rect', x: 400, y: 300, width: 200, height: 150 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '단서를 조사합니다', en: 'Examine the clue' },
                    action: {
                      type: 'examine',
                      content: {
                        ko: '중요한 단서가 발견되었습니다.',
                        en: 'An important clue has been found.',
                      },
                      collectibleWords: [
                        {
                          wordId: 'word-clue-1',
                          textMatch: { ko: '단서', en: 'Clue' },
                        },
                      ],
                    },
                  },
                  {
                    id: 'hotspot-next-scene',
                    name: '다음 씬으로',
                    area: { type: 'rect', x: 1700, y: 900, width: 150, height: 80 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '다음 장소로 이동합니다', en: 'Move to the next location' },
                    action: {
                      type: 'navigate',
                      targetSceneId: 'scene-interview',
                    },
                  },
                ],
              },
              {
                id: 'scene-interview',
                name: { ko: '심문 장면', en: 'Interview Scene' },
                background: '',
                dimensions: { width: 1920, height: 1080 },
                layers: [],
                hotspots: [
                  {
                    id: 'hotspot-suspect-1',
                    name: '용의자 1',
                    area: { type: 'rect', x: 600, y: 200, width: 300, height: 500 },
                    cursor: 'pointer',
                    ariaLabel: { ko: '용의자를 심문합니다', en: 'Interrogate the suspect' },
                    action: {
                      type: 'examine',
                      content: {
                        ko: '용의자가 알리바이를 주장합니다.',
                        en: 'The suspect claims to have an alibi.',
                      },
                      collectibleWords: [
                        {
                          wordId: 'word-alibi',
                          textMatch: { ko: '알리바이', en: 'Alibi' },
                        },
                        {
                          wordId: 'word-suspect',
                          textMatch: { ko: '용의자 A', en: 'Suspect A' },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
            puzzles: {
              main: {
                id: 'puzzle-deduction',
                title: { ko: '최종 추리', en: 'Final Deduction' },
                description: {
                  ko: '수집한 단서를 바탕으로 범인을 지목하세요.',
                  en: 'Based on the clues you have gathered, identify the culprit.',
                },
                type: 'fill_in_blank',
                template: {
                  segments: [
                    {
                      type: 'text',
                      content: { ko: '범인은 바로 ', en: 'The culprit is ' },
                    },
                    {
                      type: 'slot',
                      slotId: 'slot-culprit',
                      placeholder: { ko: '???', en: '???' },
                      acceptCategory: 'person',
                    },
                    {
                      type: 'text',
                      content: { ko: '이다.', en: '.' },
                    },
                  ],
                },
                answers: {
                  'slot-culprit': { correctWordId: 'word-suspect' },
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

export const classicMysteryTemplate: ProjectTemplate = {
  id: 'classic-mystery',
  name: { ko: '클래식 미스터리', en: 'Classic Mystery' },
  description: {
    ko: '현장 조사, 용의자 심문, 최종 추리 퍼즐이 포함된 고전 추리 게임 구조입니다.',
    en: 'A classic mystery game structure with crime scene investigation, suspect interrogation, and a final deduction puzzle.',
  },
  category: 'mystery',
  defaultProperties: {
    suggestedSceneCount: 2,
    suggestedActCount: 1,
    features: ['crime-scene', 'interrogation', 'deduction-puzzle', 'word-collection'],
  },
  createProject: createClassicMysteryProject,
};
