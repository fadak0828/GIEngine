# Golden Idol UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the GIEngine runtime and editor to match the Golden Idol game's UX: multiple deduction puzzles in a bottom bar, nested hotspots within examine popups, word collection from text/image hotspots, better word-collected feedback, and overlay-based puzzle UI.

**Architecture:** Five features that touch the same vertical slice (types -> state machine -> renderers -> editor). We build bottom-up: types first, then state machine, then renderers, then editor. Each feature is self-contained but they share the same type/state foundation.

**Tech Stack:** TypeScript, vanilla DOM (runtime), React (editor), vitest (tests)

---

## File Map

### Core Package (`packages/core/src/`)
- **Modify:** `models/types.ts` — Add `wordIds` to ExamineAction/ExamineImageAction, add `innerHotspots` to ExploringSubState's examining_image, add puzzle overlay sub-states
- **Modify:** `state/state-machine.ts` — Handle word collection from examine actions, handle inner hotspot clicks, handle puzzle overlay open/close in exploring state
- **Modify:** `i18n/i18n.ts` — New UI strings for word popup and puzzle tabs
- **Modify:** `validator/validator.ts` — No changes needed (sub-puzzle validation already works)

### Runtime Package (`packages/runtime/src/`)
- **Modify:** `renderer/renderer.ts` — Add puzzle bar rendering, overlay puzzle rendering, improved toast
- **Modify:** `renderer/popup-renderer.ts` — Render inner hotspots inside image popups
- **Modify:** `renderer/deduction-renderer.ts` — Support rendering sub-puzzle types (character_id, timeline, relationship)
- **Create:** `renderer/puzzle-bar-renderer.ts` — Bottom bar with puzzle tabs + overlay container
- **Create:** `renderer/sub-puzzle-renderer.ts` — Renderers for character_id, timeline, relationship puzzle types
- **Modify:** `renderer/scene-renderer.ts` — No changes needed
- **Modify:** `dragdrop/drag-drop-manager.ts` — Support drag-drop in overlay context

### Editor Package (`packages/editor/src/`)
- **Modify:** `components/properties/HotspotProperties.tsx` — Add wordIds editor for examine/examine_image, inner hotspot list editor for examine_image

### Tests (`packages/core/src/__tests__/`)
- **Create:** `state-machine-nested-hotspots.test.ts`
- **Create:** `state-machine-examine-words.test.ts`
- **Create:** `state-machine-puzzle-overlay.test.ts`

---

## Task 1: Add `wordIds` to ExamineAction and ExamineImageAction types

**Files:**
- Modify: `packages/core/src/models/types.ts:110-122`

- [ ] **Step 1: Add `wordIds` field to ExamineAction**

In `packages/core/src/models/types.ts`, change `ExamineAction`:

```typescript
export interface ExamineAction {
  type: 'examine';
  content: LocalizedText;
  title?: LocalizedText;
  highlightedWords?: string[];
  wordIds?: string[];  // words to collect when this hotspot is examined
}
```

- [ ] **Step 2: Add `wordIds` field to ExamineImageAction**

In the same file, change `ExamineImageAction`:

```typescript
export interface ExamineImageAction {
  type: 'examine_image';
  image: AssetRef;
  caption?: LocalizedText;
  innerHotspots?: Hotspot[];
  wordIds?: string[];  // words to collect when this hotspot is examined
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build -w packages/core`
Expected: Clean build, no errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/models/types.ts
git commit -m "feat(core): add wordIds to ExamineAction and ExamineImageAction"
```

---

## Task 2: Add `innerHotspots` to examining_image sub-state and new puzzle overlay sub-states

**Files:**
- Modify: `packages/core/src/models/types.ts:304-344`

- [ ] **Step 1: Update ExploringSubState to carry innerHotspots and add puzzle overlay**

In `packages/core/src/models/types.ts`, replace the `ExploringSubState` type:

```typescript
export type ExploringSubState =
  | { type: 'idle' }
  | { type: 'examining_text'; content: LocalizedText; title?: LocalizedText; highlightedWords?: string[] }
  | { type: 'examining_image'; image: AssetRef; caption?: LocalizedText; innerHotspots?: Hotspot[] }
  | { type: 'word_collected'; wordIds: string[] }
  | { type: 'transitioning'; targetSceneId: string }
  | { type: 'puzzle_overlay'; puzzleId: string };
```

Key changes:
- `examining_image` now carries `innerHotspots` from the action
- `word_collected` now carries `wordIds: string[]` (array) instead of `wordId: string` (single) — supports collecting multiple words at once
- New `puzzle_overlay` sub-state: player is viewing a puzzle as an overlay while still in exploring state

- [ ] **Step 2: Add INNER_HOTSPOT_CLICK and OPEN_PUZZLE_OVERLAY events**

In the same file, add to the `GameEvent` union:

```typescript
export type GameEvent =
  | { type: 'ASSETS_LOADED' }
  | { type: 'SELECT_CASE'; caseId: string }
  | { type: 'NAVIGATE_SCENE'; sceneId: string }
  | { type: 'OPEN_PUZZLE'; puzzleId: string }
  | { type: 'CLOSE_PUZZLE' }
  | { type: 'ASSIGN_WORD'; slotId: string; wordId: string }
  | { type: 'UNASSIGN_WORD'; slotId: string }
  | { type: 'VALIDATE_PUZZLE' }
  | { type: 'CLEAR_ALL_WORDS' }
  | { type: 'CLOSE_POPUP' }
  | { type: 'BACK_TO_SELECT' }
  | { type: 'RESET_GAME' }
  | { type: 'COLLECT_WORD'; wordId: string }
  | { type: 'TOGGLE_LAYER'; layerId: string; visible?: boolean }
  | { type: 'CHANGE_LOCALE'; locale: Locale }
  | { type: 'HOTSPOT_CLICK'; hotspotId: string }
  | { type: 'INNER_HOTSPOT_CLICK'; hotspotId: string }
  | { type: 'OPEN_PUZZLE_OVERLAY'; puzzleId: string }
  | { type: 'CLOSE_PUZZLE_OVERLAY' };
```

- [ ] **Step 3: Verify build**

Run: `npm run build -w packages/core`
Expected: Build errors in state-machine.ts and renderer.ts (expected — we'll fix those next)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/models/types.ts
git commit -m "feat(core): add innerHotspots to examining_image, puzzle_overlay sub-state, new events"
```

---

## Task 3: Update state machine — word collection from examine actions

**Files:**
- Modify: `packages/core/src/state/state-machine.ts:247-310`
- Test: `packages/core/src/__tests__/state-machine-examine-words.test.ts`

- [ ] **Step 1: Write failing test for examine action with wordIds**

