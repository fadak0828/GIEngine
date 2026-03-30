# Runtime Fix and Export Pipeline Repair

**Date**: 2026-03-30
**Status**: Draft
**Priority**: High

---

## 1. Problem Statement

The editor exports a single HTML file via `packages/exporter`, but the exported game does not run correctly. Two distinct problem areas exist:

1. **Export pipeline**: The browser-side exporter always embeds a placeholder runtime instead of the real compiled engine.
2. **Runtime engine gaps**: Several gameplay features are either broken or incomplete — word definitions, word bank population, hotspot action dispatch, deduction UI, and puzzle solving.

---

## 2. Problem Analysis

### 2.1 Export Pipeline — Always Uses Placeholder

**Root cause**: `packages/exporter/src/browser-export.ts` always uses `PLACEHOLDER_RUNTIME_JS` and `PLACEHOLDER_RUNTIME_CSS`. This placeholder renders a debug summary of the game JSON (id, version, act/case count) instead of actually running the game.

The real runtime exists as a pre-built IIFE bundle at:
```
packages/runtime/dist/index.iife.js   ← compiled, self-contained
packages/runtime/dist/runtime.css     ← runtime styles
```

The bundler (`bundler.ts`) does attempt to load the real runtime from disk, but uses ESM file paths that only resolve correctly in Node.js CLI contexts. The **browser exporter** (`browser-export.ts`) has no mechanism to access the pre-built runtime bundle at all — it is hardcoded to the placeholder.

**Consequence**: Every game exported from the editor shows a JSON summary screen, not a playable game.

### 2.2 Boot Contract Mismatch

The HTML template (`template.ts`) calls `window.__giEngineBoot__(root, gameData)` after parsing the embedded JSON. The **real runtime IIFE** (`packages/runtime/dist/index.iife.js`) exports a `GIEngine` class under `window.GIEngine`, but does **not** expose `window.__giEngineBoot__`. Therefore, even if the real JS were embedded, the auto-boot call in the template would silently fail.

### 2.3 Word Data Missing from Game Definition

The `Word` type (in `core/src/models/types.ts`) requires:
```ts
interface Word {
  id: string;
  display: LocalizedText;   // { ko, en }
  category?: WordCategory;
  caseId: string;
  hint?: LocalizedText;
}
```

However, `game.json` stores words only as IDs referenced inside `wordRevealAction.wordIds` and `puzzle.answers.*.correctWordId`. There is no top-level word dictionary in the `GameDefinition` schema. As a fallback, `Renderer.extractWordsFromAction()` creates dummy `Word` objects:
```ts
wordMap.set(wordId, { id: wordId, display: { ko: wordId, en: wordId }, caseId });
```
This means the word bank in the deduction UI shows raw IDs (e.g. `word-secretary-kim`) instead of human-readable labels (e.g. `김비서 / Secretary Kim`).

### 2.4 Hotspot HOTSPOT_CLICK Event Not Dispatched to State Machine

The `InputHandler` (`packages/runtime/src/input/input-handler.ts`) is attached to the scaler element. Hotspot click events do fire `onHotspotClick(hotspotId)` in `scene-renderer.ts`. However, the state machine's `HOTSPOT_CLICK` handler must then look up the hotspot's action and dispatch the correct sub-event. This chain must be verified to be complete end-to-end:

- `HOTSPOT_CLICK` → `state-machine.ts` `handleExploring` → resolves action type → dispatches word reveal / examine / navigate / toggle_layer.

Any gap in this chain causes hotspot clicks to be silently ignored.

### 2.5 Deduction UI — Word Bank Empty

Even if hotspot clicks work and words are collected (saved to `caseState.collectedWordIds`), the deduction renderer's word bank is populated from `Renderer.collectWordsForCase()`. This method:
1. Traverses all scene hotspots looking for `word_reveal` actions.
2. Builds a `Map<wordId, Word>` using the dummy fallback.
3. Filters by `caseState.collectedWordIds`.

The word bank will render, but all words show their IDs as labels unless `Word.display` is populated from a real source. Additionally, words referenced only in `composite` actions are handled by recursive extraction — this path must be tested.

### 2.6 Drag-and-Drop to Slots Not Wired

`DragDropManager` (`packages/runtime/src/dragdrop/drag-drop-manager.ts`) handles dragging words from the bank onto puzzle slots. Its `getDeductionRenderer()` dependency is correctly plumbed through the engine, but if the deduction renderer is not mounted (e.g., due to empty word bank), drag-drop has nothing to attach to. The click-to-assign fallback (`ASSIGN_WORD` event from slot click or word click) needs verification.

---

## 3. Scope

### In Scope

