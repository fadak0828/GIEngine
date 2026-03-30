# QA Report: runtime-fix-and-export

**Date:** 2026-03-30
**Branch:** feature/gi-engine-core
**Scope:** 6 changed files

---

## 1. Test Results

| Package | Test Files | Tests | Result |
|---------|-----------|-------|--------|
| `packages/core` | 5 | 66 (64 pre-existing + 2 new) | PASS |
| `packages/exporter` | 4 | 42 | PASS |
| `packages/editor` | 5 | 140 | PASS |

Total: **248 tests, all passing.**

---

## 2. TypeScript Checks

| Package | Result |
|---------|--------|
| `packages/core` | No errors |
| `packages/runtime` | No errors |
| `packages/exporter` | No errors |

---

## 3. Changed File Analysis

### `packages/core/src/models/types.ts`

**Change:** Added `WordDefinition` interface and `GameDefinition.words` optional field (`Record<string, WordDefinition>`).

**Assessment: Correct.**
- `WordDefinition` is structurally consistent with the `Word` type — carries `id`, `display`, `category?`, and `hint?` without the runtime-only fields (`caseId`, `imageUrl`).
- The field is declared `optional` (`words?`), which is backward-compatible with all existing game definitions that omit it.
- `sample-games/tutorial/game.json` correctly uses this field with 12 entries, all matching the expected shape.

### `sample-games/tutorial/game.json`

**Change:** Added `"words"` section at the top-level with 12 `WordDefinition` entries.

**Assessment: Correct.**
- All word IDs referenced by `word_reveal` hotspot actions (`word-secretary-kim`, `word-knife`, `word-park`, `word-study`, `word-living-room`, `word-poison`, `word-wine`, `word-kitchen`, `word-dinner`, `word-night`, `word-embezzlement`) are defined in the `words` map.
- `word-housekeeper-lee` is defined (used in the `character_id` sub-puzzle answer) but not revealed via a hotspot, which is a valid design choice.
- `id` fields inside each `WordDefinition` match the map keys — internally consistent.
- Categories are semantically correct (`person`, `place`, `object`, `time`, `motive`).

### `packages/core/src/state/state-machine.ts`

**Change:** Composite action handler (`case 'composite'`) was rewritten to accumulate `workingCaseState` across sub-actions so each sub-action sees the updated case state from previous sub-actions.

**Assessment: Correct.**
- The fix properly threads `workingCaseState` through each iteration of the sub-action loop.
- The `workingSave` is constructed from the accumulated state for each sub-action call.
- `accumulatedSaveState` is merged via spread, so later sub-actions' save updates win for non-`caseStates` fields (correct for effects like `currentPosition`).
- The final `nextState` is taken from the last sub-action, consistent with the intent: the last visible sub-state is what the player sees.
- Edge case: empty `actions` array → `noTransition` (guarded on line 335).

**Pre-fix behavior (now fixed):** Without the `workingCaseState` accumulation, a composite with two `word_reveal` sub-actions would only collect the second word, because the second sub-action would re-read the original `caseState` and the first word would not yet appear in `collectedWordIds`, causing the second call to return the new word but the first to be discarded.

### `packages/runtime/src/index.ts`

**Change:** Added `window.__giEngineBoot__` IIFE boot contract inside a `typeof window !== 'undefined'` guard.

**Assessment: Correct.**
- The guard prevents SSR/Node environments from crashing on `window`.
- The function signature `(root: HTMLElement, gameData: GameDefinition) => Promise<void>` matches what the exported HTML template expects.
- The function clears the root container and starts a fresh engine instance — correct for a self-contained export.
- Module-level exports are unaffected; this only adds a side effect when running in a browser context.

### `packages/exporter/src/browser-export.ts`

**Change:** Imports `runtimeJs` and `runtimeCss` via Vite `?raw` imports from the pre-built runtime dist files.

**Assessment: Correct for the intended build environment.**
- The `?raw` import suffix is a Vite-specific feature; it resolves the file content as a string at build time.
- `@ts-ignore` comments are appropriate because TypeScript does not understand `?raw` imports natively.
- The paths `../../runtime/dist/index.iife.js` and `../../runtime/dist/runtime.css` correctly point to the build output of the runtime package.
- The function is entirely synchronous and browser-safe — no Node.js APIs are used.
- Size breakdown calculation using `TextEncoder` is correct and browser-compatible.