Create `packages/core/src/__tests__/state-machine-examine-words.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { transition } from '../state/state-machine.js';
import type { GameDefinition, GameState, SaveState, CaseState } from '../models/types.js';

function makeTestDef(): GameDefinition {
  return {
    id: 'test',
    version: '1',
    title: { ko: 'T', en: 'T' },
    description: { ko: '', en: '' },
    supportedLocales: ['ko'],
    settings: {
      validationFeedbackDuration: 2000,
      autoSaveInterval: 0,
      debug: false,
      unlockMode: 'all_unlocked',
      cssPrefix: 'gi',
    },
    acts: [{
      id: 'act1',
      title: { ko: 'A', en: 'A' },
      cases: [{
        id: 'case1',
        title: { ko: 'C', en: 'C' },
        description: { ko: '', en: '' },
        scenes: [{
          id: 'scene1',
          name: { ko: 'S', en: 'S' },
          background: '',
          dimensions: { width: 1280, height: 720 },
          hotspots: [
            {
              id: 'hs-examine',
              area: { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
              action: {
                type: 'examine',
                content: { ko: '텍스트', en: 'text' },
                wordIds: ['word1', 'word2'],
              },
              cursor: 'pointer',
              ariaLabel: { ko: '', en: '' },
            },
            {
              id: 'hs-examine-img',
              area: { type: 'rect', x: 200, y: 0, width: 100, height: 100 },
              action: {
                type: 'examine_image',
                image: 'img1',
                wordIds: ['word3'],
              },
              cursor: 'zoom-in',
              ariaLabel: { ko: '', en: '' },
            },
          ],
          layers: [],
        }],
        puzzles: {
          main: {
            id: 'puzzle1',
            title: { ko: 'P', en: 'P' },
            type: 'fill_in_blank',
            template: { segments: [] },
            answers: {},
          },
          sub: [],
        },
        prerequisites: [],
        thumbnail: '',
      }],
    }],
    assets: { items: {} },
    words: {
      word1: { id: 'word1', display: { ko: '단서1', en: 'clue1' } },
      word2: { id: 'word2', display: { ko: '단서2', en: 'clue2' } },
      word3: { id: 'word3', display: { ko: '단서3', en: 'clue3' } },
    },
  };
}

function makeState(): GameState {
  return {
    type: 'exploring',
    caseId: 'case1',
    sceneId: 'scene1',
    sub: { type: 'idle' },
  };
}

function makeSave(): SaveState {
  return {
    gameId: 'test',
    gameVersion: '1',
    savedAt: '',
    currentLocale: 'ko',
    caseStates: {
      case1: {
        status: 'unlocked',
        collectedWordIds: [],
        puzzleStates: {
          puzzle1: { solved: false, slotAssignments: {}, attemptCount: 0 },
        },
        visitedSceneIds: ['scene1'],
        layerVisibility: {},
      },
    },
    currentPosition: { caseId: 'case1', sceneId: 'scene1' },
    flags: {},
  };
}

describe('examine action with wordIds', () => {
  it('collects words when examine action has wordIds', () => {
    const def = makeTestDef();
    const state = makeState();
    const save = makeSave();

    const result = transition(state, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine' }, def);

    // Should show examining_text sub-state
    expect(result.nextState).toMatchObject({
      type: 'exploring',
      sub: { type: 'examining_text' },
    });

    // Should have collected the words
    const caseState = result.saveState?.caseStates?.['case1'] as CaseState;
    expect(caseState.collectedWordIds).toContain('word1');
    expect(caseState.collectedWordIds).toContain('word2');
  });

  it('collects words when examine_image action has wordIds', () => {
    const def = makeTestDef();
    const state = makeState();
    const save = makeSave();

    const result = transition(state, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine-img' }, def);

    expect(result.nextState).toMatchObject({
      type: 'exploring',
      sub: { type: 'examining_image' },
    });

    const caseState = result.saveState?.caseStates?.['case1'] as CaseState;
    expect(caseState.collectedWordIds).toContain('word3');
  });

  it('does not duplicate already-collected words', () => {
    const def = makeTestDef();
    const state = makeState();
    const save = makeSave();
    save.caseStates['case1'].collectedWordIds = ['word1'];

    const result = transition(state, save, { type: 'HOTSPOT_CLICK', hotspotId: 'hs-examine' }, def);

    const caseState = result.saveState?.caseStates?.['case1'] as CaseState;
    expect(caseState.collectedWordIds.filter(id => id === 'word1')).toHaveLength(1);
    expect(caseState.collectedWordIds).toContain('word2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/__tests__/state-machine-examine-words.test.ts`
Expected: FAIL — examine action doesn't collect words yet

- [ ] **Step 3: Update handleHotspotAction for examine with wordIds**

In `packages/core/src/state/state-machine.ts`, update the `examine` case in `handleHotspotAction`:

```typescript
    case 'examine': {
      // Collect words if the examine action has wordIds
      let updatedCaseState = caseState;
      let saveUpdate: Partial<SaveState> | undefined;

      if (action.wordIds && action.wordIds.length > 0) {
        const newWords = action.wordIds.filter(id => !caseState.collectedWordIds.includes(id));
        if (newWords.length > 0) {
          updatedCaseState = {
            ...caseState,
            collectedWordIds: [...caseState.collectedWordIds, ...newWords],
          };
          saveUpdate = {
            caseStates: {
              ...save.caseStates,
              [state.caseId]: updatedCaseState,
            },
          };
        }
      }

      return {
        nextState: {
          ...state,
          sub: {
            type: 'examining_text',
            content: action.content,
            title: action.title,
            highlightedWords: action.highlightedWords,
          },
        },
        saveState: saveUpdate,
        effects: saveUpdate ? [{ type: 'save_game' }] : [],
      };
    }
```

- [ ] **Step 4: Update handleHotspotAction for examine_image with wordIds and innerHotspots**

In the same function, update the `examine_image` case:

```typescript
    case 'examine_image': {
      // Collect words if the examine_image action has wordIds
      let updatedCaseState = caseState;
      let saveUpdate: Partial<SaveState> | undefined;

      if (action.wordIds && action.wordIds.length > 0) {
        const newWords = action.wordIds.filter(id => !caseState.collectedWordIds.includes(id));
        if (newWords.length > 0) {
          updatedCaseState = {
            ...caseState,
            collectedWordIds: [...caseState.collectedWordIds, ...newWords],
          };
          saveUpdate = {
            caseStates: {
              ...save.caseStates,
              [state.caseId]: updatedCaseState,
            },
          };
        }
      }

      return {
        nextState: {
          ...state,
          sub: {
            type: 'examining_image',
            image: action.image,
            caption: action.caption,
            innerHotspots: action.innerHotspots,
          },
        },
        saveState: saveUpdate,
        effects: saveUpdate ? [{ type: 'save_game' }] : [],
      };
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/core/src/__tests__/state-machine-examine-words.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/state/state-machine.ts packages/core/src/__tests__/state-machine-examine-words.test.ts
git commit -m "feat(core): collect words from examine and examine_image actions"
```

---

## Task 4: Update state machine — inner hotspot clicks

**Files:**
- Modify: `packages/core/src/state/state-machine.ts:120-245`
- Test: `packages/core/src/__tests__/state-machine-nested-hotspots.test.ts`

- [ ] **Step 1: Write failing test for inner hotspot click**

Create `packages/core/src/__tests__/state-machine-nested-hotspots.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { transition } from '../state/state-machine.js';
import type { GameDefinition, GameState, SaveState, CaseState } from '../models/types.js';

function makeTestDef(): GameDefinition {
  return {
    id: 'test',
    version: '1',
    title: { ko: 'T', en: 'T' },
    description: { ko: '', en: '' },
    supportedLocales: ['ko'],
    settings: {
      validationFeedbackDuration: 2000,
      autoSaveInterval: 0,
      debug: false,
      unlockMode: 'all_unlocked',
      cssPrefix: 'gi',
    },
    acts: [{
      id: 'act1',
      title: { ko: 'A', en: 'A' },
      cases: [{
        id: 'case1',
        title: { ko: 'C', en: 'C' },
        description: { ko: '', en: '' },
        scenes: [{
          id: 'scene1',
          name: { ko: 'S', en: 'S' },
          background: '',
          dimensions: { width: 1280, height: 720 },
          hotspots: [
            {
              id: 'hs-box',
              area: { type: 'rect', x: 0, y: 0, width: 100, height: 100 },
              action: {
                type: 'examine_image',
                image: 'box-img',
                innerHotspots: [
                  {
                    id: 'inner-letter',
                    area: { type: 'rect', x: 10, y: 10, width: 50, height: 50 },
                    action: {
                      type: 'examine',
                      content: { ko: '편지 내용', en: 'Letter content' },
                      wordIds: ['word-letter'],
                    },
                    cursor: 'pointer',
                    ariaLabel: { ko: '편지', en: 'Letter' },
                  },
                  {
                    id: 'inner-key',
                    area: { type: 'rect', x: 60, y: 10, width: 30, height: 30 },
                    action: {
                      type: 'word_reveal',
                      wordIds: ['word-key'],
                    },
                    cursor: 'pointer',
                    ariaLabel: { ko: '열쇠', en: 'Key' },
                  },
                ],
              },
              cursor: 'zoom-in',
              ariaLabel: { ko: '상자', en: 'Box' },
            },
          ],
          layers: [],
        }],
        puzzles: {
          main: {
            id: 'puzzle1',
            title: { ko: 'P', en: 'P' },
            type: 'fill_in_blank',
            template: { segments: [] },
            answers: {},
          },
          sub: [],
        },
        prerequisites: [],
        thumbnail: '',
      }],
    }],
    assets: { items: {} },
    words: {
      'word-letter': { id: 'word-letter', display: { ko: '편지', en: 'letter' } },
      'word-key': { id: 'word-key', display: { ko: '열쇠', en: 'key' } },
    },
  };
}

describe('inner hotspot clicks', () => {
  it('handles INNER_HOTSPOT_CLICK on a word_reveal inner hotspot', () => {
    const def = makeTestDef();
    const state: GameState = {
      type: 'exploring',
      caseId: 'case1',
      sceneId: 'scene1',
      sub: {
        type: 'examining_image',
        image: 'box-img',
        innerHotspots: (def.acts[0].cases[0].scenes[0].hotspots[0].action as any).innerHotspots,
      },
    };
    const save: SaveState = {
      gameId: 'test',
      gameVersion: '1',
      savedAt: '',
      currentLocale: 'ko',
      caseStates: {
        case1: {
          status: 'unlocked',
          collectedWordIds: [],
          puzzleStates: { puzzle1: { solved: false, slotAssignments: {}, attemptCount: 0 } },
          visitedSceneIds: ['scene1'],
          layerVisibility: {},
        },
      },
      currentPosition: { caseId: 'case1', sceneId: 'scene1' },
      flags: {},
    };

    const result = transition(state, save, { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'inner-key' }, def);

    // Should collect the word
    const caseState = result.saveState?.caseStates?.['case1'] as CaseState;
    expect(caseState.collectedWordIds).toContain('word-key');
  });

  it('handles INNER_HOTSPOT_CLICK on an examine inner hotspot (opens nested text popup)', () => {
    const def = makeTestDef();
    const state: GameState = {
      type: 'exploring',
      caseId: 'case1',
      sceneId: 'scene1',
      sub: {
        type: 'examining_image',
        image: 'box-img',
        innerHotspots: (def.acts[0].cases[0].scenes[0].hotspots[0].action as any).innerHotspots,
      },
    };
    const save: SaveState = {
      gameId: 'test',
      gameVersion: '1',
      savedAt: '',
      currentLocale: 'ko',
      caseStates: {
        case1: {
          status: 'unlocked',
          collectedWordIds: [],
          puzzleStates: { puzzle1: { solved: false, slotAssignments: {}, attemptCount: 0 } },
          visitedSceneIds: ['scene1'],
          layerVisibility: {},
        },
      },
      currentPosition: { caseId: 'case1', sceneId: 'scene1' },
      flags: {},
    };

    const result = transition(state, save, { type: 'INNER_HOTSPOT_CLICK', hotspotId: 'inner-letter' }, def);

    // Should transition to examining_text AND collect the word
    expect(result.nextState).toMatchObject({
      type: 'exploring',
      sub: { type: 'examining_text', content: { ko: '편지 내용', en: 'Letter content' } },
    });

    const caseState = result.saveState?.caseStates?.['case1'] as CaseState;
    expect(caseState.collectedWordIds).toContain('word-letter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/__tests__/state-machine-nested-hotspots.test.ts`
