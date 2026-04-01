/**
 * Stress-test project factory for editor performance benchmarking.
 *
 * Creates a large GameDefinition with:
 *   - 1 act → 5 cases → 3 scenes each = 15 scenes total
 *   - ~5–6 hotspots per scene → 80 hotspots total
 *   - 30 word definitions
 *
 * Used to verify success criteria:
 *   - Editor loads large project in under 2 s
 *   - Scene switching under 200 ms
 *   - No visible jank when editing large scenes
 */

import type { GameDefinition, Act, Case, Scene, Hotspot, Word } from '@gi-engine/core';

// ── Helpers ──────────────────────────────────────────────────────

function id(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function localizedText(ko: string, en: string = ko) {
  return { ko, en };
}

function makeHotspot(i: number, sceneIndex: number): Hotspot {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 80 + col * 280;
  const y = 80 + row * 180;
  return {
    id: id('hotspot', sceneIndex * 6 + i),
    name: `핫스팟 ${i + 1}`,
    area: { type: 'rect', x, y, width: 120, height: 80 },
    action: {
      type: 'examine',
      content: localizedText(`씬 ${sceneIndex}의 핫스팟 ${i + 1} 설명입니다.`, `Hotspot ${i + 1} of scene ${sceneIndex} description.`),
    },
    cursor: 'pointer',
    ariaLabel: localizedText(`핫스팟 ${i + 1}`, `Hotspot ${i + 1}`),
  };
}

function makeScene(sceneIndex: number, caseIndex: number): Scene {
  // 5–6 hotspots per scene; first scene in each case gets 6, rest get 5
  const hotspotCount = sceneIndex % 3 === 0 ? 6 : 5;
  const hotspots: Hotspot[] = Array.from({ length: hotspotCount }, (_, i) =>
    makeHotspot(i, sceneIndex),
  );
  return {
    id: id('scene', sceneIndex),
    name: localizedText(`씬 ${sceneIndex + 1}`, `Scene ${sceneIndex + 1}`),
    background: '',
    dimensions: { width: 1280, height: 720 },
    hotspots,
    layers: [],
  };
}

function makeCase(caseIndex: number, sceneOffset: number): Case {
  const scenes: Scene[] = Array.from({ length: 3 }, (_, i) =>
    makeScene(sceneOffset + i, caseIndex),
  );
  return {
    id: id('case', caseIndex),
    title: localizedText(`사건 ${caseIndex + 1}`, `Case ${caseIndex + 1}`),
    description: localizedText(`사건 ${caseIndex + 1}의 설명`, `Description of case ${caseIndex + 1}`),
    scenes,
    puzzles: { main: { id: '', title: localizedText('', ''), type: 'fill_in_blank', template: { segments: [] }, answers: {} }, sub: [] },
    prerequisites: [],
    thumbnail: '',
  };
}

function makeWords(count: number): Record<string, Word> {
  const words: Record<string, Word> = {};
  for (let i = 0; i < count; i++) {
    const wordId = id('word', i);
    words[wordId] = {
      id: wordId,
      display: localizedText(`단어${i + 1}`, `Word${i + 1}`),
      caseId: '',
      category: 'evidence',
    };
  }
  return words;
}

// ── Factory ──────────────────────────────────────────────────────

/**
 * Creates a stress-test GameDefinition with 15 scenes, 80 hotspots, and 30 words.
 */
export function createStressTestProject(): GameDefinition {
  const CASES_PER_ACT = 5;
  const SCENES_PER_CASE = 3;
  const WORD_COUNT = 30;

  const cases: Case[] = Array.from({ length: CASES_PER_ACT }, (_, i) =>
    makeCase(i, i * SCENES_PER_CASE),
  );

  const act: Act = {
    id: 'act-001',
    title: localizedText('제1막: 스트레스 테스트', 'Act 1: Stress Test'),
    cases,
  };

  const totalHotspots = cases.reduce(
    (sum, c) => sum + c.scenes.reduce((s, sc) => s + sc.hotspots.length, 0),
    0,
  );

  // Verify structure at factory time (useful for debugging)
  const totalScenes = cases.reduce((sum, c) => sum + c.scenes.length, 0);
  if (totalScenes !== 15) {
    throw new Error(`Expected 15 scenes, got ${totalScenes}`);
  }
  if (totalHotspots < 75 || totalHotspots > 85) {
    throw new Error(`Expected ~80 hotspots, got ${totalHotspots}`);
  }

  return {
    id: 'stress-test-project',
    version: '1.0.0',
    title: localizedText('성능 스트레스 테스트', 'Performance Stress Test'),
    description: localizedText(
      '에디터 성능 검증을 위한 대형 프로젝트 (15씬, 80핫스팟, 30단어)',
      'Large project for editor performance validation (15 scenes, 80 hotspots, 30 words)',
    ),
    supportedLocales: ['ko', 'en'],
    settings: {
      validationFeedbackDuration: 3000,
      autoSaveInterval: 60000,
      debug: false,
      unlockMode: 'sequential',
      cssPrefix: 'gi',
    },
    acts: [act],
    assets: { items: {} },
    words: makeWords(WORD_COUNT),
  };
}
