/**
 * Phase C-1 예제 시나리오 유닛 테스트
 *
 * examples/ 디렉토리의 3개 game.json 파일이 GameDefinition 스키마를 준수하고,
 * 퍼즐 답안 슬롯, 단어 참조, 씬 내비게이션이 내부적으로 일관성을 가지는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { GameDefinition, HotspotAction, WordRevealAction, NavigateAction, CompositeAction } from '../src/models/types.js';
import { createInitialSaveState } from '../src/save/initial-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');

function loadExample(name: string): GameDefinition {
  const raw = readFileSync(resolve(EXAMPLES_DIR, name, 'game.json'), 'utf-8');
  return JSON.parse(raw) as GameDefinition;
}

/**
 * 핫스팟 액션에서 word_reveal wordIds를 재귀적으로 수집
 */
function collectWordIdsFromAction(action: HotspotAction): string[] {
  const ids: string[] = [];
  if (action.type === 'word_reveal') {
    ids.push(...(action as WordRevealAction).wordIds);
  } else if (action.type === 'composite') {
    for (const a of (action as CompositeAction).actions) {
      ids.push(...collectWordIdsFromAction(a));
    }
  }
  return ids;
}

/**
 * 게임 정의에서 모든 navigate targetSceneId를 수집
 */
function collectNavigateTargets(game: GameDefinition): string[] {
  const targets: string[] = [];
  for (const act of game.acts) {
    for (const cas of act.cases) {
      for (const scene of cas.scenes) {
        for (const hs of scene.hotspots) {
          function walkAction(action: HotspotAction) {
            if (action.type === 'navigate') {
              targets.push((action as NavigateAction).targetSceneId);
            } else if (action.type === 'composite') {
              for (const a of (action as CompositeAction).actions) walkAction(a);
            }
          }
          walkAction(hs.action);
        }
      }
    }
  }
  return targets;
}

/**
 * 게임 정의에서 메인 퍼즐 템플릿의 slot IDs를 수집
 */