Expected: FAIL — INNER_HOTSPOT_CLICK is not handled

- [ ] **Step 3: Add INNER_HOTSPOT_CLICK handler to handleExploring**

In `packages/core/src/state/state-machine.ts`, add a new case inside `handleExploring`'s switch:

```typescript
    case 'INNER_HOTSPOT_CLICK': {
      // Only valid when examining_image with innerHotspots
      if (state.sub.type !== 'examining_image' || !state.sub.innerHotspots) {
        return noTransition(state);
      }

      const innerHotspot = state.sub.innerHotspots.find(h => h.id === event.hotspotId);
      if (!innerHotspot) return noTransition(state);

      // Reuse handleHotspotAction — it handles all action types including word collection
      return handleHotspotAction(state, save, def, innerHotspot, caseState);
    }
```

Also add the import for `INNER_HOTSPOT_CLICK` — no import needed, it's part of the `GameEvent` union already.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/__tests__/state-machine-nested-hotspots.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/state/state-machine.ts packages/core/src/__tests__/state-machine-nested-hotspots.test.ts
git commit -m "feat(core): handle INNER_HOTSPOT_CLICK for nested hotspots in examine_image"
```

---

## Task 5: Update state machine — puzzle overlay in exploring state

**Files:**
- Modify: `packages/core/src/state/state-machine.ts:120-245`
- Test: `packages/core/src/__tests__/state-machine-puzzle-overlay.test.ts`

- [ ] **Step 1: Write failing test for puzzle overlay**

Create `packages/core/src/__tests__/state-machine-puzzle-overlay.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { transition } from '../state/state-machine.js';
import type { GameDefinition, GameState, SaveState } from '../models/types.js';

function makeTestDef(): GameDefinition {
  return {
    id: 'test',
    version: '1',
    title: { ko: 'T', en: 'T' },
    description: { ko: '', en: '' },
    supportedLocales: ['ko'],
    settings: {
      validationFeedbackDuration: 2000,
      autoSaveInterval: 0,
      debug: false,
      unlockMode: 'all_unlocked',
      cssPrefix: 'gi',
    },
    acts: [{
      id: 'act1',
      title: { ko: 'A', en: 'A' },
      cases: [{
        id: 'case1',
        title: { ko: 'C', en: 'C' },
        description: { ko: '', en: '' },
        scenes: [{
          id: 'scene1',
          name: { ko: 'S', en: 'S' },
          background: '',
          dimensions: { width: 1280, height: 720 },
          hotspots: [],
          layers: [],
        }],
        puzzles: {
          main: {
            id: 'main-puzzle',
            title: { ko: '메인', en: 'Main' },
            type: 'fill_in_blank',
            template: { segments: [] },
            answers: {},
          },
          sub: [
            {
              id: 'char-puzzle',
              title: { ko: '인물', en: 'Characters' },
              type: 'character_id',
              characters: [],
            },
            {
              id: 'timeline-puzzle',
              title: { ko: '타임라인', en: 'Timeline' },
              type: 'timeline',
              slots: [],
            },
          ],
        },
        prerequisites: [],
        thumbnail: '',
      }],
    }],
    assets: { items: {} },
  };
}

function makeExploringState(): GameState {
  return {
    type: 'exploring',
    caseId: 'case1',
    sceneId: 'scene1',
    sub: { type: 'idle' },
  };
}

function makeSave(): SaveState {
  return {
    gameId: 'test',
    gameVersion: '1',
    savedAt: '',
    currentLocale: 'ko',
    caseStates: {
      case1: {
        status: 'unlocked',
        collectedWordIds: [],
        puzzleStates: {
          'main-puzzle': { solved: false, slotAssignments: {}, attemptCount: 0 },
          'char-puzzle': { solved: false, slotAssignments: {}, attemptCount: 0 },
          'timeline-puzzle': { solved: false, slotAssignments: {}, attemptCount: 0 },
        },
        visitedSceneIds: ['scene1'],
        layerVisibility: {},
      },
    },
    currentPosition: { caseId: 'case1', sceneId: 'scene1' },
    flags: {},
  };
}

