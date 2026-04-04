/**
 * Unit tests for asset-slice.ts and project-slice.ts via useEditorStore.
 * Tests addAsset, updateAsset, deleteAsset, addWord, updateWord, deleteWord.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';
import type { AssetDefinition, Word } from '@gi-engine/core';
import { resetStore } from './test-helpers';

// Start each test with a fresh project
function setupProject() {
  useEditorStore.getState().newProject();
}

describe('AssetSlice', () => {
  beforeEach(() => {
    resetStore();
    setupProject();
  });

  // ── addAsset ────────────────────────────────────────────────────

  describe('addAsset', () => {
    const asset: AssetDefinition = {
      id: 'asset-1',
      type: 'image',
      src: 'images/bg.png',
      mimeType: 'image/png',
    };

    it('adds an asset to project.assets.items', () => {
      useEditorStore.getState().addAsset(asset);
      const { project } = useEditorStore.getState();
      expect(project?.assets.items['asset-1']).toEqual(asset);
    });

    it('marks project as dirty', () => {
      useEditorStore.getState().addAsset(asset);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });

    it('adds multiple assets independently', () => {
      const asset2: AssetDefinition = { id: 'asset-2', type: 'audio', src: 'sfx/click.mp3', mimeType: 'audio/mpeg' };
      useEditorStore.getState().addAsset(asset);
      useEditorStore.getState().addAsset(asset2);
      const { project } = useEditorStore.getState();
      expect(Object.keys(project!.assets.items)).toHaveLength(2);
    });
  });

  // ── updateAsset ─────────────────────────────────────────────────

  describe('updateAsset', () => {
    const asset: AssetDefinition = { id: 'a1', type: 'image', src: 'old.png', mimeType: 'image/png' };

    beforeEach(() => {
      useEditorStore.getState().addAsset(asset);
    });

    it('updates asset fields', () => {
      useEditorStore.getState().updateAsset('a1', { src: 'new.png' });
      expect(useEditorStore.getState().project?.assets.items['a1']?.src).toBe('new.png');
    });

    it('does nothing for unknown asset id', () => {
      useEditorStore.getState().updateAsset('unknown', { src: 'ghost.png' });
      expect(useEditorStore.getState().project?.assets.items['a1']?.src).toBe('old.png');
    });
  });

  // ── deleteAsset ─────────────────────────────────────────────────

  describe('deleteAsset', () => {
    const asset: AssetDefinition = { id: 'del-a', type: 'image', src: 'del.png', mimeType: 'image/png' };

    it('removes the asset from items', () => {
      useEditorStore.getState().addAsset(asset);
      useEditorStore.getState().deleteAsset('del-a');
      expect(useEditorStore.getState().project?.assets.items['del-a']).toBeUndefined();
    });

    it('marks project as dirty', () => {
      useEditorStore.getState().addAsset(asset);
      useEditorStore.setState(s => ({ meta: { ...s.meta, isDirty: false } }));
      useEditorStore.getState().deleteAsset('del-a');
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });
  });
});

// ── Word CRUD ─────────────────────────────────────────────────────

describe('Word CRUD (via AssetSlice)', () => {
  beforeEach(() => {
    resetStore();
    setupProject();
  });

  const word: Word = {
    id: 'w1',
    display: { ko: '칼', en: 'Knife' },
    caseId: 'case1',
    hint: { ko: '날카로운 도구', en: 'Sharp tool' },
  };

  describe('addWord', () => {
    it('appends word to words array', () => {
      useEditorStore.getState().addWord(word);
      expect(useEditorStore.getState().words).toHaveLength(1);
      expect(useEditorStore.getState().words[0].id).toBe('w1');
    });

    it('marks project as dirty', () => {
      useEditorStore.getState().addWord(word);
      expect(useEditorStore.getState().meta.isDirty).toBe(true);
    });
  });

  describe('updateWord', () => {
    beforeEach(() => {
      useEditorStore.getState().addWord(word);
    });

    it('updates word text', () => {
      useEditorStore.getState().updateWord('w1', { display: { ko: '총', en: 'Gun' } });
      expect(useEditorStore.getState().words[0].display.ko).toBe('총');
    });

    it('does not affect other words', () => {
      const word2: Word = { id: 'w2', display: { ko: '포크', en: 'Fork' }, caseId: 'case1', hint: { ko: '', en: '' } };
      useEditorStore.getState().addWord(word2);
      useEditorStore.getState().updateWord('w1', { display: { ko: '총', en: 'Gun' } });
      expect(useEditorStore.getState().words.find(w => w.id === 'w2')?.display.ko).toBe('포크');
    });
  });

  describe('deleteWord', () => {
    it('removes word by id', () => {
      useEditorStore.getState().addWord(word);
      useEditorStore.getState().deleteWord('w1');
      expect(useEditorStore.getState().words).toHaveLength(0);
    });

    it('preserves other words', () => {
      const word2: Word = { id: 'w2', display: { ko: '포크', en: 'Fork' }, caseId: 'case1', hint: { ko: '', en: '' } };
      useEditorStore.getState().addWord(word);
      useEditorStore.getState().addWord(word2);
      useEditorStore.getState().deleteWord('w1');
      expect(useEditorStore.getState().words).toHaveLength(1);
      expect(useEditorStore.getState().words[0].id).toBe('w2');
    });
  });
});