**Limitation (by design):** The `?raw` imports mean `browser-export.ts` cannot be unit-tested in a Node/Vitest context without a Vite build or mock, since the `?raw` virtual modules are resolved by Vite's bundler. The Node-side `bundler.ts` covers the same HTML assembly path via the filesystem, and its tests already verify `breakdown.js > 0`.

### `packages/runtime/src/renderer/renderer.ts`

**Change:** Word lookup path in `extractWordsFromAction` now reads `def.words?.[wordId]` to obtain the `WordDefinition`, then constructs a `Word` object from it. Falls back to `{ ko: wordId, en: wordId }` if the definition is missing, with a `console.warn`.

**Assessment: Correct.**
- Optional chaining (`def.words?.[wordId]`) is safe when `words` is absent.
- Fallback display is defensive and does not throw.
- The warning is informative for game authors without being fatal.
- The `extractWordsFromAction` recursive walk also handles `composite` and `examine_image` with `innerHotspots` — matches the action type union in `types.ts`.

---

## 4. Coverage Gap Analysis

### Gap 1: Composite action accumulation (state-machine) — ADDRESSED

**Status: Gap existed; 2 new tests added.**

The existing composite tests only covered a single-sub-action composite (`hs-composite` with one `examine` action) and an empty composite. Neither test exercised the accumulation fix — the critical scenario is two `word_reveal` sub-actions where the second sub-action must see the first word already in `collectedWordIds`.

**Tests added to `packages/core/tests/state-machine-extra.test.ts`:**
1. `composite: two sequential word_reveal sub-actions both accumulate into collectedWordIds` — confirms both `word-alpha` and `word-beta` appear in the final `collectedWordIds`.
2. `composite: second sub-action (toggle_layer) sees updated caseState from first (word_reveal)` — confirms the word is collected AND the layer is toggled in the merged save state.

### Gap 2: Word lookup in renderer.ts — NOT TESTABLE (no unit test framework for DOM renderer)

**Status: Gap noted; no test added (would require DOM environment and full engine setup).**

The `Renderer` class is a DOM-heavy class with no unit tests. The word lookup via `def.words?.[wordId]` is exercised only through integration — running the engine with a game definition that has a `words` map. The sample game (`tutorial/game.json`) exercises this path by construction. A unit test would require either a jsdom environment or a storybook-style harness, which is out of scope for this QA pass.

**Recommendation:** Add a `renderer.test.ts` in a future sprint using jsdom and a fixture game definition.

### Gap 3: `browser-export.ts` runtimeJs non-empty — NOT TESTABLE in unit context

**Status: Gap noted; no test added (requires Vite build).**

The `browserExport` function's `runtimeJs` variable is populated by Vite's `?raw` import at build time. In the unit test environment, this resolves to an empty string (the module is not built), which would make `breakdown.js === 0`. The Node-side `bundler.test.ts` already verifies `breakdown.js > 0` via the filesystem path, providing equivalent coverage for the assembled HTML contract.

**Recommendation:** Add a Vite-powered integration test or an E2E test that builds the editor and exercises `browserExport` in a real browser context.

### Gap 4: `window.__giEngineBoot__` export — NOT TESTABLE in unit context

**Status: Gap noted; no test added (requires browser or jsdom window).**

The boot contract is attached to `window`, which is not available in Node/Vitest without a DOM environment. The contract is verified by the template test (`template-extra.test.ts`, line 70–78) which confirms the assembled HTML calls `__giEngineBoot__`. End-to-end verification requires a real browser.

---

## 5. Summary

| Category | Result |
|----------|--------|
| All pre-existing tests | PASS (246 tests) |
| New tests added | 2 (both passing) |
| TypeScript checks | PASS (0 errors, 3 packages) |
| Changed files correctness | All correct |
| Composite action fix | Verified correct; accumulation tests added |
| Word lookup in renderer | Correct; DOM unit test recommended for future |
| browser-export ?raw imports | Correct for Vite build context; E2E test recommended |
| window.__giEngineBoot__ | Correct; verified indirectly via template test |