describe('puzzle overlay in exploring state', () => {
  it('opens puzzle overlay from exploring state', () => {
    const def = makeTestDef();
    const state = makeExploringState();
    const save = makeSave();

    const result = transition(state, save, { type: 'OPEN_PUZZLE_OVERLAY', puzzleId: 'char-puzzle' }, def);

    expect(result.nextState).toMatchObject({
      type: 'exploring',
      sub: { type: 'puzzle_overlay', puzzleId: 'char-puzzle' },
    });
  });

  it('closes puzzle overlay back to idle', () => {
    const def = makeTestDef();
    const state: GameState = {
      type: 'exploring',
      caseId: 'case1',
      sceneId: 'scene1',
      sub: { type: 'puzzle_overlay', puzzleId: 'char-puzzle' },
    };
    const save = makeSave();

    const result = transition(state, save, { type: 'CLOSE_PUZZLE_OVERLAY' }, def);

    expect(result.nextState).toMatchObject({
      type: 'exploring',
      sub: { type: 'idle' },
    });
  });

  it('OPEN_PUZZLE still transitions to thinking state (backward compat)', () => {
    const def = makeTestDef();
    const state = makeExploringState();
    const save = makeSave();

    const result = transition(state, save, { type: 'OPEN_PUZZLE', puzzleId: 'main-puzzle' }, def);

    expect(result.nextState).toMatchObject({
      type: 'thinking',
      puzzleId: 'main-puzzle',
    });
  });

  it('ASSIGN_WORD works while in puzzle_overlay sub-state', () => {
    const def = makeTestDef();
    const state: GameState = {
      type: 'exploring',
      caseId: 'case1',
      sceneId: 'scene1',
      sub: { type: 'puzzle_overlay', puzzleId: 'char-puzzle' },
    };
    const save = makeSave();

    const result = transition(state, save, { type: 'ASSIGN_WORD', slotId: 'slot1', wordId: 'w1' }, def);

    // Should stay in puzzle_overlay and update the puzzle state
    expect(result.nextState).toMatchObject({
      type: 'exploring',
      sub: { type: 'puzzle_overlay', puzzleId: 'char-puzzle' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/__tests__/state-machine-puzzle-overlay.test.ts`
Expected: FAIL — OPEN_PUZZLE_OVERLAY not handled

- [ ] **Step 3: Add puzzle overlay handlers to handleExploring**

In `packages/core/src/state/state-machine.ts`, add these cases inside `handleExploring`'s switch:

```typescript
    case 'OPEN_PUZZLE_OVERLAY': {
      const puzzle = findPuzzle(caseData.puzzles, event.puzzleId);
      if (!puzzle) return noTransition(state);

      return {
        nextState: {
          ...state,
          sub: { type: 'puzzle_overlay', puzzleId: event.puzzleId },
        },
        effects: [],
      };
    }

    case 'CLOSE_PUZZLE_OVERLAY': {
      return {
        nextState: { ...state, sub: { type: 'idle' } },
        effects: [],
      };
    }

    case 'ASSIGN_WORD': {
      // Handle word assignment while in puzzle_overlay sub-state
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const puzzleId = state.sub.puzzleId;
      const puzzleState = caseState.puzzleStates[puzzleId];
      if (!puzzleState || puzzleState.solved) return noTransition(state);

      const newAssignments = { ...puzzleState.slotAssignments, [event.slotId]: event.wordId };
      // Remove word from other slots
      for (const [slotId, wordId] of Object.entries(newAssignments)) {
        if (slotId !== event.slotId && wordId === event.wordId) {
          newAssignments[slotId] = null;
        }
      }

      const updatedPuzzleState = { ...puzzleState, slotAssignments: newAssignments };
      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: { ...caseState.puzzleStates, [puzzleId]: updatedPuzzleState },
      };

      return {
        nextState: state,
        saveState: { caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState } },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'UNASSIGN_WORD': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const puzzleId = state.sub.puzzleId;
      const puzzleState = caseState.puzzleStates[puzzleId];
      if (!puzzleState || puzzleState.solved) return noTransition(state);

      const newAssignments = { ...puzzleState.slotAssignments, [event.slotId]: null };
      const updatedPuzzleState = { ...puzzleState, slotAssignments: newAssignments };
      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: { ...caseState.puzzleStates, [puzzleId]: updatedPuzzleState },
      };

      return {
        nextState: state,
        saveState: { caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState } },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'CLEAR_ALL_WORDS': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const puzzleId = state.sub.puzzleId;
      const puzzleState = caseState.puzzleStates[puzzleId];
      if (!puzzleState || puzzleState.solved) return noTransition(state);

      const cleared: Record<string, string | null> = {};
      for (const slotId of Object.keys(puzzleState.slotAssignments)) {
        cleared[slotId] = null;
      }
      const updatedPuzzleState = { ...puzzleState, slotAssignments: cleared, lastValidation: undefined };
      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: { ...caseState.puzzleStates, [puzzleId]: updatedPuzzleState },
      };

      return {
        nextState: state,
        saveState: { caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState } },
        effects: [{ type: 'save_game' }],
      };
    }

    case 'VALIDATE_PUZZLE': {
      if (state.sub.type !== 'puzzle_overlay') return noTransition(state);
      const puzzleId = state.sub.puzzleId;
      const puzzle = findPuzzle(caseData.puzzles, puzzleId);
      if (!puzzle) return noTransition(state);
      const puzzleState = caseState.puzzleStates[puzzleId];
      if (!puzzleState || puzzleState.solved) return noTransition(state);

      let result;
      if ('answers' in puzzle) {
        result = validatePuzzle(puzzle as any, puzzleState.slotAssignments);
      } else {
        result = validateSubPuzzle(puzzle as any, puzzleState.slotAssignments);
      }

      const updatedPuzzleState = {
        ...puzzleState,
        lastValidation: result.slotResults,
        attemptCount: puzzleState.attemptCount + 1,
        solved: result.allCorrect,
      };
      const updatedCaseState: CaseState = {
        ...caseState,
        puzzleStates: { ...caseState.puzzleStates, [puzzleId]: updatedPuzzleState },
      };

      return {
        nextState: state,
        saveState: { caseStates: { ...save.caseStates, [state.caseId]: updatedCaseState } },
        effects: [{ type: 'save_game' }],
      };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/__tests__/state-machine-puzzle-overlay.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/state/state-machine.ts packages/core/src/__tests__/state-machine-puzzle-overlay.test.ts
git commit -m "feat(core): add puzzle overlay sub-state with ASSIGN/UNASSIGN/VALIDATE support"
```

---

## Task 6: Update word_collected sub-state to carry multiple wordIds

**Files:**
- Modify: `packages/core/src/state/state-machine.ts` — Update COLLECT_WORD and word_reveal to use `wordIds: string[]`

- [ ] **Step 1: Update COLLECT_WORD handler**

In `handleExploring`, replace the `COLLECT_WORD` case:

```typescript
    case 'COLLECT_WORD': {
      if (caseState.collectedWordIds.includes(event.wordId)) {
        return noTransition(state);
      }

      const updatedCaseState: CaseState = {
        ...caseState,
        collectedWordIds: [...caseState.collectedWordIds, event.wordId],
      };

      return {
        nextState: {
          ...state,
          sub: { type: 'word_collected', wordIds: [event.wordId] },
        },
        saveState: {
          caseStates: {
            ...save.caseStates,
            [state.caseId]: updatedCaseState,
          },
        },
        effects: [{ type: 'save_game' }],
      };
    }
```

- [ ] **Step 2: Update word_reveal handler to use wordIds array**

In `handleHotspotAction`, update the `word_reveal` case:

```typescript
    case 'word_reveal': {
      const newWords = action.wordIds.filter(id => !caseState.collectedWordIds.includes(id));
      if (newWords.length === 0) return noTransition(state);

      const updatedCaseState: CaseState = {
        ...caseState,
        collectedWordIds: [...caseState.collectedWordIds, ...newWords],
      };

      return {
        nextState: {
          ...state,
          sub: { type: 'word_collected', wordIds: newWords },
        },
        saveState: {
          caseStates: {
            ...save.caseStates,
            [state.caseId]: updatedCaseState,
          },
        },
        effects: [{ type: 'save_game' }],
      };
    }
```

- [ ] **Step 3: Run all existing tests to verify no regressions**

Run: `npx vitest run packages/core/src/__tests__/`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/state/state-machine.ts
git commit -m "feat(core): word_collected sub-state now carries wordIds array"
```

---

## Task 7: Add new i18n keys

**Files:**
- Modify: `packages/core/src/i18n/i18n.ts`

- [ ] **Step 1: Add new UI strings**

Add these entries to the UI strings map in `packages/core/src/i18n/i18n.ts`:

```typescript
  'ui.word_collected_name': { ko: '「{word}」 획득!', en: 'Got "{word}"!' },
  'ui.words_collected_count': { ko: '{count}개 단어 획득!', en: '{count} words collected!' },
  'ui.puzzle_tab_main': { ko: '추리', en: 'Deduce' },
  'ui.puzzle_tab_character': { ko: '인물', en: 'Characters' },
  'ui.puzzle_tab_timeline': { ko: '타임라인', en: 'Timeline' },
  'ui.puzzle_tab_relationship': { ko: '관계', en: 'Relations' },
  'ui.puzzle_tab_scenario': { ko: '시나리오', en: 'Scenario' },
  'ui.close_overlay': { ko: '닫기', en: 'Close' },
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w packages/core`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/i18n/i18n.ts
git commit -m "feat(core): add i18n keys for word popup and puzzle tabs"
```

---

## Task 8: Enhance PopupRenderer — inner hotspots in image popups

**Files:**
- Modify: `packages/runtime/src/renderer/popup-renderer.ts`

- [ ] **Step 1: Update showImagePopup to accept innerHotspots and onInnerHotspotClick**

Replace `showImagePopup` method and add inner hotspot rendering:

```typescript
  showImagePopup(
    image: AssetRef,
    caption?: LocalizedText,
    innerHotspots?: Hotspot[],
    onInnerHotspotClick?: (hotspotId: string) => void
  ): void {
    this.dismiss();

    const overlay = this.createOverlay();
    const popup = document.createElement('div');
    popup.className = 'gi-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', caption ? this.i18n.resolveText(caption) : 'Image');

    popup.appendChild(this.createCloseButton());

    // Image container (relative for inner hotspot positioning)
    const imgContainer = document.createElement('div');
    imgContainer.className = 'gi-popup-image-container';
    imgContainer.style.position = 'relative';
    imgContainer.style.display = 'inline-block';

    const src = this.resolveAssetSrc(image);
    const img = document.createElement('img');
    img.className = 'gi-popup-image';
    img.src = src;
    img.alt = caption ? this.i18n.resolveText(caption) : '';
    img.draggable = false;
    imgContainer.appendChild(img);

    // Render inner hotspots on top of the image
    if (innerHotspots && innerHotspots.length > 0 && onInnerHotspotClick) {
      for (const hs of innerHotspots) {
        const hsEl = this.createInnerHotspot(hs, onInnerHotspotClick);
        imgContainer.appendChild(hsEl);
      }
    }

    popup.appendChild(imgContainer);

    if (caption) {
      const cap = document.createElement('p');
      cap.className = 'gi-popup-caption';
      cap.textContent = this.i18n.resolveText(caption);
      popup.appendChild(cap);
    }

    overlay.appendChild(popup);

    popup.tabIndex = -1;
    requestAnimationFrame(() => popup.focus());
  }

  private createInnerHotspot(
    hotspot: Hotspot,
    onClick: (hotspotId: string) => void
  ): HTMLElement {
    const el = document.createElement('button');
    el.className = 'gi-inner-hotspot';
    el.dataset.hotspotId = hotspot.id;
    el.setAttribute('aria-label', this.i18n.resolveText(hotspot.ariaLabel));
    el.style.cursor = hotspot.cursor || 'pointer';
    el.style.position = 'absolute';
    el.tabIndex = 0;

    // Position based on area (percentage-based relative to image)
    const area = hotspot.area;
    if (area.type === 'rect') {
      // Inner hotspot areas are defined in percentage (0-100) relative to the image
      el.style.left = `${area.x}%`;
      el.style.top = `${area.y}%`;
      el.style.width = `${area.width}%`;
      el.style.height = `${area.height}%`;
    } else if (area.type === 'circle') {
      const diameter = area.radius * 2;
      el.style.left = `${area.cx - area.radius}%`;
      el.style.top = `${area.cy - area.radius}%`;
      el.style.width = `${diameter}%`;
      el.style.height = `${diameter}%`;
      el.style.borderRadius = '50%';
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(hotspot.id);
    });

    return el;
  }
```

Add `Hotspot` to the import from `@gi-engine/core`:

```typescript
import type {
  LocalizedText,
  AssetRef,
  AssetManifest,
  GameEvent,
  Hotspot,
} from '@gi-engine/core';
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w packages/runtime`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/renderer/popup-renderer.ts
git commit -m "feat(runtime): render inner hotspots inside image popups"
```

---

## Task 9: Update Renderer — pass innerHotspots to popup, improved word toast

**Files:**
- Modify: `packages/runtime/src/renderer/renderer.ts:188-236`

- [ ] **Step 1: Update examining_image handler to pass innerHotspots**

In `renderExploring`, update the `examining_image` case:

```typescript
      case 'examining_image':
        this.popupRenderer.showImagePopup(
          state.sub.image,
          state.sub.caption,
          state.sub.innerHotspots,
          (hotspotId: string) => {
            this.dispatch({ type: 'INNER_HOTSPOT_CLICK', hotspotId });
          }
        );
        break;
```

- [ ] **Step 2: Update word_collected handler to show word names**

Replace the `word_collected` case:

```typescript
      case 'word_collected': {
        this.popupRenderer.dismiss();
        const wordNames = state.sub.wordIds.map(wid => {
          const wordDef = def.words?.[wid];
          return wordDef ? this.i18n.resolveText(wordDef.display) : wid;
        });
        if (wordNames.length === 1) {
          this.showWordToast(wordNames[0]);
        } else {
          this.showWordToast(wordNames.join(', '), wordNames.length);
        }
        break;
      }
```

- [ ] **Step 3: Add showWordToast method**

Add this method to the Renderer class (replace or augment existing `showToast`):

```typescript
  private showWordToast(wordDisplay: string, count?: number): void {
    this.removeToast();

    const toast = document.createElement('div');
    toast.className = 'gi-toast gi-toast--word';

    const icon = document.createElement('span');
    icon.className = 'gi-toast-icon';
    icon.textContent = '\u2728'; // sparkle unicode
    toast.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'gi-toast-text';
    if (count && count > 1) {
      text.textContent = `${count}개 단어 획득: ${wordDisplay}`;
    } else {
      text.textContent = `「${wordDisplay}」 획득!`;
    }
    toast.appendChild(text);

    this.toastEl = toast;
    this.container.appendChild(toast);

    // Auto-dismiss after 2.5s
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('gi-toast--exit');
      setTimeout(() => this.removeToast(), 300);
    }, 2500);
  }
```

- [ ] **Step 4: Verify build**

Run: `npm run build -w packages/runtime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/renderer/renderer.ts
git commit -m "feat(runtime): inner hotspot dispatch in popups, improved word collection toast"
```

---

## Task 10: Create PuzzleBarRenderer — bottom bar with puzzle tabs

**Files:**
- Create: `packages/runtime/src/renderer/puzzle-bar-renderer.ts`

- [ ] **Step 1: Create the puzzle bar renderer**

Create `packages/runtime/src/renderer/puzzle-bar-renderer.ts`:

```typescript
import type {
  PuzzleSet,
  Puzzle,
  SubPuzzle,
  CaseState,
  AssetManifest,
  GameEvent,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface PuzzleBarRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

/**
 * Renders a bottom bar with puzzle tabs during exploring state.
 * Each tab represents a puzzle (main + sub). Clicking opens a puzzle overlay.
 */
export class PuzzleBarRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private barEl: HTMLElement | null = null;

  constructor(opts: PuzzleBarRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  render(puzzles: PuzzleSet, caseState: CaseState): void {
    this.destroy();

    const bar = document.createElement('div');
    bar.className = 'gi-puzzle-bar';

    // Main puzzle tab
    const mainTab = this.createTab(
      puzzles.main,
      caseState.puzzleStates[puzzles.main.id]?.solved ?? false,
      this.getPuzzleIcon(puzzles.main.type)
    );
    bar.appendChild(mainTab);

    // Sub puzzle tabs
    for (const sub of puzzles.sub) {
      const subTab = this.createTab(
        sub,
        caseState.puzzleStates[sub.id]?.solved ?? false,
        this.getPuzzleIcon(sub.type)
      );
      bar.appendChild(subTab);
    }

    this.barEl = bar;
    this.container.appendChild(bar);
  }

  destroy(): void {
    if (this.barEl) {
      this.barEl.remove();
      this.barEl = null;
    }
  }

  updateSolvedState(puzzleId: string, solved: boolean): void {
    if (!this.barEl) return;
    const tab = this.barEl.querySelector<HTMLElement>(`[data-puzzle-id="${puzzleId}"]`);
    if (tab) {
      tab.classList.toggle('gi-puzzle-tab--solved', solved);
    }
  }

  private createTab(puzzle: Puzzle | SubPuzzle, solved: boolean, icon: string): HTMLElement {
    const tab = document.createElement('button');
    tab.className = 'gi-puzzle-tab';
    tab.dataset.puzzleId = puzzle.id;
    tab.setAttribute('aria-label', this.i18n.resolveText(puzzle.title));

    if (solved) {
      tab.classList.add('gi-puzzle-tab--solved');
    }

    const iconEl = document.createElement('span');
    iconEl.className = 'gi-puzzle-tab-icon';
    iconEl.textContent = icon;
    tab.appendChild(iconEl);

    const label = document.createElement('span');
    label.className = 'gi-puzzle-tab-label';
    label.textContent = this.i18n.resolveText(puzzle.title);
    tab.appendChild(label);

    tab.addEventListener('click', () => {
      this.dispatch({ type: 'OPEN_PUZZLE_OVERLAY', puzzleId: puzzle.id });
    });

    return tab;
  }

  private getPuzzleIcon(type: string): string {
    switch (type) {
      case 'fill_in_blank': return '\uD83D\uDD0D'; // magnifying glass
      case 'character_id': return '\uD83D\uDC64'; // bust in silhouette
      case 'timeline': return '\u23F3'; // hourglass
      case 'relationship': return '\uD83D\uDD17'; // link
      case 'scenario': return '\uD83D\uDCDC'; // scroll
      default: return '\u2753'; // question mark
    }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w packages/runtime`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/renderer/puzzle-bar-renderer.ts
git commit -m "feat(runtime): create PuzzleBarRenderer for bottom puzzle tab bar"
```

---

## Task 11: Create SubPuzzleRenderer — renderers for character_id, timeline, relationship

**Files:**
- Create: `packages/runtime/src/renderer/sub-puzzle-renderer.ts`

- [ ] **Step 1: Create the sub-puzzle renderer**

Create `packages/runtime/src/renderer/sub-puzzle-renderer.ts`:

```typescript
import type {
  SubPuzzle,
  CharacterIdPuzzle,
  TimelinePuzzle,
  RelationshipPuzzle,
  ScenarioPuzzle,
  PuzzleState,
  Word,
  ValidationResult,
  AssetManifest,
  GameEvent,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface SubPuzzleRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

/**
 * Renders sub-puzzle types (character_id, timeline, relationship, scenario)
 * inside the puzzle overlay.
 */
export class SubPuzzleRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private rootEl: HTMLElement | null = null;
  private slotElements: Map<string, HTMLElement> = new Map();
  private wordElements: Map<string, HTMLElement> = new Map();

  constructor(opts: SubPuzzleRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  render(
    puzzle: SubPuzzle,
    puzzleState: PuzzleState,
    collectedWords: Word[],
    assignedWordIds: Set<string>
  ): void {
    this.destroy();

    const root = document.createElement('div');
    root.className = 'gi-sub-puzzle';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', this.i18n.resolveText(puzzle.title));

    // Title
    const header = document.createElement('div');
    header.className = 'gi-sub-puzzle-header';
    const title = document.createElement('h3');
    title.textContent = this.i18n.resolveText(puzzle.title);
    header.appendChild(title);
    root.appendChild(header);

    // Content area — type-specific
    switch (puzzle.type) {
      case 'character_id':
        root.appendChild(this.renderCharacterId(puzzle, puzzleState, collectedWords));
        break;
      case 'timeline':
        root.appendChild(this.renderTimeline(puzzle, puzzleState, collectedWords));
        break;
      case 'relationship':
        root.appendChild(this.renderRelationship(puzzle, puzzleState, collectedWords));
        break;
      case 'scenario':
        root.appendChild(this.renderScenario(puzzle, puzzleState, collectedWords));
        break;
    }

    // Word bank
    root.appendChild(this.renderWordBank(collectedWords, assignedWordIds));

    // Controls
    const controls = document.createElement('div');
    controls.className = 'gi-sub-puzzle-controls';

    if (!puzzleState.solved) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'gi-btn';
      clearBtn.textContent = this.i18n.resolveKey('ui.clear_words');
      clearBtn.addEventListener('click', () => this.dispatch({ type: 'CLEAR_ALL_WORDS' }));
      controls.appendChild(clearBtn);

      const validateBtn = document.createElement('button');
      validateBtn.className = 'gi-btn gi-btn--primary';
      validateBtn.textContent = this.i18n.resolveKey('ui.validate');
      validateBtn.addEventListener('click', () => this.dispatch({ type: 'VALIDATE_PUZZLE' }));
      controls.appendChild(validateBtn);
    }

    root.appendChild(controls);

    this.rootEl = root;
    this.container.appendChild(root);
  }

  destroy(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
    this.slotElements.clear();
    this.wordElements.clear();
  }

  getSlotElements(): Map<string, HTMLElement> { return this.slotElements; }
  getWordElements(): Map<string, HTMLElement> { return this.wordElements; }

  showValidationResults(results: ValidationResult): void {
    for (const [slotId, result] of Object.entries(results.slotResults)) {
      const slotEl = this.slotElements.get(slotId);
      if (!slotEl) continue;
      slotEl.classList.remove('gi-slot--correct', 'gi-slot--partial', 'gi-slot--incorrect');
      slotEl.classList.add(`gi-slot--${result}`);
    }
  }

  updateSlotContent(slotId: string, wordId: string | null, words: Word[]): void {
    const slotEl = this.slotElements.get(slotId);
    if (!slotEl) return;
    slotEl.classList.remove('gi-slot--correct', 'gi-slot--partial', 'gi-slot--incorrect');

    if (wordId) {
      const word = words.find(w => w.id === wordId);
      slotEl.textContent = word ? this.i18n.resolveText(word.display) : wordId;
      slotEl.classList.remove('gi-slot--empty');
      slotEl.classList.add('gi-slot--filled');
      slotEl.dataset.wordId = wordId;
    } else {
      slotEl.textContent = slotEl.dataset.placeholder || '___';
      slotEl.classList.add('gi-slot--empty');
      slotEl.classList.remove('gi-slot--filled');
      delete slotEl.dataset.wordId;
    }
  }

  updateWordBankItem(wordId: string, assigned: boolean): void {
    const el = this.wordElements.get(wordId);
    if (el) el.classList.toggle('gi-word--assigned', assigned);
  }

  // --- Type-specific renderers ---

  private renderCharacterId(
    puzzle: CharacterIdPuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'gi-character-grid';

    for (const char of puzzle.characters) {
      const card = document.createElement('div');
      card.className = 'gi-character-card';

      // Portrait
      const portrait = document.createElement('div');
      portrait.className = 'gi-character-portrait';
      const src = this.resolveAssetSrc(char.portrait);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        portrait.appendChild(img);
      }
      card.appendChild(portrait);

      // Name slot
      const slot = document.createElement('span');
      slot.className = 'gi-slot gi-slot--empty';
      slot.dataset.slotId = char.nameSlotId;
      slot.dataset.placeholder = '???';
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;

      const assigned = state.slotAssignments[char.nameSlotId];
      if (assigned) {
        const word = words.find(w => w.id === assigned);
        slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
        slot.classList.remove('gi-slot--empty');
        slot.classList.add('gi-slot--filled');
        slot.dataset.wordId = assigned;
      } else {
        slot.textContent = '???';
      }

      slot.addEventListener('click', () => {
        if (slot.dataset.wordId) {
          this.dispatch({ type: 'UNASSIGN_WORD', slotId: char.nameSlotId });
        }
      });

      this.slotElements.set(char.nameSlotId, slot);
      card.appendChild(slot);
      grid.appendChild(card);
    }

    return grid;
  }

  private renderTimeline(
    puzzle: TimelinePuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const timeline = document.createElement('div');
    timeline.className = 'gi-timeline';

    for (const timeSlot of puzzle.slots) {
      const row = document.createElement('div');
      row.className = 'gi-timeline-row';

      const label = document.createElement('span');
      label.className = 'gi-timeline-label';
      label.textContent = this.i18n.resolveText(timeSlot.label);
      row.appendChild(label);

      const slot = document.createElement('span');
      slot.className = 'gi-slot gi-slot--empty';
      slot.dataset.slotId = timeSlot.slotId;
      slot.dataset.placeholder = '___';
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;

      const assigned = state.slotAssignments[timeSlot.slotId];
      if (assigned) {
        const word = words.find(w => w.id === assigned);
        slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
        slot.classList.remove('gi-slot--empty');
        slot.classList.add('gi-slot--filled');
        slot.dataset.wordId = assigned;
      } else {
        slot.textContent = '___';
      }

      slot.addEventListener('click', () => {
        if (slot.dataset.wordId) {
          this.dispatch({ type: 'UNASSIGN_WORD', slotId: timeSlot.slotId });
        }
      });

      this.slotElements.set(timeSlot.slotId, slot);
      row.appendChild(slot);
      timeline.appendChild(row);
    }

    return timeline;
  }

  private renderRelationship(
    puzzle: RelationshipPuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'gi-relationship';

    for (const edge of puzzle.edges) {
      const row = document.createElement('div');
      row.className = 'gi-relationship-edge';

      // From node
      const fromNode = puzzle.nodes.find(n => n.id === edge.fromNodeId);
      const fromLabel = document.createElement('span');
      fromLabel.className = 'gi-relationship-node';
      fromLabel.textContent = fromNode ? this.i18n.resolveText(fromNode.label) : edge.fromNodeId;
      row.appendChild(fromLabel);

      // Arrow
      const arrow = document.createElement('span');
      arrow.className = 'gi-relationship-arrow';
      arrow.textContent = '\u2192'; // →
      row.appendChild(arrow);

      // Slot
      const slot = document.createElement('span');
      slot.className = 'gi-slot gi-slot--empty';
      slot.dataset.slotId = edge.slotId;
      slot.dataset.placeholder = '___';
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;

      const assigned = state.slotAssignments[edge.slotId];
      if (assigned) {
        const word = words.find(w => w.id === assigned);
        slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
        slot.classList.remove('gi-slot--empty');
        slot.classList.add('gi-slot--filled');
        slot.dataset.wordId = assigned;
      } else {
        slot.textContent = '___';
      }

      slot.addEventListener('click', () => {
        if (slot.dataset.wordId) {
          this.dispatch({ type: 'UNASSIGN_WORD', slotId: edge.slotId });
        }
      });

      this.slotElements.set(edge.slotId, slot);
      row.appendChild(slot);

      // Arrow
      const arrow2 = document.createElement('span');
      arrow2.className = 'gi-relationship-arrow';
      arrow2.textContent = '\u2192';
      row.appendChild(arrow2);

      // To node
      const toNode = puzzle.nodes.find(n => n.id === edge.toNodeId);
      const toLabel = document.createElement('span');
      toLabel.className = 'gi-relationship-node';
      toLabel.textContent = toNode ? this.i18n.resolveText(toNode.label) : edge.toNodeId;
      row.appendChild(toLabel);

      container.appendChild(row);
    }

    return container;
  }

  private renderScenario(
    puzzle: ScenarioPuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    // Scenario is the same as fill_in_blank — reuse template rendering
    const el = document.createElement('div');
    el.className = 'gi-puzzle-template';

    for (const segment of puzzle.template.segments) {
      switch (segment.type) {
        case 'text': {
          const span = document.createElement('span');
          span.className = 'gi-text-segment';
          span.textContent = this.i18n.resolveText(segment.content);
          el.appendChild(span);
          break;
        }
        case 'slot': {
          const slot = document.createElement('span');
          slot.className = 'gi-slot gi-slot--empty';
          slot.dataset.slotId = segment.slotId;
          slot.dataset.placeholder = segment.placeholder
            ? this.i18n.resolveText(segment.placeholder)
            : '___';
          slot.setAttribute('role', 'button');
          slot.tabIndex = 0;

          const assigned = state.slotAssignments[segment.slotId];
          if (assigned) {
            const word = words.find(w => w.id === assigned);
            slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
            slot.classList.remove('gi-slot--empty');
            slot.classList.add('gi-slot--filled');
            slot.dataset.wordId = assigned;
          } else {
            slot.textContent = slot.dataset.placeholder;
          }

          slot.addEventListener('click', () => {
            if (slot.dataset.wordId) {
              this.dispatch({ type: 'UNASSIGN_WORD', slotId: segment.slotId });
            }
          });

          this.slotElements.set(segment.slotId, slot);
          el.appendChild(slot);
          break;
        }
        case 'line_break': {
          el.appendChild(document.createElement('br'));
          break;
        }
      }
    }

    return el;
  }

  // --- Shared ---

  private renderWordBank(words: Word[], assignedWordIds: Set<string>): HTMLElement {
    const bank = document.createElement('div');
    bank.className = 'gi-word-bank';

    const title = document.createElement('div');
    title.className = 'gi-word-bank-title';
    title.textContent = this.i18n.resolveKey('ui.word_bank');
    bank.appendChild(title);

    const list = document.createElement('div');
    list.className = 'gi-word-bank-list';

    for (const word of words) {
      const wordEl = document.createElement('span');
      wordEl.className = 'gi-word';
      wordEl.dataset.wordId = word.id;
      wordEl.textContent = this.i18n.resolveText(word.display);
      wordEl.tabIndex = 0;

      if (word.category) wordEl.classList.add(`gi-word--category-${word.category}`);
      if (assignedWordIds.has(word.id)) wordEl.classList.add('gi-word--assigned');

      this.wordElements.set(word.id, wordEl);
      list.appendChild(wordEl);
    }

    bank.appendChild(list);
    return bank;
  }

  private resolveAssetSrc(ref: string): string {
    const asset = this.assets.items[ref];
    if (!asset) return ref;
    if (asset.inline) {
      if (asset.inline.startsWith('data:')) return asset.inline;
      return `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.inline}`;
    }
    return asset.src;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w packages/runtime`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/src/renderer/sub-puzzle-renderer.ts
git commit -m "feat(runtime): create SubPuzzleRenderer for character_id, timeline, relationship, scenario"
```

---

## Task 12: Integrate puzzle bar and overlay into main Renderer

**Files:**
- Modify: `packages/runtime/src/renderer/renderer.ts`

- [ ] **Step 1: Import and instantiate PuzzleBarRenderer and SubPuzzleRenderer**

Add imports at top of `renderer.ts`:

```typescript
import { PuzzleBarRenderer } from './puzzle-bar-renderer.js';
import { SubPuzzleRenderer } from './sub-puzzle-renderer.js';
```

Add to class fields:

```typescript
  private puzzleBarRenderer: PuzzleBarRenderer;
  private subPuzzleRenderer: SubPuzzleRenderer;
  private puzzleOverlayEl: HTMLElement | null = null;
```

Instantiate in constructor:

```typescript
    this.puzzleBarRenderer = new PuzzleBarRenderer({
      container: this.container,
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });

    this.subPuzzleRenderer = new SubPuzzleRenderer({
      container: this.container, // will be re-parented into overlay
      i18n: this.i18n,
      assets: this.assets,
      dispatch: this.dispatch,
    });
```

Add to `clearView`:

```typescript
    if (!except.includes('puzzleBar')) this.puzzleBarRenderer.destroy();
    if (!except.includes('puzzleOverlay')) this.closePuzzleOverlay();
```

Add to `destroy`:

```typescript
    this.puzzleBarRenderer.destroy();
    this.subPuzzleRenderer.destroy();
    this.closePuzzleOverlay();
```

Add getter:

```typescript
  getSubPuzzleRenderer(): SubPuzzleRenderer {
    return this.subPuzzleRenderer;
  }
```

- [ ] **Step 2: Render puzzle bar during exploring state**

In `renderExploring`, after the scene is rendered and controls are set up, add puzzle bar:

```typescript
    // Render puzzle bar at bottom (always visible during exploring)
    const caseData2 = findCase(def, state.caseId);
    if (caseData2 && caseData2.puzzles) {
      this.puzzleBarRenderer.render(caseData2.puzzles, caseState);
    }
```

Add the `puzzle_overlay` sub-state handler in the switch:

```typescript
      case 'puzzle_overlay': {
        this.popupRenderer.dismiss();
        this.renderPuzzleOverlay(state.sub.puzzleId, state, save, def);
        break;
      }
```

- [ ] **Step 3: Add renderPuzzleOverlay and closePuzzleOverlay methods**

```typescript
  private renderPuzzleOverlay(
    puzzleId: string,
    state: GameState & { type: 'exploring' },
    save: SaveState,
    def: GameDefinition
  ): void {
    const caseData = findCase(def, state.caseId);
    if (!caseData) return;
    const caseState = save.caseStates[state.caseId];
    if (!caseState) return;

    const puzzle = findPuzzle(caseData.puzzles, puzzleId);
    if (!puzzle) return;
    const puzzleState = caseState.puzzleStates[puzzleId];
    if (!puzzleState) return;

    // Collect words
    const caseWords = this.collectWordsForCase(def, state.caseId, caseState);
    const assignedWordIds = new Set<string>();
    for (const wordId of Object.values(puzzleState.slotAssignments)) {
      if (wordId) assignedWordIds.add(wordId);
    }

    // Create or reuse overlay
    if (!this.puzzleOverlayEl) {
      const overlay = document.createElement('div');
      overlay.className = 'gi-puzzle-overlay';

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'gi-puzzle-overlay-close';
      closeBtn.textContent = '\u00D7'; // ×
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.addEventListener('click', () => {
        this.dispatch({ type: 'CLOSE_PUZZLE_OVERLAY' });
      });
      overlay.appendChild(closeBtn);

      // Content container
      const content = document.createElement('div');
      content.className = 'gi-puzzle-overlay-content';
      overlay.appendChild(content);

      this.puzzleOverlayEl = overlay;
      this.container.appendChild(overlay);
    }

    const content = this.puzzleOverlayEl.querySelector<HTMLElement>('.gi-puzzle-overlay-content');
    if (!content) return;

    // Check if this is a main puzzle (fill_in_blank) or sub-puzzle
    if ('template' in puzzle && puzzle.type === 'fill_in_blank') {
      // Use DeductionRenderer for main fill_in_blank
      this.subPuzzleRenderer.destroy();
      // Re-parent deduction renderer into overlay content
      content.innerHTML = '';
      const deductionContainer = document.createElement('div');
      content.appendChild(deductionContainer);

      // Create a temporary deduction renderer for the overlay
      const overlayDeduction = new (await_DeductionRenderer())({
        container: deductionContainer,
        i18n: this.i18n,
        assets: this.assets,
        dispatch: this.dispatch,
      });
      overlayDeduction.render(puzzle as Puzzle, puzzleState, caseWords, assignedWordIds);
    } else {
      // Use SubPuzzleRenderer for sub-puzzle types
      content.innerHTML = '';
      this.subPuzzleRenderer = new SubPuzzleRenderer({
        container: content,
        i18n: this.i18n,
        assets: this.assets,
        dispatch: this.dispatch,
      });
      this.subPuzzleRenderer.render(puzzle as SubPuzzle, puzzleState, caseWords, assignedWordIds);
    }
  }

  private closePuzzleOverlay(): void {
    this.subPuzzleRenderer.destroy();
    if (this.puzzleOverlayEl) {
      this.puzzleOverlayEl.remove();
      this.puzzleOverlayEl = null;
    }
  }
```

**Important fix:** The `await_DeductionRenderer()` above is a placeholder — replace with direct use. Since DeductionRenderer is already imported, use it directly:

```typescript
    if ('template' in puzzle && puzzle.type === 'fill_in_blank') {
      this.subPuzzleRenderer.destroy();
      content.innerHTML = '';

      const tempDeduction = new DeductionRenderer({
        container: content,
        i18n: this.i18n,
        assets: this.assets,
        dispatch: this.dispatch,
      });
      tempDeduction.render(puzzle as Puzzle, puzzleState, caseWords, assignedWordIds);
    }
```

- [ ] **Step 4: Update renderControls to remove the old single "추리" button**

In `renderControls`, replace the puzzle button section:

```typescript
    // Remove the old single puzzle button — puzzle bar at bottom now handles this
    // (Delete the old puzzleBtn creation code)
```

Remove the block that creates `puzzleBtn` in `renderControls`. The puzzle bar at the bottom now replaces it.

- [ ] **Step 5: Verify build**

Run: `npm run build -w packages/runtime`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/src/renderer/renderer.ts
git commit -m "feat(runtime): integrate puzzle bar and overlay into main renderer"
```

---

## Task 13: Update DragDropManager to work with puzzle overlay

**Files:**
- Modify: `packages/runtime/src/dragdrop/drag-drop-manager.ts`

- [ ] **Step 1: Update DragDropManager to also support SubPuzzleRenderer slots**

The DragDropManager already works based on CSS class selectors (`.gi-word`, `.gi-slot`). Since SubPuzzleRenderer uses the same CSS classes, drag-drop should work automatically.

However, we need to add `getSubPuzzleRenderer` to the options so it can find slots in both contexts:

In `drag-drop-manager.ts`, update the options interface:

```typescript
export interface DragDropManagerOptions {
  container: HTMLElement;
  dispatch: (event: GameEvent) => void;
  i18n: I18nManager;
  getDeductionRenderer: () => DeductionRenderer;
  getSubPuzzleRenderer?: () => SubPuzzleRenderer;
}
```

No other changes needed — the pointer-based hit testing already uses `document.elementFromPoint` and `.closest('.gi-slot')`, which will find slots in any renderer.

- [ ] **Step 2: Update engine.ts to pass getSubPuzzleRenderer**

In `packages/runtime/src/engine.ts`, update the DragDropManager construction:

```typescript
    this.dragDropManager = new DragDropManager({
      container: this.scalerEl,
      dispatch,
      i18n: this.i18n,
      getDeductionRenderer: () => this.renderer.getDeductionRenderer(),
      getSubPuzzleRenderer: () => this.renderer.getSubPuzzleRenderer(),
    });
```

- [ ] **Step 3: Verify build**

Run: `npm run build -w packages/runtime`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/src/dragdrop/drag-drop-manager.ts packages/runtime/src/engine.ts
git commit -m "feat(runtime): DragDropManager works with puzzle overlay sub-puzzle slots"
```

---

## Task 14: Update HotspotProperties editor — wordIds for examine/examine_image

**Files:**
- Modify: `packages/editor/src/components/properties/HotspotProperties.tsx`

- [ ] **Step 1: Add wordIds editor to ExamineAction editor**

In `HotspotProperties.tsx`, update the `examine` case in `ActionEditor`:

```typescript
    case 'examine':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <LocalizedTextInput label="내용" value={action.content} onChange={v => onChange({ ...action, content: v })} multiline />
          <LocalizedTextInput label="제목 (선택)" value={action.title ?? { ko: '', en: '' }} onChange={v => onChange({ ...action, title: v })} />
          <WordDropdown
            caseId={caseId}
            wordIds={action.wordIds ?? []}
            onChange={wordIds => onChange({ ...action, wordIds })}
            label="조사 시 수집할 단어"
          />
        </div>
      );
```

- [ ] **Step 2: Add wordIds editor to ExamineImageAction editor**

Update the `examine_image` case:

```typescript
    case 'examine_image':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="이미지 에셋 ID">
            <input type="text" value={action.image} onChange={e => onChange({ ...action, image: e.target.value })} style={{ width: '100%' }} />
          </Field>
          <LocalizedTextInput label="캡션 (선택)" value={action.caption ?? { ko: '', en: '' }} onChange={v => onChange({ ...action, caption: v })} />
          <WordDropdown
            caseId={caseId}
            wordIds={action.wordIds ?? []}
            onChange={wordIds => onChange({ ...action, wordIds })}
            label="조사 시 수집할 단어"
          />
          {action.innerHotspots && action.innerHotspots.length > 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 8, border: '1px dashed var(--border-color)', borderRadius: 4 }}>
              내부 핫스팟: {action.innerHotspots.length}개
            </div>
          )}
        </div>
      );
```

- [ ] **Step 3: Update WordDropdown to accept optional label prop**

Check if `WordDropdown` component accepts a `label` prop. If not, add it as an optional prop. The `WordDropdown` component is at `packages/editor/src/components/words/WordDropdown.tsx`. Read it and add a `label?: string` prop that renders above the dropdown if provided.

- [ ] **Step 4: Verify build**

Run: `npm run build -w packages/editor`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/editor/src/components/properties/HotspotProperties.tsx packages/editor/src/components/words/WordDropdown.tsx
git commit -m "feat(editor): add wordIds editor for examine and examine_image actions"
```

---

## Task 15: Run full test suite and fix any issues

**Files:**
- All test files

- [ ] **Step 1: Run all core tests**

Run: `npx vitest run packages/core/`
Expected: All PASS

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Clean build across all packages

- [ ] **Step 3: Run lint if available**

Run: `npm run lint` (if script exists)
Expected: No new errors

- [ ] **Step 4: Fix any issues found**

Address any type errors, test failures, or lint issues.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address build and test issues from golden idol UX improvements"
```

---

## Summary of Changes by Feature

### Feature 1: Multiple deduction elements (추리 요소 여러 개)
- Tasks 5, 10, 11, 12 — Puzzle overlay sub-state, PuzzleBarRenderer, SubPuzzleRenderer, integration

### Feature 2: Nested hotspots (핫스팟 안에 핫스팟)
- Tasks 2, 4, 8, 9 — innerHotspots in sub-state, INNER_HOTSPOT_CLICK handler, PopupRenderer inner hotspots

### Feature 3: Word collection from text/image hotspots (텍스트/이미지 핫스팟에서 단어 수집)
- Tasks 1, 3, 14 — wordIds on ExamineAction/ExamineImageAction, state machine handling, editor UI

### Feature 4: Better word collection popup (단어 수집 팝업 개선)
- Tasks 6, 7, 9 — wordIds array in sub-state, i18n keys, showWordToast with word names

### Feature 5: Bottom layout deduction UI (하단 레이아웃 추리)
- Tasks 5, 10, 12, 13 — puzzle_overlay sub-state, PuzzleBarRenderer, integration, DragDrop support
