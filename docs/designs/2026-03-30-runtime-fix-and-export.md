# Design: Runtime Fix and Export Pipeline Repair

**Date**: 2026-03-30
**Status**: Approved
**Spec**: docs/specs/2026-03-30-runtime-fix-and-export.md
**Priority**: High

---

## Overview

This document provides a concrete implementation plan for two interconnected repair tracks:

1. **Export Pipeline Fix** — Wire `browser-export.ts` to embed the real IIFE bundle instead of the placeholder, and establish the `window.__giEngineBoot__` contract between the runtime and the HTML template.
2. **Runtime Engine Fixes** — Populate word display labels from a new `words` dictionary in `GameDefinition`, and verify the full hotspot → state machine → UI render chain for all action types.

---

## A. Export Pipeline Fix

### A.1 Current State

`packages/exporter/src/browser-export.ts` imports and uses `PLACEHOLDER_RUNTIME_JS` and `PLACEHOLDER_RUNTIME_CSS` from `runtime-placeholder.ts`. These constants produce a debug-only JSON summary, not a playable game.

The real runtime is built by `packages/runtime/vite.config.ts` into:
- `packages/runtime/dist/index.iife.js` — self-contained IIFE bundle (all deps bundled; no external rollup options)
- `packages/runtime/dist/runtime.css` — extracted runtime CSS (cssCodeSplit: false)

The Vite config names the IIFE file `index.iife.js` (fileName format: `iife` → `index.iife.js`).

The HTML template (`template.ts`) already calls `window.__giEngineBoot__(root, gameData)` at line 73. The placeholder does expose `window.__giEngineBoot__`, but the real runtime (`packages/runtime/src/index.ts`) does not — it only exports `GIEngine` as a named and default export.

### A.2 Boot Contract: `window.__giEngineBoot__`

The HTML template's inline boot script:
1. Parses the JSON from `<script id="gi-game-data">`.
2. Assigns it to `window.__GI_GAME_DATA__`.
3. Inlines the JS bundle (which runs immediately as an IIFE).
4. Calls `window.__giEngineBoot__(root, gameData)` if the function exists.

The contract the runtime must satisfy:

```ts
window.__giEngineBoot__ = async function(
  root: HTMLElement,
  gameData: GameDefinition
): Promise<void>
```

Signature requirements:
- First arg: `HTMLElement` — the `#gi-engine-root` div (already in DOM).
- Second arg: `GameDefinition` — the parsed game JSON (already validated by the template).
- Must clear the container's inner HTML (removes the "Loading..." placeholder text).
- Must construct and start `GIEngine` with default options (`loadSave: true`, `designWidth: 1280`, `designHeight: 720`).
- Must be assigned to `window` at module level inside the IIFE so it is available synchronously when the template's outer `if` check runs.

### A.3 Vite `?raw` Import Approach

The editor's Vite build processes `packages/exporter/src/browser-export.ts`. To embed the runtime IIFE at build time, use Vite's `?raw` suffix which instructs Vite to import the file content as a plain string:

```ts
// packages/exporter/src/browser-export.ts
import runtimeJs from '@gi-engine/runtime/dist/index.iife.js?raw';
import runtimeCss from '@gi-engine/runtime/dist/runtime.css?raw';
```

This works because:
- The editor is a Vite app, so `?raw` is natively supported.
- `@gi-engine/runtime` is already a workspace dependency of `@gi-engine/exporter`.
- Vite resolves `@gi-engine/runtime/dist/index.iife.js` through the package's `exports` map or direct path resolution.
- The import produces a `string` at build time — no `fs` or Node APIs at runtime.

**Build-time failure requirement**: If the IIFE file does not exist (runtime not yet built), Vite will fail the editor build with a module-not-found error. This satisfies spec section 6.7 — a silent fallback to the placeholder is not acceptable.

**Size change**: The exported HTML will grow from ~2 KB (placeholder) to ~50–200 KB (real IIFE). The `breakdown.js` field in `BrowserExportResult` will correctly reflect the real JS size.

### A.4 `browser-export.ts` Changes

