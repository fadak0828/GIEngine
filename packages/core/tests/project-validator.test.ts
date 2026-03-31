import { describe, it, expect } from 'vitest';
import { validateProjectDefinition } from '../src/validator/project-validator';
import type { GameDefinition, Word } from '../src/models/types';

function makeGame(overrides?: Partial<GameDefinition>): GameDefinition {
  return {
    id: 'game-1',
    version: '1.0.0',
    title: { ko: '테스트', en: 'Test' },
    description: { ko: '', en: '' },
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 1500,
      autoSaveInterval: 30000,
      debug: false,
      unlockMode: 'sequential',
      cssPrefix: 'gi',
    },
    acts: [],
    assets: { items: {} },
    ...overrides,
  };
}

function makeCase(id = 'case-1') {
  return {
    id,
    title: { ko: '사건', en: 'Case' },
    description: { ko: '', en: '' },
    scenes: [],
    puzzles: {
      main: {
        id: 'puzzle-1',
        title: { ko: '퍼즐', en: 'Puzzle' },
        type: 'fill_in_blank' as const,
        template: { segments: [] },
        answers: {},
      },
      sub: [],
    },
    prerequisites: [],
    thumbnail: '',
  };
}

function makeScene(id = 'scene-1') {
  return {
    id,
    name: { ko: '씬', en: 'Scene' },
    background: '',
    dimensions: { width: 1280, height: 720 },
    hotspots: [],
    layers: [],
  };
}

describe('validateProjectDefinition', () => {
  it('returns valid with no issues for empty project', () => {
    const result = validateProjectDefinition(makeGame(), []);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('returns valid for a well-formed scene and hotspot', () => {
    const scene = makeScene();
    const cas = makeCase();
    cas.scenes.push(scene);
    const game = makeGame({
      acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
    });
    const result = validateProjectDefinition(game, []);
    expect(result.isValid).toBe(true);
  });

  describe('broken_scene_ref', () => {
    it('reports error for navigate hotspot pointing to non-existent scene', () => {
      const scene = makeScene('scene-1');
      scene.hotspots.push({
        id: 'h1',
        name: 'door',
        area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
        action: { type: 'navigate', targetSceneId: 'scene-MISSING' },
        cursor: 'pointer',
        ariaLabel: { ko: '', en: '' },
      });
      const cas = makeCase();
      cas.scenes.push(scene);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(false);
      expect(result.errorCount).toBe(1);
      expect(result.issues[0].kind).toBe('broken_scene_ref');
      expect(result.issues[0].severity).toBe('error');
    });

    it('no error when navigate target scene exists', () => {
      const scene1 = makeScene('scene-1');
      const scene2 = makeScene('scene-2');
      scene1.hotspots.push({
        id: 'h1',
        name: 'door',
        area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
        action: { type: 'navigate', targetSceneId: 'scene-2' },
        cursor: 'pointer',
        ariaLabel: { ko: '', en: '' },
      });
      const cas = makeCase();
      cas.scenes.push(scene1, scene2);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(true);
    });
  });

  describe('broken_word_ref', () => {
    it('reports error for word_reveal referencing missing word', () => {
      const scene = makeScene();
      scene.hotspots.push({
        id: 'h1',
        name: 'clue',
        area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
        action: { type: 'word_reveal', wordIds: ['word-MISSING'] },
        cursor: 'pointer',
        ariaLabel: { ko: '', en: '' },
      });
      const cas = makeCase();
      cas.scenes.push(scene);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].kind).toBe('broken_word_ref');
    });

    it('no error when word_reveal references existing word', () => {
      const word: Word = { id: 'word-1', caseId: 'case-1', display: { ko: '칼', en: 'knife' } };
      const scene = makeScene();
      scene.hotspots.push({
        id: 'h1',
        name: 'clue',
        area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
        action: { type: 'word_reveal', wordIds: ['word-1'] },
        cursor: 'pointer',
        ariaLabel: { ko: '', en: '' },
      });
      const cas = makeCase();
      cas.scenes.push(scene);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, [word]);
      expect(result.isValid).toBe(true);
    });

    it('reports error for examine collectible referencing missing word', () => {
      const scene = makeScene();
      scene.hotspots.push({
        id: 'h1',
        name: 'book',
        area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
        action: { type: 'examine', content: { ko: '책', en: 'book' }, collectibleWords: [{ wordId: 'word-MISSING' }] },
        cursor: 'pointer',
        ariaLabel: { ko: '', en: '' },
      });
      const cas = makeCase();
      cas.scenes.push(scene);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].kind).toBe('broken_word_ref');
    });
  });

  describe('missing_asset', () => {
    it('reports warning for scene background not in asset list', () => {
      const scene = makeScene();
      scene.background = 'asset-MISSING';
      const cas = makeCase();
      cas.scenes.push(scene);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(true); // warning, not error
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].kind).toBe('missing_asset');
      expect(result.issues[0].severity).toBe('warning');
    });

    it('no warning when background asset exists', () => {
      const scene = makeScene();
      scene.background = 'asset-1';
      const cas = makeCase();
      cas.scenes.push(scene);
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
        assets: { items: { 'asset-1': { id: 'asset-1', type: 'image', url: '/img.png', name: 'img' } } },
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(true);
      expect(result.warningCount).toBe(0);
    });
  });

  describe('empty_puzzle_answers', () => {
    it('reports warning when puzzle has slots but no answers', () => {
      const cas = makeCase();
      cas.puzzles.main.template = {
        segments: [{ type: 'slot', slotId: 's1' }],
      };
      cas.puzzles.main.answers = {};
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(true); // warning only
      expect(result.warningCount).toBe(1);
      expect(result.issues[0].kind).toBe('empty_puzzle_answers');
    });

    it('no warning when puzzle has no slots', () => {
      const cas = makeCase();
      cas.puzzles.main.template = { segments: [{ type: 'text', text: { ko: '텍스트', en: 'text' } }] };
      const game = makeGame({
        acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
      });
      const result = validateProjectDefinition(game, []);
      expect(result.isValid).toBe(true);
      expect(result.warningCount).toBe(0);
    });
  });

  it('counts errors and warnings correctly', () => {
    const word: Word = { id: 'word-1', caseId: 'case-1', display: { ko: '단어', en: 'word' } };
    const scene = makeScene();
    // 1 broken_scene_ref error
    scene.hotspots.push({
      id: 'h1',
      name: 'door',
      area: { type: 'rect', x: 0, y: 0, width: 10, height: 10 },
      action: { type: 'navigate', targetSceneId: 'no-such-scene' },
      cursor: 'pointer',
      ariaLabel: { ko: '', en: '' },
    });
    // 1 missing_asset warning
    scene.background = 'no-asset';
    const cas = makeCase();
    cas.scenes.push(scene);
    const game = makeGame({
      acts: [{ id: 'act-1', title: { ko: '막', en: 'Act' }, cases: [cas] }],
    });
    const result = validateProjectDefinition(game, [word]);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(result.isValid).toBe(false);
  });
});