function collectPuzzleSlotIds(game: GameDefinition): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const act of game.acts) {
    for (const cas of act.cases) {
      const slotIds: string[] = [];
      for (const seg of cas.puzzles.main.template.segments) {
        if (seg.type === 'slot') slotIds.push(seg.slotId);
      }
      result[cas.id] = slotIds;
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Classic Mystery
// ──────────────────────────────────────────────────────────────────────────────
describe('Classic Mystery (저택의 독살 사건)', () => {
  let game: GameDefinition;

  it('JSON 파일 로드 성공', () => {
    game = loadExample('classic-mystery');
    expect(game).toBeDefined();
    expect(game.id).toBe('classic-mystery-manor');
  });

  it('필수 최상위 필드 존재', () => {
    game = loadExample('classic-mystery');
    expect(game.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(game.title.ko).toBeTruthy();
    expect(game.title.en).toBeTruthy();
    expect(game.supportedLocales).toContain('ko');
    expect(game.supportedLocales).toContain('en');
    expect(game.settings).toBeDefined();
    expect(game.acts.length).toBeGreaterThan(0);
    expect(game.assets.items).toBeDefined();
    expect(game.words).toBeDefined();
  });

  it('2개 씬 포함', () => {
    game = loadExample('classic-mystery');
    const cases = game.acts.flatMap(a => a.cases);
    expect(cases.length).toBe(1);
    expect(cases[0].scenes.length).toBe(2);
    expect(cases[0].scenes.map(s => s.id)).toContain('scene-grand-hall');
    expect(cases[0].scenes.map(s => s.id)).toContain('scene-study');
  });

  it('내비게이션 참조가 존재하는 씬 가리킴', () => {
    game = loadExample('classic-mystery');
    const allSceneIds = game.acts.flatMap(a => a.cases.flatMap(c => c.scenes.map(s => s.id)));
    const navTargets = collectNavigateTargets(game);
    for (const target of navTargets) {
      expect(allSceneIds, `씬 "${target}" 없음`).toContain(target);
    }
  });

  it('단어 목록에 7개 단어', () => {
    game = loadExample('classic-mystery');
    expect(Object.keys(game.words!).length).toBe(7);
  });

  it('모든 word_reveal wordId가 words 섹션에 존재', () => {
    game = loadExample('classic-mystery');
    const wordKeys = new Set(Object.keys(game.words!));
    for (const act of game.acts) {
      for (const cas of act.cases) {
        for (const scene of cas.scenes) {
          for (const hs of scene.hotspots) {
            const ids = collectWordIdsFromAction(hs.action);
            for (const id of ids) {
              expect(wordKeys, `단어 "${id}" 없음`).toContain(id);
            }
          }
        }
      }
    }
  });

  it('메인 퍼즐 answers 키가 template slot IDs와 일치', () => {
    game = loadExample('classic-mystery');
    const slotMap = collectPuzzleSlotIds(game);
    for (const act of game.acts) {
      for (const cas of act.cases) {
        const slotIds = new Set(slotMap[cas.id]);
        const answerKeys = new Set(Object.keys(cas.puzzles.main.answers));
        // 모든 answer 키는 slot ID여야 함
        for (const key of answerKeys) {
          expect(slotIds, `answer 키 "${key}"가 slot IDs에 없음`).toContain(key);
        }
      }
    }
  });

  it('메인 퍼즐 correctWordId가 words 섹션에 존재', () => {
    game = loadExample('classic-mystery');
    const wordKeys = new Set(Object.keys(game.words!));
    for (const act of game.acts) {
      for (const cas of act.cases) {
        for (const [slotId, answer] of Object.entries(cas.puzzles.main.answers)) {
          expect(wordKeys, `슬롯 "${slotId}"의 정답 단어 "${answer.correctWordId}" 없음`).toContain(answer.correctWordId);
          for (const partial of answer.partiallyCorrectWordIds ?? []) {
            expect(wordKeys, `슬롯 "${slotId}"의 부분 정답 단어 "${partial}" 없음`).toContain(partial);
          }
        }
      }
    }
  });

  it('서브 퍼즐 2개 (character_id, timeline)', () => {
    game = loadExample('classic-mystery');
    const sub = game.acts[0].cases[0].puzzles.sub;
    expect(sub.length).toBe(2);
    expect(sub.map(p => p.type)).toContain('character_id');
    expect(sub.map(p => p.type)).toContain('timeline');
  });

  it('createInitialSaveState 정상 생성', () => {
    game = loadExample('classic-mystery');
    expect(() => createInitialSaveState(game)).not.toThrow();
    const state = createInitialSaveState(game);
    expect(state.gameId).toBe('classic-mystery-manor');
    expect(Object.keys(state.caseStates).length).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Modern Mystery
// ──────────────────────────────────────────────────────────────────────────────
describe('Modern Mystery (기업 기밀 유출 사건)', () => {
  let game: GameDefinition;

  it('JSON 파일 로드 성공', () => {
    game = loadExample('modern-mystery');
    expect(game).toBeDefined();
    expect(game.id).toBe('modern-mystery-leak');
  });

  it('4개 씬 포함', () => {
    game = loadExample('modern-mystery');
    const scenes = game.acts.flatMap(a => a.cases.flatMap(c => c.scenes));
    expect(scenes.length).toBe(4);
    const sceneIds = scenes.map(s => s.id);
    expect(sceneIds).toContain('scene-office');
    expect(sceneIds).toContain('scene-server-room');
    expect(sceneIds).toContain('scene-conference-room');
    expect(sceneIds).toContain('scene-parking-lot');
  });

  it('10개 단어 포함', () => {
    game = loadExample('modern-mystery');
    expect(Object.keys(game.words!).length).toBe(10);
  });

  it('내비게이션 참조 모두 유효', () => {
    game = loadExample('modern-mystery');
    const allSceneIds = game.acts.flatMap(a => a.cases.flatMap(c => c.scenes.map(s => s.id)));
    const navTargets = collectNavigateTargets(game);
    expect(navTargets.length).toBeGreaterThan(0);
    for (const target of navTargets) {
      expect(allSceneIds, `씬 "${target}" 없음`).toContain(target);
    }
  });

  it('메인 퍼즐에 5개 슬롯', () => {
    game = loadExample('modern-mystery');
    const cas = game.acts[0].cases[0];
    const slotIds = cas.puzzles.main.template.segments
      .filter(s => s.type === 'slot')
      .map(s => (s as { type: 'slot'; slotId: string }).slotId);
    expect(slotIds.length).toBe(5);
  });

  it('서브 퍼즐 2개 (timeline, relationship)', () => {
    game = loadExample('modern-mystery');
    const sub = game.acts[0].cases[0].puzzles.sub;
    expect(sub.length).toBe(2);
    expect(sub.map(p => p.type)).toContain('timeline');
    expect(sub.map(p => p.type)).toContain('relationship');
  });

  it('모든 word_reveal wordId 유효', () => {
    game = loadExample('modern-mystery');
    const wordKeys = new Set(Object.keys(game.words!));
    for (const act of game.acts) {
      for (const cas of act.cases) {
        for (const scene of cas.scenes) {
          for (const hs of scene.hotspots) {
            const ids = collectWordIdsFromAction(hs.action);
            for (const id of ids) {
              expect(wordKeys, `단어 "${id}" 없음`).toContain(id);
            }
          }
        }
      }
    }
  });

  it('퍼즐 정답 단어 모두 words 섹션에 존재', () => {
    game = loadExample('modern-mystery');
    const wordKeys = new Set(Object.keys(game.words!));
    const cas = game.acts[0].cases[0];
    for (const [slotId, answer] of Object.entries(cas.puzzles.main.answers)) {
      expect(wordKeys, `슬롯 "${slotId}" 정답 "${answer.correctWordId}" 없음`).toContain(answer.correctWordId);
    }
  });

  it('createInitialSaveState 정상 생성', () => {
    game = loadExample('modern-mystery');
    const state = createInitialSaveState(game);
    expect(state.gameId).toBe('modern-mystery-leak');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SF Mystery
// ──────────────────────────────────────────────────────────────────────────────
describe('SF Mystery (아리스 III호의 비밀)', () => {
  let game: GameDefinition;

  it('JSON 파일 로드 성공', () => {
    game = loadExample('sf-mystery');
    expect(game).toBeDefined();
    expect(game.id).toBe('sf-mystery-aris3');
  });

  it('3개 씬 포함', () => {
    game = loadExample('sf-mystery');
    const scenes = game.acts.flatMap(a => a.cases.flatMap(c => c.scenes));
    expect(scenes.length).toBe(3);
    const sceneIds = scenes.map(s => s.id);
    expect(sceneIds).toContain('scene-engine-room');
    expect(sceneIds).toContain('scene-medical-bay');
    expect(sceneIds).toContain('scene-cargo-hold');
  });

  it('examine_image 액션 포함 (ARIA 시스템)', () => {
    game = loadExample('sf-mystery');
    let hasExamineImage = false;
    for (const act of game.acts) {
      for (const cas of act.cases) {
        for (const scene of cas.scenes) {
          for (const hs of scene.hotspots) {
            if (hs.action.type === 'examine_image') {
              hasExamineImage = true;
              // ARIA 이미지가 에셋에 등록되어야 함
              const action = hs.action as { type: 'examine_image'; image: string };
              expect(game.assets.items[action.image], `에셋 "${action.image}" 없음`).toBeDefined();
            }
          }
        }
      }
    }
    expect(hasExamineImage).toBe(true);
  });

  it('내비게이션 참조 모두 유효', () => {
    game = loadExample('sf-mystery');
    const allSceneIds = game.acts.flatMap(a => a.cases.flatMap(c => c.scenes.map(s => s.id)));
    const navTargets = collectNavigateTargets(game);
    for (const target of navTargets) {
      expect(allSceneIds, `씬 "${target}" 없음`).toContain(target);
    }
  });

  it('9개 단어 포함', () => {
    game = loadExample('sf-mystery');
    expect(Object.keys(game.words!).length).toBe(9);
  });

  it('메인 퍼즐에 5개 슬롯 (2중 범행 수단 포함)', () => {
    game = loadExample('sf-mystery');
    const cas = game.acts[0].cases[0];
    const slotIds = cas.puzzles.main.template.segments
      .filter(s => s.type === 'slot')
      .map(s => (s as { type: 'slot'; slotId: string }).slotId);
    expect(slotIds.length).toBe(5);
    expect(slotIds).toContain('method1');
    expect(slotIds).toContain('method2');
  });

  it('서브 퍼즐 2개 (timeline, relationship)', () => {
    game = loadExample('sf-mystery');
    const sub = game.acts[0].cases[0].puzzles.sub;
    expect(sub.length).toBe(2);
    expect(sub.map(p => p.type)).toContain('timeline');
    expect(sub.map(p => p.type)).toContain('relationship');
  });

  it('퍼즐 정답 단어 모두 words 섹션에 존재', () => {
    game = loadExample('sf-mystery');
    const wordKeys = new Set(Object.keys(game.words!));
    const cas = game.acts[0].cases[0];
    for (const [slotId, answer] of Object.entries(cas.puzzles.main.answers)) {
      expect(wordKeys, `슬롯 "${slotId}" 정답 "${answer.correctWordId}" 없음`).toContain(answer.correctWordId);
    }
  });

  it('condition 있는 핫스팟 - 참조 레이어가 씬에 존재', () => {
    game = loadExample('sf-mystery');
    for (const act of game.acts) {
      for (const cas of act.cases) {
        for (const scene of cas.scenes) {
          const layerIds = new Set(scene.layers.map(l => l.id));
          for (const hs of scene.hotspots) {
            if (hs.condition?.type === 'layer_visible') {
              const cond = hs.condition as { type: 'layer_visible'; layerId: string };
              expect(layerIds, `레이어 "${cond.layerId}" 씬 "${scene.id}"에 없음`).toContain(cond.layerId);
            }
          }
        }
      }
    }
  });

  it('createInitialSaveState 정상 생성', () => {
    game = loadExample('sf-mystery');
    const state = createInitialSaveState(game);
    expect(state.gameId).toBe('sf-mystery-aris3');
    const caseState = Object.values(state.caseStates)[0];
    expect(caseState.status).toBe('unlocked');
    // 메인 + 서브 2개 = 3개 퍼즐 상태
    expect(Object.keys(caseState.puzzleStates).length).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 공통 구조 테스트
// ──────────────────────────────────────────────────────────────────────────────
describe('공통 구조 검증', () => {
  const exampleNames = ['classic-mystery', 'modern-mystery', 'sf-mystery'];

  for (const name of exampleNames) {
    it(`${name}: 한국어/영어 이중언어 지원`, () => {
      const game = loadExample(name);
      expect(game.title.ko).toBeTruthy();
      expect(game.title.en).toBeTruthy();
      expect(game.description.ko).toBeTruthy();
      expect(game.description.en).toBeTruthy();

      for (const act of game.acts) {
        expect(act.title.ko).toBeTruthy();
        expect(act.title.en).toBeTruthy();
        for (const cas of act.cases) {
          expect(cas.title.ko).toBeTruthy();
          expect(cas.title.en).toBeTruthy();
          for (const scene of cas.scenes) {
            expect(scene.name.ko).toBeTruthy();
            expect(scene.name.en).toBeTruthy();
          }
        }
      }

      // words 이중언어
      for (const [id, word] of Object.entries(game.words ?? {})) {
        expect(word.display.ko, `단어 "${id}" 한국어 없음`).toBeTruthy();
        expect(word.display.en, `단어 "${id}" 영어 없음`).toBeTruthy();
      }
    });

    it(`${name}: settings 필드 유효`, () => {
      const game = loadExample(name);
      const s = game.settings;
      expect(s.validationFeedbackDuration).toBeGreaterThan(0);
      expect(s.autoSaveInterval).toBeGreaterThan(0);
      expect(['sequential', 'all_unlocked']).toContain(s.unlockMode);
      expect(s.cssPrefix).toBeTruthy();
    });

    it(`${name}: 모든 에셋 ID가 고유함`, () => {
      const game = loadExample(name);
      const ids = Object.keys(game.assets.items);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  }
});