| # | Fix | Area |
|---|-----|-------|
| 1 | Embed real runtime IIFE into browser export | `packages/exporter/src/browser-export.ts` |
| 2 | Expose `window.__giEngineBoot__` from runtime IIFE | `packages/runtime/src/index.ts` + build config |
| 3 | Add `words` dictionary to `GameDefinition` schema | `packages/core/src/models/types.ts` |
| 4 | Populate word display names in `sample-games/tutorial/game.json` | `sample-games/tutorial/game.json` |
| 5 | Verify full `HOTSPOT_CLICK` → action dispatch chain | `packages/core/src/state/state-machine.ts` |
| 6 | Scene rendering: background image and hotspot overlay | `packages/runtime/src/renderer/scene-renderer.ts` |
| 7 | Deduction UI: word bank population from definition words | `packages/runtime/src/renderer/renderer.ts` |
| 8 | Puzzle solve: validate button → `VALIDATE_PUZZLE` → result display | `packages/runtime/src/renderer/deduction-renderer.ts` |

### Out of Scope

- Sub-puzzle types (`character_id`, `timeline`, `relationship`, `scenario`) — only `fill_in_blank` is targeted.
- Audio playback (`AudioManager`) — placeholder is acceptable for now.
- Save/load persistence across browser sessions — must not regress but is not the focus.
- Editor UI changes — this spec covers the runtime and export pipeline only.
- Performance optimisation, minification, or bundle size.

---

## 4. Proposed Changes

### 4.1 Add `words` to `GameDefinition`

**File**: `packages/core/src/models/types.ts`

Add a top-level word dictionary to `GameDefinition`:
```ts
export interface GameDefinition {
  // ... existing fields
  words: Record<string, WordDefinition>;  // wordId → display + metadata
}

export interface WordDefinition {
  id: string;
  display: LocalizedText;
  category?: WordCategory;
  hint?: LocalizedText;
}
```

This is purely additive and backward-compatible (treat as `{}` if absent).

**File**: `sample-games/tutorial/game.json`

Add a `words` section with display names for all referenced word IDs:
- `word-secretary-kim`, `word-knife`, `word-park`, `word-study`, `word-living-room`, etc.
- Each entry has `{ "id": "...", "display": { "ko": "...", "en": "..." }, "category": "..." }`.

### 4.2 Update `Renderer.collectWordsForCase()` to Use Definition Words

**File**: `packages/runtime/src/renderer/renderer.ts`

When extracting words, look up `def.words[wordId]` first; fall back to dummy if missing:
```ts
const wordDef = def.words?.[wordId];
wordMap.set(wordId, {
  id: wordId,
  display: wordDef?.display ?? { ko: wordId, en: wordId },
  category: wordDef?.category,
  caseId,
});
```

### 4.3 Expose `__giEngineBoot__` from Runtime IIFE

**File**: `packages/runtime/src/index.ts`

Add a boot function that the HTML template can call:
```ts
// Exported for IIFE auto-boot
(window as any).__giEngineBoot__ = async function(
  root: HTMLElement,
  gameData: GameDefinition
): Promise<void> {
  root.innerHTML = '';
  const engine = new GIEngine({ container: root, definition: gameData });
  await engine.start();
};
```

This must be placed at the module level so it is executed when the IIFE runs.

### 4.4 Embed Real Runtime in Browser Export

**File**: `packages/exporter/src/browser-export.ts`

The browser exporter runs inside the editor (a browser context). It cannot use `fs.readFile`. Instead:

**Option A — Build-time injection (recommended)**: During the editor build (Vite), import the runtime IIFE source as a raw string using Vite's `?raw` import:
```ts
import runtimeJs from '@gi-engine/runtime/dist/index.iife.js?raw';
import runtimeCss from '@gi-engine/runtime/dist/runtime.css?raw';
```
Replace `PLACEHOLDER_RUNTIME_JS` / `PLACEHOLDER_RUNTIME_CSS` with these imports in `browser-export.ts`.

**Option B — Runtime fetch**: Fetch the IIFE from a known URL at export time. Less reliable; Option A is preferred.

The exporter package already lists `@gi-engine/runtime` as a dependency, so this is a natural dependency resolution.

### 4.5 Verify HOTSPOT_CLICK Dispatch Chain

**File**: `packages/core/src/state/state-machine.ts`

The `handleExploring` function receives `HOTSPOT_CLICK { hotspotId }`. It must:
1. Find the scene's hotspot by `hotspotId`.
2. Dispatch the appropriate sub-event based on `hotspot.action.type`:
   - `examine` → set sub-state to `examining_text`
   - `examine_image` → set sub-state to `examining_image`
   - `word_reveal` → dispatch `COLLECT_WORD` for each `wordId`, set sub-state to `word_collected`
   - `navigate` → dispatch `NAVIGATE_SCENE`
   - `toggle_layer` → dispatch `TOGGLE_LAYER`
   - `composite` → process each action in sequence

Verify each branch is implemented correctly and none silently return `noTransition`.

---

## 5. Success Criteria