Replace the two placeholder imports with raw imports. Replace `PLACEHOLDER_RUNTIME_JS` / `PLACEHOLDER_RUNTIME_CSS` with `runtimeJs` / `runtimeCss` throughout the function body. The `assembleHtml` call signature does not change.

The `byteLength` calculations for `jsSize` and `cssSize` remain identical — they now measure the real bundle size.

### A.5 Template Compatibility

`template.ts` requires no changes. The existing boot script already handles the `window.__giEngineBoot__` call correctly:

```html
if (typeof window.__giEngineBoot__ === 'function') {
  window.__giEngineBoot__(document.getElementById('gi-engine-root'), gameData);
}
```

The IIFE runs before this `if` check (because the JS is inlined before the boot call in the same `<script>` block), so `window.__giEngineBoot__` will be defined when the check executes.

---

## B. Runtime Engine Fixes

### B.1 `index.ts` Boot Function

Add the following at module level in `packages/runtime/src/index.ts`, after the existing exports:

```ts
// IIFE boot contract — called by exported HTML template
(window as any).__giEngineBoot__ = async function(
  root: HTMLElement,
  gameData: GameDefinition
): Promise<void> {
  root.innerHTML = '';
  const engine = new GIEngine({
    container: root,
    definition: gameData,
    loadSave: true,
  });
  await engine.start();
};
```

What this receives:
- `root` — the `#gi-engine-root` element, guaranteed to be in the DOM when called.
- `gameData` — the parsed `GameDefinition` JSON. All fields present in the JSON are deserialized as-is; the engine does not validate the schema at runtime.

What it does:
- Clears the container (removes "Loading..." text).
- Constructs `GIEngine` with the container and game definition.
- `await engine.start()` handles asset preloading, transitions to `case_select` state, and resumes from saved position if any.

The import of `GameDefinition` type already flows through `@gi-engine/core` which is bundled into the IIFE (no external rollup options in `vite.config.ts`).

### B.2 Scene Renderer: Background Image

The `SceneRenderer.render()` method in `scene-renderer.ts` already handles background images correctly:

```ts
const bgSrc = this.resolveAssetSrc(scene.background);
if (bgSrc) {
  const bg = document.createElement('img');
  bg.className = 'gi-scene-bg';
  bg.src = bgSrc;
  ...
}
```

`resolveAssetSrc` resolves against `this.assets.items[ref]`:
- If `asset.inline` is set → uses the base64 data URI directly.
- If `asset.src` is set → uses the src path.
- If the ref is not found in the asset map → falls back to treating the ref as a direct URL.

