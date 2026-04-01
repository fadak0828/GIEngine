// ============================================================
// Blank Template — 빈 프로젝트 (기본 설정만 포함)
// ============================================================

import type { GameDefinition } from '../models/types.js';
import type { ProjectTemplate, CreateProjectOptions } from './types.js';

function createBlankProject(options?: CreateProjectOptions): GameDefinition {
  const id = options?.projectId ?? 'new-project';
  const title = options?.title ?? { ko: '새 프로젝트', en: 'New Project' };

  return {
    id,
    version: '1.0.0',
    title,
    description: { ko: '', en: '' },
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 2500,
      autoSaveInterval: 30000,
      debug: false,
      unlockMode: 'sequential',
      cssPrefix: 'gi-',
    },
    acts: [
      {
        id: 'act-1',
        title: { ko: '제1막', en: 'Act 1' },
        cases: [
          {
            id: 'case-1',
            title: { ko: '사건 1', en: 'Case 1' },
            description: { ko: '', en: '' },
            prerequisites: [],
            thumbnail: '',
            scenes: [
              {
                id: 'scene-1',
                name: { ko: '씬 1', en: 'Scene 1' },
                background: '',
                dimensions: { width: 1920, height: 1080 },
                hotspots: [],
                layers: [],
              },
            ],
            puzzles: {
              main: {
                id: 'puzzle-main',
                title: { ko: '추리 퍼즐', en: 'Deduction Puzzle' },
                description: { ko: '', en: '' },
                type: 'fill_in_blank',
                template: { segments: [] },
                answers: {},
              },
              sub: [],
            },
          },
        ],
      },
    ],
    assets: { items: {} },
    words: {},
  };
}

export const blankTemplate: ProjectTemplate = {
  id: 'blank',
  name: { ko: '빈 프로젝트', en: 'Blank Project' },
  description: {
    ko: '아무 콘텐츠도 없는 빈 프로젝트입니다. 처음부터 직접 구성하고 싶을 때 사용하세요.',
    en: 'An empty project with no content. Use this when you want to build everything from scratch.',
  },
  category: 'blank',
  defaultProperties: {
    suggestedSceneCount: 1,
    suggestedActCount: 1,
    features: [],
  },
  createProject: createBlankProject,
};