The fix is complete when all of the following pass:

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Exported HTML boots and shows case select screen | Open exported HTML in browser, verify case grid appears |
| 2 | Clicking a case navigates to scene view with background image | Click case 1, verify scene background renders |
| 3 | Hotspot click on `examine` shows popup with text | Click letter hotspot, verify popup text appears |
| 4 | Hotspot click on `word_reveal` adds word to bank | Click knife hotspot, open puzzle, verify word in bank |
| 5 | Word bank shows human-readable labels, not IDs | Word reads "칼 / Knife" not "word-knife" |
| 6 | Clicking puzzle button opens deduction UI | Click "추리" HUD button, verify fill-in-blank UI renders |
| 7 | Dragging or clicking word onto slot assigns it | Word assignment reflected in slot text |
| 8 | Validate button with correct assignments shows success | Fill all slots correctly, validate, see "All correct!" |
| 9 | Validate with wrong assignments shows failure with per-slot feedback | Wrong word → incorrect slot highlighted |
| 10 | Navigate hotspot transitions between scenes | Click door hotspot, scene changes |
| 11 | Toggle layer hotspot shows/hides layer | Click drawer, layer image appears/disappears |
| 12 | Export size includes real runtime JS (~50–200 KB), not 2 KB placeholder | Check file size of exported HTML |

---

## 6. Edge Cases and Error Handling

### 6.1 Missing Word Definitions

If a `wordId` referenced in `wordRevealAction.wordIds` is not found in `def.words`, the word bank must still function using the fallback `{ ko: wordId, en: wordId }` display. A `console.warn` should be emitted identifying the missing word ID.

### 6.2 Missing Background Asset

If `scene.background` resolves to an empty string or the asset has no `src`/`inline`, the scene should render without crashing. A blank/colored background is acceptable; no unhandled exception.

### 6.3 Broken Puzzle Reference

If `caseData.puzzles.main` is absent or `findPuzzle` returns `undefined`, the HUD puzzle button should be disabled or hidden. The deduction renderer must not crash when given `undefined`.

### 6.4 Empty Word Bank on Puzzle Open

If the player opens the puzzle before collecting any words, the word bank renders an empty list. This is correct behavior — the player must collect words by exploring scenes first.

### 6.5 Hotspot Condition Not Met

Hotspots with a `condition` field that evaluates to `false` are already excluded from rendering in `scene-renderer.ts`. Clicking a stale DOM reference must not dispatch events — verify that hotspot elements are recreated (not reused) on scene re-render.

### 6.6 Composite Action with Mixed Types

A `composite` action may contain `word_reveal` followed by `examine`. Both sub-actions must execute. The state machine must process composite actions atomically within a single transition so the render cycle sees the final combined state, not intermediate states.

### 6.7 Runtime IIFE Not Found at Build Time

If the raw import of `index.iife.js?raw` fails (e.g., runtime not built yet), the editor build must fail with a clear error message. A silent fallback to the placeholder is not acceptable in production builds.

### 6.8 Large Game Data (JSON > 5 MB)

The HTML template embeds game JSON inside a `<script type="application/json">` block. No size limit exists in the template. Very large datasets (many inlined base64 images) may cause slow parsing. This is a known limitation; no fix is required in this iteration.

---

## 7. File Change Map

| File | Change Type | Reason |
|------|-------------|--------|
| `packages/core/src/models/types.ts` | Additive | Add `words` field to `GameDefinition` |
| `packages/core/src/index.ts` | Additive | Export `WordDefinition` type |
| `packages/runtime/src/index.ts` | Additive | Expose `__giEngineBoot__` on `window` |
| `packages/runtime/src/renderer/renderer.ts` | Fix | Use `def.words` for word display lookup |
| `packages/exporter/src/browser-export.ts` | Fix | Import real runtime IIFE instead of placeholder |
| `packages/core/src/state/state-machine.ts` | Fix (verify) | Ensure HOTSPOT_CLICK fully dispatches all action types |
| `sample-games/tutorial/game.json` | Data | Add `words` dictionary with display names |

---

## 8. Open Questions

1. **Where does the editor call `browserExport`?** The editor package (`packages/editor`) presumably calls `browserExport()` on an export button click. Confirm the exact call site so the Vite `?raw` import is in the right build graph.

2. **Does the IIFE bundle currently include all dependencies?** The runtime's `vite.config.ts` sets `formats: ['es', 'iife']` and has no external rollup options, so all dependencies (including `@gi-engine/core`) should be bundled. Verify the IIFE output is truly self-contained by checking `window.GIEngine` is defined after loading.

3. **Should `words` be per-case or global?** Current design places `words` at the top-level of `GameDefinition` (global). Cross-case puzzle solving (case 3 in tutorial) reuses word IDs from earlier cases. A global dictionary is simplest. Confirm this is acceptable.

4. **Is the `cssPrefix` setting (`"gi-"`) used?** The CSS classes in the runtime use `gi-` prefix hardcoded (e.g., `gi-scene`, `gi-hotspot`). The `settings.cssPrefix` field is never read by the renderer. Either remove it from `GameSettings` or implement it — out of scope for this fix but should not block the fix.