**Missing image handling**: The `img.onerror` is not wired in the scene renderer (unlike in `engine.ts`'s `loadAssets`). If a background image 404s, the `<img>` will be empty but the scene div will still render with hotspots functional. No crash. This satisfies spec section 6.2 (blank background is acceptable).

**No code change needed** for background rendering — it already works correctly.

### B.3 Hotspot Overlay Click Handling

The `createHotspot` method in `scene-renderer.ts` creates a `<button>` with:
```ts
el.addEventListener('click', (e) => {
  e.stopPropagation();
  this.onHotspotClick(hotspot.id);
});
```

`onHotspotClick` is wired in `engine.ts` constructor:
```ts
onHotspotClick: (hotspotId: string) => {
  this.dispatch({ type: 'HOTSPOT_CLICK', hotspotId });
},
```

`dispatch` calls `transition()` which routes `HOTSPOT_CLICK` through `handleExploring` → `handleHotspotAction`.

**Hotspot element recreation on scene re-render**: The renderer checks `currentView !== exploring:${sceneId}` before calling `sceneRenderer.render()`. On the same scene (e.g., after a layer toggle), it calls `updateLayerVisibility()` only — it does NOT recreate hotspots. This is correct: hotspot conditions are evaluated at render time, so stale DOM elements from hotspots that should have disappeared are not an issue because the scene is fully re-rendered whenever `sceneId` changes. Layer toggles within the same scene do not re-render hotspots.

**No code change needed** for hotspot click handling — the chain is complete.

### B.4 Action Dispatch: All Action Types

The `handleHotspotAction` function in `state-machine.ts` covers all action types. Current implementation analysis:

| Action Type | Handler | Behavior | Status |
|---|---|---|---|
| `examine` | Sets `sub: { type: 'examining_text', content, title, highlightedWords }` | Popup renderer displays text | Complete |
| `examine_image` | Sets `sub: { type: 'examining_image', image, caption }` | Popup renderer displays image | Complete |
| `word_reveal` | Adds all new `wordIds` to `collectedWordIds`, sets `sub: { type: 'word_collected', wordId: newWords[0] }` | Toast appears | Complete |
| `navigate` | Updates `sceneId` directly on state, saves position | Scene changes | Complete |
| `toggle_layer` | Updates `layerVisibility` in save state | Layer shown/hidden | Complete |
| `composite` | Processes ONLY `action.actions[0]` — first action only | Partial | **BUG** |

**Composite action bug**: The comment in `state-machine.ts` reads:
```ts
// 복합 동작: 첫 번째 동작만 즉시 실행 (나머지는 런타임에서 순차 처리)
```

This delegates remaining actions to "the runtime", but the runtime has no mechanism to process composite action remainders. In the tutorial, `hs-word-secretary-kim` has a `composite` action with:
1. `word_reveal` → adds `word-secretary-kim` to collected words
2. `examine` → should show popup with text about Secretary Kim

The current code only processes the `word_reveal` (index 0). The `examine` (index 1) is silently dropped.

**Fix for composite actions**: Process all sub-actions atomically by accumulating state changes:

The fix in `state-machine.ts` should replace the `composite` case with a loop that processes all sub-actions, merging save state and effects. The final game state sub should reflect the last action's sub-state effect (with `examine` taking priority over `word_reveal` for display purposes), or show the `word_collected` toast first and then the popup on the next render cycle.

Simplest correct approach: process sub-actions sequentially, applying each to the accumulated state. The last action that modifies `sub` wins. Effects accumulate. This is atomic from the render perspective.

### B.5 Word Bank: Building from `def.words`

#### B.5.1 `GameDefinition` Extension

Add to `packages/core/src/models/types.ts`:

```ts
export interface WordDefinition {
  id: string;
  display: LocalizedText;
  category?: WordCategory;
  hint?: LocalizedText;
}

export interface GameDefinition {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  supportedLocales: Locale[];
  settings: GameSettings;
  acts: Act[];
  assets: AssetManifest;
  words?: Record<string, WordDefinition>;  // additive, optional for backward compat
}
```

The `words` field is optional (`?`) so existing `GameDefinition` objects without it are still valid. The runtime treats absence as an empty record.

Export `WordDefinition` from `packages/core/src/index.ts` by adding it to the existing `export * from './models/types.js'` re-export (no explicit line needed since it uses wildcard).

#### B.5.2 `Renderer.extractWordsFromAction()` Fix

In `packages/runtime/src/renderer/renderer.ts`, change `extractWordsFromAction` to look up `def.words` before falling back to the ID-as-label dummy:

```ts
private extractWordsFromAction(
  action: any,
  def: GameDefinition,
  caseId: string,
  wordMap: Map<string, Word>
): void {
  if (action.type === 'word_reveal') {
    for (const wordId of action.wordIds) {
      if (!wordMap.has(wordId)) {
        const wordDef = def.words?.[wordId];
        if (!wordDef) {
          console.warn(`[GIEngine] Word definition missing for id: "${wordId}". Using id as label.`);
        }
        wordMap.set(wordId, {
          id: wordId,
          display: wordDef?.display ?? { ko: wordId, en: wordId },
          category: wordDef?.category,
          caseId,
        });
      }
    }
  } else if (action.type === 'composite') {
    for (const sub of action.actions) {
      this.extractWordsFromAction(sub, def, caseId, wordMap);
    }
  } else if (action.type === 'examine_image' && action.innerHotspots) {
    for (const h of action.innerHotspots) {
      this.extractWordsFromAction(h.action, def, caseId, wordMap);
    }
  }
}
```

Note: `collectWordsForCase` already passes `def` to `extractWordsFromAction`. No signature change needed.

### B.6 Deduction UI: Slot Filling and Validation Feedback

The `DeductionRenderer` already has complete implementations for:

**Slot display** (`createSlot`):
- Filled: shows `i18n.resolveText(word.display)`.
- Empty: shows placeholder text from segment definition.
- Click-to-unassign: dispatches `UNASSIGN_WORD { slotId }`.
- Applies last validation class (`gi-slot--correct/partial/incorrect`) on re-render.

**Word bank display** (`renderWordBank`):
- Shows each collected `Word` with `i18n.resolveText(word.display)`.
- Marks assigned words with `gi-word--assigned` class.
- Category CSS class applied: `gi-word--category-{category}`.

**Validation feedback** (`showValidationResults`):
- Per-slot CSS classes: `gi-slot--correct` (green), `gi-slot--partial` (yellow), `gi-slot--incorrect` (red + shake animation via `gi-slot--animate`).
- Banner: `gi-validation-banner--success` ("All correct!") or `gi-validation-banner--failure` ("Try again").

**No code changes needed** in `deduction-renderer.ts`. The existing implementation is complete and correct. The only issue was that `collectWordsForCase` in `renderer.ts` was returning words with ID-as-label, which is fixed by B.5.2.

### B.7 State Machine Integration: How UI Reads/Writes State

The data flow is:

```
User interaction
  → DOM event (click/drag)
  → engine.dispatch(GameEvent)
  → transition(gameState, saveState, event, def)
  → { nextState, saveState delta, effects[] }
  → engine: merge state, execute effects
  → renderer.update(gameState, saveState, def)
  → renderer: diff currentView, re-render changed views
```

**Reading state** (renderer ← state):
- `renderer.update()` receives the full `GameState` and `SaveState` snapshot.
- `DeductionRenderer.render()` receives `puzzleState.slotAssignments` and `caseState.collectedWordIds` (via `collectWordsForCase`).
- Slot assignments are read-only from the renderer's perspective.

**Writing state** (renderer → state via dispatch):
- `UNASSIGN_WORD { slotId }`: slot click handler.
- `ASSIGN_WORD { slotId, wordId }`: drag-drop manager calls this after a valid drop.
- `VALIDATE_PUZZLE`: validate button click handler.
- `CLOSE_PUZZLE`: back button click handler.
- `OPEN_PUZZLE { puzzleId }`: HUD puzzle button in `renderer.ts` `renderControls()`.

**Thinking state view tracking**: The renderer uses `currentView === thinking:${puzzleId}` to avoid re-rendering the deduction UI on every state update. Sub-state changes (`showing_result`, `solved`) are handled by `showValidationResults()` called in `renderThinking` without re-mounting the full UI. This is correct.

---

## C. `sample-games/tutorial/game.json` — Words Dictionary

All word IDs referenced in the tutorial must be added to a top-level `words` object. The complete set of referenced word IDs, gathered from all `word_reveal` actions and `answers.*.correctWordId` / `partiallyCorrectWordIds` fields:

| Word ID | Korean | English | Category |
|---|---|---|---|
| `word-secretary-kim` | 김비서 | Secretary Kim | person |
| `word-knife` | 칼 | Knife | object |
| `word-park` | 박 회장 | Chairman Park | person |
| `word-study` | 서재 | Study | place |
| `word-living-room` | 거실 | Living Room | place |
| `word-poison` | 독약 | Poison | object |
| `word-wine` | 와인 잔 | Wine Glass | object |
| `word-kitchen` | 주방 | Kitchen | place |
| `word-dinner` | 저녁 식사 | Dinner | time |
| `word-night` | 밤 | Night | time |
| `word-embezzlement` | 횡령 | Embezzlement | motive |
| `word-housekeeper-lee` | 이 가정부 | Housekeeper Lee | person |

`word-housekeeper-lee` appears only in the `character_id` sub-puzzle answer (`answerId: "word-housekeeper-lee"`) but has no `word_reveal` hotspot. It still needs a definition entry since the sub-puzzle renderer may look it up.

The `words` block to add to `game.json` (at top level, after `acts`, before `assets`):

```json
"words": {
  "word-secretary-kim": {
    "id": "word-secretary-kim",
    "display": { "ko": "김비서", "en": "Secretary Kim" },
    "category": "person"
  },
  "word-knife": {
    "id": "word-knife",
    "display": { "ko": "칼", "en": "Knife" },
    "category": "object"
  },
  "word-park": {
    "id": "word-park",
    "display": { "ko": "박 회장", "en": "Chairman Park" },
    "category": "person"
  },
  "word-study": {
    "id": "word-study",
    "display": { "ko": "서재", "en": "Study" },
    "category": "place"
  },
  "word-living-room": {
    "id": "word-living-room",
    "display": { "ko": "거실", "en": "Living Room" },
    "category": "place"
  },
  "word-poison": {
    "id": "word-poison",
    "display": { "ko": "독약", "en": "Poison" },
    "category": "object"
  },
  "word-wine": {
    "id": "word-wine",
    "display": { "ko": "와인 잔", "en": "Wine Glass" },
    "category": "object"
  },
  "word-kitchen": {
    "id": "word-kitchen",
    "display": { "ko": "주방", "en": "Kitchen" },
    "category": "place"
  },
  "word-dinner": {
    "id": "word-dinner",
    "display": { "ko": "저녁 식사", "en": "Dinner" },
    "category": "time"
  },
  "word-night": {
    "id": "word-night",
    "display": { "ko": "밤", "en": "Night" },
    "category": "time"
  },
  "word-embezzlement": {
    "id": "word-embezzlement",
    "display": { "ko": "횡령", "en": "Embezzlement" },
    "category": "motive"
  },
  "word-housekeeper-lee": {
    "id": "word-housekeeper-lee",
    "display": { "ko": "이 가정부", "en": "Housekeeper Lee" },
    "category": "person"
  }
}
```

---

## D. Implementation Order

The following is the exact ordered sequence of file changes. Each step must be completed before the next because of type dependencies.

### Step 1: `packages/core/src/models/types.ts`
**Change type**: Additive

Add `WordDefinition` interface before the `Word` interface. Add the optional `words` field to `GameDefinition`.

```ts
// Add before the Word interface:
export interface WordDefinition {
  id: string;
  display: LocalizedText;
  category?: WordCategory;
  hint?: LocalizedText;
}

// Modify GameDefinition to add optional words field:
export interface GameDefinition {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  supportedLocales: Locale[];
  settings: GameSettings;
  acts: Act[];
  assets: AssetManifest;
  words?: Record<string, WordDefinition>;  // NEW
}
```

No other changes to this file.

### Step 2: `sample-games/tutorial/game.json`
**Change type**: Data addition

Add the `words` dictionary block (see section C) after the closing `]` of the `acts` array and before the `"assets"` key. The JSON must remain valid.

### Step 3: `packages/runtime/src/renderer/renderer.ts`
**Change type**: Fix

In `extractWordsFromAction`, change the `word_reveal` branch to look up `def.words?.[wordId]` before constructing the `Word` object. Add `console.warn` for missing definitions. No signature changes.

### Step 4: `packages/core/src/state/state-machine.ts`
**Change type**: Fix (composite action only)

Replace the `composite` case in `handleHotspotAction` with a loop that processes all sub-actions sequentially, accumulating save state changes and effects:

```ts
case 'composite': {
  if (action.actions.length === 0) return noTransition(state);

  // Process all sub-actions, accumulating state changes
  let currentResult: StateTransitionResult = noTransition(state);
  let accumulatedSaveState: Partial<SaveState> = {};
  const accumulatedEffects: SideEffect[] = [];

  // Start with a fresh case state that reflects previous sub-action mutations
  let workingCaseState = caseState;

  for (const subAction of action.actions) {
    const virtualHotspot: Hotspot = { ...hotspot, action: subAction };
    // Recompute from current accumulated save state
    const workingSave: SaveState = {
      ...save,
      caseStates: {
        ...save.caseStates,
        [state.caseId]: workingCaseState,
      },
      ...accumulatedSaveState,
    };

    const subResult = handleHotspotAction(
      currentResult.nextState as GameState & { type: 'exploring' },
      workingSave,
      def,
      virtualHotspot,
      workingCaseState
    );

    // Merge results
    if (subResult.nextState !== currentResult.nextState) {
      currentResult = subResult;
    }
    if (subResult.saveState?.caseStates?.[state.caseId]) {
      workingCaseState = subResult.saveState.caseStates[state.caseId];
    }
    if (subResult.saveState) {
      accumulatedSaveState = { ...accumulatedSaveState, ...subResult.saveState };
    }
    accumulatedEffects.push(...subResult.effects);
  }

  return {
    nextState: currentResult.nextState,
    saveState: accumulatedSaveState,
    effects: accumulatedEffects,
  };
}
```

### Step 5: `packages/runtime/src/index.ts`
**Change type**: Additive

Add the `window.__giEngineBoot__` assignment at module level after the existing exports. Add an import for `GameDefinition` type from `@gi-engine/core` if not already imported (currently the file only re-exports from `./engine.js` and subsystems; the type import for GameDefinition must be added).

```ts
// Add at top of file, after existing imports/exports:
import type { GameDefinition } from '@gi-engine/core';

// Add at bottom of file:
if (typeof window !== 'undefined') {
  (window as any).__giEngineBoot__ = async function(
    root: HTMLElement,
    gameData: GameDefinition
  ): Promise<void> {
    root.innerHTML = '';
    const engine = new GIEngine({
      container: root,
      definition: gameData,
      loadSave: true,
    });
    await engine.start();
  };
}
```

The `typeof window !== 'undefined'` guard ensures the module remains safe when used in SSR or Node.js test environments (vitest with `happy-dom` should have `window` defined, so tests still work).

### Step 6: Build the runtime IIFE

Before the exporter can import the real bundle, the runtime must be built:

```bash
cd packages/runtime && npm run build
```

This produces:
- `packages/runtime/dist/index.iife.js`
- `packages/runtime/dist/runtime.css`

These files must be committed to the repository or generated as part of the editor's prebuild step. If using a monorepo build pipeline, add `"prebuild": "npm run build --workspace=packages/runtime"` to the editor's `package.json`.

### Step 7: `packages/exporter/src/browser-export.ts`
**Change type**: Fix

Replace the two placeholder imports with Vite raw imports. Replace usage of `PLACEHOLDER_RUNTIME_JS` / `PLACEHOLDER_RUNTIME_CSS` with the raw-imported strings.

```ts
// Remove:
import { PLACEHOLDER_RUNTIME_JS, PLACEHOLDER_RUNTIME_CSS } from './runtime-placeholder.js';

// Add:
import runtimeJs from '@gi-engine/runtime/dist/index.iife.js?raw';
import runtimeCss from '@gi-engine/runtime/dist/runtime.css?raw';

// In browserExport function, replace:
//   css: PLACEHOLDER_RUNTIME_CSS   →   css: runtimeCss
//   js: PLACEHOLDER_RUNTIME_JS     →   js: runtimeJs
// And in byteLength calls:
//   byteLength(PLACEHOLDER_RUNTIME_JS)   →   byteLength(runtimeJs)
//   byteLength(PLACEHOLDER_RUNTIME_CSS)  →   byteLength(runtimeCss)
```

`runtime-placeholder.ts` can remain in the codebase for now (it is still used by `bundler.ts` in Node.js contexts if that path exists), but it is no longer imported by `browser-export.ts`.

---

## E. Error Handling

### E.1 Missing Word Definitions (spec 6.1)

**Location**: `renderer.ts` `extractWordsFromAction`

**Behavior**: If `def.words?.[wordId]` is `undefined`:
- Emit `console.warn('[GIEngine] Word definition missing for id: "wordId". Using id as label.')`.
- Use `{ ko: wordId, en: wordId }` as the display fallback.
- The word still appears in the bank and can be dragged to slots.
- The puzzle validator matches by `wordId` string, not by display text, so a correctly placed but unlabeled word still validates as correct.

### E.2 Missing Background Asset (spec 6.2)

**Location**: `scene-renderer.ts` `render()`

**Behavior**: `resolveAssetSrc` falls back to returning the raw ref string if the asset ID is not found in `assets.items`. The `<img>` tag will have a broken `src` and render as empty. The scene div still renders with full hotspot functionality. No crash.

If `scene.background` is an empty string `""`:
- `resolveAssetSrc("")` returns `""` (empty string is falsy in the `if (bgSrc)` check — wait, `""` is falsy in JS).
- Actually `if (bgSrc)` will be `false` for empty string, so no `<img>` tag is created at all. Scene renders with CSS background color.

No code change needed. Already handled.

### E.3 Broken Puzzle Reference (spec 6.3)

**Location**: `renderer.ts` `renderThinking()`

**Behavior**:
```ts
const puzzle = findPuzzle(caseData.puzzles, state.puzzleId);
if (!puzzle) return;   // early return, no render
```

If `caseData.puzzles.main` is absent at runtime (malformed JSON), `findPuzzle` returns `undefined` and `renderThinking` returns early without rendering anything. The container stays blank.

The HUD puzzle button in `renderControls` dispatches `OPEN_PUZZLE` with `caseData.puzzles.main.id`. If `puzzles.main` is undefined, this will throw a TypeError accessing `.id`.

**Fix needed in `renderer.ts` `renderControls()`**:
```ts
if (caseData && caseData.puzzles?.main) {
  const puzzleBtn = document.createElement('button');
  ...
  puzzleBtn.addEventListener('click', () => {
    this.dispatch({ type: 'OPEN_PUZZLE', puzzleId: caseData.puzzles.main.id });
  });
  right.appendChild(puzzleBtn);
}
```

Change the existing `if (caseData)` check to `if (caseData && caseData.puzzles?.main)` for the puzzle button creation block.

### E.4 Empty Word Bank on Puzzle Open (spec 6.4)

**Behavior**: `collectWordsForCase` returns `caseState.collectedWordIds.map(id => wordMap.get(id)).filter(...)`. If `collectedWordIds` is empty, returns `[]`. `renderWordBank` iterates an empty array and renders only the title with an empty list. No crash.

The word bank will show "단어 모음" header and an empty list. This is correct — the player must collect words first.

No code change needed.

### E.5 Hotspot Condition Not Met (spec 6.5)

**Location**: `scene-renderer.ts` `render()`

**Behavior**: Hotspots with failing conditions are skipped during the render loop — no DOM element is created for them. Re-renders on the same scene (`updateLayerVisibility`) do not recreate hotspot elements, so there are no stale click handlers. Scene re-render only happens when `sceneId` changes, at which point all hotspots are freshly evaluated.

No code change needed.

### E.6 Composite Action with Mixed Types (spec 6.6)

**Behavior after fix in Step 4**: All sub-actions are processed atomically within a single `transition()` call. The final `nextState` reflects the last sub-action's effect on `state.sub`. For the tutorial's `hs-word-secretary-kim` composite (`word_reveal` + `examine`):
1. `word_reveal` → sets `sub: { type: 'word_collected', wordId: 'word-secretary-kim' }`, adds to `collectedWordIds`.
2. `examine` → sets `sub: { type: 'examining_text', content: ..., title: undefined }`.

Final `nextState.sub` is `examining_text` (examine wins, being last). The word is collected in save state. On render, the popup shows the text about Secretary Kim, and the word is now in the bank.

Both effects are visible to the next render call. The state machine processes the composite atomically — the renderer sees only the final combined state.

### E.7 Runtime IIFE Not Found at Build Time (spec 6.7)

**Behavior**: Vite's `?raw` import will throw a module resolution error at editor build time if `packages/runtime/dist/index.iife.js` does not exist. The error message from Vite is clear:

```
Could not resolve "@gi-engine/runtime/dist/index.iife.js"
```

This is intentional. The runtime must be built before the editor can be built. Document this in the editor's `package.json` prebuild or CI pipeline.

**Alternative** (if lazy evaluation is preferred): Use a Vite plugin to generate the raw string inline, or configure a `vite.config.ts` pre-build hook. For this implementation, the simpler static import failure is preferred.

### E.8 Large Game Data (spec 6.8)

No change. The HTML template embeds JSON in a `<script type="application/json">` tag with no size limit. This is a known limitation.

---

## F. Files Changed Summary

| # | File | Change | Why |
|---|---|---|---|
| 1 | `packages/core/src/models/types.ts` | Add `WordDefinition` interface; add `words?` to `GameDefinition` | Schema extension for word display data |
| 2 | `sample-games/tutorial/game.json` | Add top-level `words` dictionary with 12 entries | Provide human-readable labels for all referenced word IDs |
| 3 | `packages/runtime/src/renderer/renderer.ts` | Fix `extractWordsFromAction` to look up `def.words?.[wordId]`; add `console.warn` for missing defs | Word bank shows readable labels instead of raw IDs |
| 4 | `packages/core/src/state/state-machine.ts` | Fix `composite` action handler to process all sub-actions, not just first | Composite hotspots (word_reveal + examine) fully execute |
| 5 | `packages/runtime/src/index.ts` | Add `window.__giEngineBoot__` assignment at module level | HTML template boot contract satisfied |
| 6 | `packages/exporter/src/browser-export.ts` | Replace placeholder imports with Vite `?raw` imports of real IIFE | Exported HTML runs real game engine |
| 7 | `packages/runtime/vite.config.ts` | No change needed | IIFE output already configured correctly |
| 8 | `packages/exporter/src/template.ts` | No change needed | Boot contract already calls `__giEngineBoot__` |
| 9 | `packages/core/src/state/state-machine.ts` | Also: add null-guard fix in `renderer.ts` `renderControls()` for missing `puzzles.main` | Prevent crash on malformed game JSON |

Note: `packages/core/src/index.ts` requires no explicit change — `WordDefinition` will be exported via the existing `export * from './models/types.js'` wildcard.

---

## G. Key Design Decisions

### G.1 `words` as Optional Global Dictionary

`words` is placed at the top level of `GameDefinition` (not per-case) because:
- Case 3's puzzle uses `word-secretary-kim` which is collected in case 1. A global dictionary handles cross-case word reuse naturally.
- Backward compatibility: old `GameDefinition` objects without `words` continue to work via the ID-as-label fallback.
- The `caseId` field on `Word` objects (internal runtime type) is still populated from the `caseId` parameter in `extractWordsFromAction` — the global `WordDefinition` does not need a `caseId` since that is runtime context, not definition data.

### G.2 `?raw` Import vs. Fetch

Vite `?raw` is chosen over a runtime fetch because:
- The export must work offline (the exported HTML is a single self-contained file).
- `?raw` is resolved at editor build time — the bundle size of the editor includes the IIFE as a string constant.
- No async loading complexity in `browser-export.ts` (the function remains synchronous).

### G.3 Composite Action Fix Strategy

The simplest correct fix is to process all sub-actions sequentially within a single transition call, accumulating a merged result. An alternative of queuing remaining actions in save state was rejected because it would require a new event type and additional state complexity. The atomic approach is consistent with the state machine's pure-function design.

### G.4 No Changes to Drag-Drop or Keyboard Handlers

`DragDropManager` dispatches `ASSIGN_WORD` events after successful drops. The state machine already handles `ASSIGN_WORD` fully in `handleThinking`. `updateSlotContent` and `updateWordBankItem` on `DeductionRenderer` are called by the drag-drop manager directly (bypassing the dispatch cycle) for immediate visual feedback. The underlying state update via `ASSIGN_WORD` then triggers a full re-render which reconciles. This pattern is already implemented and requires no changes.
