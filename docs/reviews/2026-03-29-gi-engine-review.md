# GIEngine Phase 1-3 Code Review

**Review Date**: 2026-03-29
**Reviewer**: Senior Code Review Agent
**Design Doc**: `docs/designs/2026-03-29-gi-engine.md`
**QA Report**: `docs/qa/2026-03-29-gi-engine-qa-report.md`
**Verdict**: APPROVED (with one Important fix required before next phase)

---

## Summary

| Category | Count |
|---|---|
| CRITICAL findings | 0 |
| IMPORTANT findings | 2 |
| MINOR / Suggestion findings | 5 |

All architecture and contract requirements from the design document are met. The state machine is a correct pure function, the save state is serializable, i18n has a proper fallback chain, drag-drop uses PointerEvents, responsive scaling uses CSS transform, and the exporter produces valid self-contained HTML with base64 inlined assets. One Important finding (window.resize listener leak) must be addressed before the runtime package is considered resource-safe; a second Important finding (missing `SaveManager.migrate()`) represents a contract gap against the design spec.

---

## Architecture Checklist

### Package Structure and Dependency Direction

Design specifies: `core (no deps) <- runtime <- exporter`, with exporter optionally taking an indirect runtime dependency for IIFE inlining.

- `@gi-engine/core/package.json`: no dependencies. Correct.
- `@gi-engine/runtime/package.json`: depends on `@gi-engine/core`. Correct.
- `@gi-engine/exporter/package.json`: depends on both `@gi-engine/core` and `@gi-engine/runtime`. This is correct per the design note that exporter inlines the runtime IIFE. No circular dependency exists.

The `packages/core/src/validation/schema.ts` file listed in the Phase 1 implementation plan (step 1.7) is absent. The bundler performs its own structural validation inline in `validateGameDefinition()`. This is a plan deviation — see Finding M-1.

### Public API Exports

- `packages/core/src/index.ts`: exports all types, `I18nManager`, `validatePuzzle`, `validateSubPuzzle`, `validateFillInBlank`, `transition`, `SaveManager`, `createInitialSaveState`. Complete and correct.
- `packages/runtime/src/index.ts`: exports `GIEngine` as both named and default export, plus all sub-system classes. Complete.
- `packages/exporter/src/index.ts`: exports `bundle`, `inlineAssets`, `getInlinedAssetsSize`, `assembleHtml` and their option types. Complete.

---

## Core Package

### StateMachine (`packages/core/src/state/state-machine.ts`)

The `transition()` function is a correct pure function. It accepts `(state, save, event, def)` and returns a new `StateTransitionResult` without modifying any of its inputs. All object updates use spread operators (`{ ...state }`, `{ ...save.caseStates, ... }`), confirming immutability.

All six game states defined in the design are handled: `loading`, `case_select`, `exploring`, `thinking`, `case_completed`, `game_completed`. The `default:` branch in the top-level switch calls `noTransition(state)`, which is safe (TypeScript's exhaustive-check warning is appropriate here but not a runtime risk).

One subtle logical pattern is worth noting (confirmed non-bug by QA report): the `CLOSE_PUZZLE` handler checks `save.caseStates[c.id].status === 'completed'` to determine if the game is complete, but that status mutation is produced by the `VALIDATE_PUZZLE` handler. This relies on the engine correctly merging save state between successive dispatches. `GIEngine.dispatch()` at `engine.ts:223` does perform this merge, so the two-step flow works correctly.

### ValidatorEngine (`packages/core/src/validator/validator.ts`)

The validator is a correct pure function. It never throws; every code path returns a `ValidationResult`. Empty slots (falsy `assigned`) return `'incorrect'` as designed. Sub-puzzle dispatch handles all four union members plus a safe default for unknown types. No issues.

The design signature uses `validateCharacterId` and `validateTimeline` as public exports; the implementation makes them private and exposes them only via `validateSubPuzzle`. This is an acceptable internal restructuring — it enforces a single entry point and is not a contract violation for consuming code.

One `as any` cast is present:

```
// packages/core/src/state/state-machine.ts:430,432
result = validatePuzzle(puzzle as any, puzzleState.slotAssignments);
result = validateSubPuzzle(puzzle as any, puzzleState.slotAssignments);
```

This cast is necessitated by the `findPuzzle()` return type (`Puzzle | SubPuzzle | undefined`) not discriminating between the two branches before calling the respective validator. It is safe at runtime because the `'answers' in puzzle` guard correctly narrows the type. See Finding M-2 for a suggestion to eliminate it.

### I18nManager (`packages/core/src/i18n/i18n.ts`)

The fallback chain is correctly implemented as: primary locale -> fallback locale -> any available value -> empty string with warning. This matches the design specification. The `getFallbackLocale()` accessor is present as an extra (beneficial) addition not in the design spec. No issues.

### SaveManager (`packages/core/src/save/save-manager.ts`)

The storage key is correctly scoped as `gi-save-${gameId}`, matching the design. Both `save()` and `load()` are wrapped in try/catch with warnings, as specified for the localStorage-full error case. The `clear()` method is present.

**IMPORTANT — Finding I-1**: The `migrate(old: unknown): SaveState` method specified in the design is absent. The design doc explicitly includes it in the `SaveManager` interface (section 2.4). Without a migration function, a game version bump will silently load an incompatible save (the engine at `engine.ts:101` only checks `gameId` equality, not version). This is a contract gap against the specification.

### InitialState (`packages/core/src/save/initial-state.ts`)

`createInitialSaveState()` correctly initializes all cases with `status: 'locked'` except the first (or all `'unlocked'` in `all_unlocked` mode), creates `PuzzleState` for every puzzle (main and sub), and sets `slotAssignments: {}` with no pre-filled values. `SaveState` contains only primitive types, strings, numbers, booleans, plain objects, and arrays — it is fully JSON-serializable. No issues.

---

## Runtime Package

### GIEngine (`packages/runtime/src/engine.ts`)

The engine correctly wires the state machine, renderer, input handler, keyboard handler, drag-drop manager, audio manager, and save manager. The `dispatch()` flow follows the design's unidirectional data flow: event -> `transition()` -> merge save -> execute effects -> re-render. No issues with the main loop.

**IMPORTANT — Finding I-2**: Event listener leak in `setupResponsiveScaling()`. When `ResizeObserver` is unavailable, the fallback registers:

```typescript
// engine.ts:474
window.addEventListener('resize', updateScale);
```

The `updateScale` function is a local closure — its reference is not stored anywhere. The `destroy()` method at line 322-326 only calls `this.resizeObserver.disconnect()`. On browsers or environments where `ResizeObserver` is absent, every `GIEngine` instance that is destroyed will leave a dangling `resize` listener on `window`. This causes a memory leak and may cause errors (accessing `this.scalerEl`, `this.container`, etc.) after destruction because the closure captures `this.container` and `this.scalerEl`.

Resolution: store the `updateScale` function reference as a class field alongside `this.resizeObserver`, and call `window.removeEventListener('resize', this.updateScaleBound)` in `destroy()` when `this.resizeObserver` is null.

The `setLocale()` method dispatches `CHANGE_LOCALE` to update the save state's locale, then immediately calls `this.i18n.setLocale(locale)` again. This is redundant because `CHANGE_LOCALE` in the state machine only mutates `saveState.currentLocale` — it does not update the live `I18nManager` instance. So the explicit call to `this.i18n.setLocale(locale)` is correct and necessary. However, the implied design is that the engine does not re-sync `i18n` from the save state on ordinary render cycles, meaning `saveState.currentLocale` and `i18n.getLocale()` could diverge if the save is loaded externally. This is an acceptable limitation for Phase 1-3 scope.

### DragDropManager (`packages/runtime/src/dragdrop/drag-drop-manager.ts`)

PointerEvent is used throughout (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`). HTML5 drag-and-drop API is not used. Pointer capture is set on `startDrag` and released on `pointerup`. Ghost element is always cleaned up in both `onPointerUp` and `cancelDrag`. The `detach()` method calls `cancelDrag()` before removing listeners, which prevents orphaned ghosts. This fully satisfies the design requirements.

### Responsive Scaling (`packages/runtime/src/engine.ts:setupResponsiveScaling`)

Scaling is implemented using `this.scalerEl.style.transform = \`scale(${scale})\``, which is CSS transform. Canvas is not used. This matches the design requirement. Subject to the listener leak described in Finding I-2.

### Renderer (`packages/runtime/src/renderer/renderer.ts`)

The `destroy()` method calls all sub-renderer `destroy()` methods and removes the controls/toast elements. The `clearView()` helper correctly destroys sub-renderers that are not being kept. The `extractWordsFromAction()` method uses `action: any` — see Finding M-3.

One concern with the `collectWordsForCase()` approach: words are reconstructed from hotspot `word_reveal` actions with `display: { ko: wordId, en: wordId }` as a fallback when no Word definition is found. This means the display text in the word bank will show raw word IDs if the game definition does not embed a word manifest. The design does not explicitly specify where `Word` definitions live in `GameDefinition`, and the current `types.ts` has a `Word` interface but no top-level `words` field on `GameDefinition` or `Case`. This is a data model gap — see Finding M-4.

### PopupRenderer — innerHTML with highlighted words

The `highlightText()` function at `popup-renderer.ts:145` correctly escapes HTML entities from the localized text string before wrapping matches in `<span>` tags. The word IDs used for matching are also escaped. The function is used via `body.innerHTML`, which would be an XSS risk if the input were not escaped. The escaping is present and correct. No critical issue, but it relies on the escaping being maintained if `highlightText` is ever extended.

### AudioManager

Follows the design's error-handling strategy: play failures are caught and silently ignored. `destroy()` properly closes the AudioContext and clears the SFX cache. Mobile unlock pattern (silent buffer on first user gesture) is implemented. No issues.

---

## Exporter Package

### Bundler (`packages/exporter/src/bundler.ts`)

`bundle()` produces a self-contained HTML file. The pipeline matches the design: load -> validate -> inline assets -> load runtime -> assemble HTML -> write. Assets are base64 encoded by `inlineAssets()`. The game JSON is embedded via a `<script type="application/json">` tag and parsed into `window.__GI_GAME_DATA__`. The runtime boot function is invoked as `window.__giEngineBoot__(root, gameData)`.

The design specifies minification in production mode via terser/cssnano. The current implementation does not minify — it merely omits JSON pretty-printing. This is a known Phase 1-3 scope limitation reflected in the placeholder runtime comment. No critical issue.

### Template (`packages/exporter/src/template.ts`)

`</script>` sequences are escaped with `replace(/<\/script>/gi, '<\\/script>')` in both the embedded game data and the runtime JS. The `lang` attribute uses `escapeAttr()` which escapes both `"` and `'`. The `<title>` uses `escapeHtml()` which escapes `&`, `<`, `>`, and `"`. XSS injection via game title or lang attribute is prevented. The auto-boot IIFE structure is correct.

### AssetInliner (`packages/exporter/src/asset-inliner.ts`)

Assets are read from disk and converted to `data:${mimeType};base64,${base64}` data URIs. Missing files are skipped gracefully with a warning. The `mimeType` from the asset manifest takes precedence over extension-guessing, with `application/octet-stream` as the ultimate fallback. SVG files are mapped to `image/svg+xml` without special treatment. Since SVG data URIs embedded in HTML can contain active content (scripts), this is potentially a concern if untrusted game content is exported. However, the exporter is a CLI tool for trusted content authors, so this is low risk in the intended use case.

### CLI (`packages/exporter/src/cli.ts`)

Accepts `--input` / `-i`, `--output` / `-o`, and `--mode` / `-m` flags as specified in the design. Also provides `--asset-dir`, `--analyze`, and `--help`. Missing input or output causes a non-zero exit. Invalid `--mode` values are rejected with an error message. The CLI exits with code 1 on bundle failure. All design requirements met.

---

## Code Quality

### Type Safety

Three `any` usages were identified:

1. `state-machine.ts:430,432` — `puzzle as any` when calling validator. Safe but avoidable (see M-2).
2. `renderer.ts:471` — `action: any` parameter in private `extractWordsFromAction()`. The function processes the full HotspotAction union recursively, so `any` is a pragmatic choice here, but the type could be `HotspotAction` since that union is already defined (see M-3).
3. Test files use `as any` to construct invalid game objects for validation testing. Acceptable in test code.

No `any` usage was found in critical production paths that could mask a type error leading to data corruption or incorrect game logic.

### Error Handling

All system boundaries have error handling:
- `SaveManager`: try/catch with fallback on load, warning on save failure.
- `AudioManager`: try/catch at every async boundary, silent degradation.
- `AssetInliner`: per-asset try/catch with graceful skip.
- `Bundler`: top-level error propagates to CLI which exits non-zero.
- `Renderer`: null-guards on `findCase`, `findScene`, `findPuzzle` throughout.

### No Hardcoded i18n Strings

All user-visible strings in the runtime go through `this.i18n.resolveKey()` or `this.i18n.resolveText()`. Engine-internal strings (e.g., `[GIEngine] Event:`) are developer console logs and do not need i18n. No issues.

### No Security Issues (Critical)

- No SQL/injection risks (no database).
- No `eval()` or `Function()` constructor usage.
- The `innerHTML` usage in `PopupRenderer.highlightText()` is guarded by entity escaping.
- The `<script>` injection in the template is guarded by `</script>` sequence escaping.
- The save-load path uses `JSON.parse()` which can throw but is wrapped in try/catch.

---

## Test Coverage

### Core Package (64 tests — PASS)

The state machine test suite covers all six game states, all event types, side-effect generation, the `CLOSE_PUZZLE` -> `game_completed` path, composite and toggle-layer hotspot actions, and the `all_unlocked` mode. Coverage is substantive and matches the 20+ tests called for in the design's test matrix.

The validator suite covers correct/partial/incorrect outcomes and empty slots. At 9 tests, this is below the design's target of 15+. However, all four sub-puzzle types are validated, and the branching is straightforward. This is Minor Finding M-5.

### Exporter Package (42 tests — PASS)

Bundler, template, asset-inliner, and validation are well covered. The XSS escaping and injection-prevention tests in `template-extra.test.ts` are valuable.

### Runtime Package (0 tests — known gap)

The QA report acknowledges this gap explicitly. The `happy-dom` devDependency is present but no tests are written. The design specifies 70%+ unit test coverage and integration tests for the runtime. This is a known deferred item for Phase 4.

---

## Findings

### IMPORTANT Findings (must fix)

**I-1: Missing `SaveManager.migrate()` method**
- File: `packages/core/src/save/save-manager.ts`
- Design spec section 2.4 lists `migrate(old: unknown): SaveState` as part of the `SaveManager` interface.
- The engine at `engine.ts:101` only checks `saved.gameId === this.definition.id`. It does not compare `gameVersion`. A save from a previous game version will be loaded as-is, which can corrupt game state if the `SaveState` schema changes between versions.
- Recommendation: Implement `migrate()` (even as a no-op that validates the version field and returns the input or `createInitialSaveState()` on mismatch), and add a `gameVersion` check in `GIEngine` constructor alongside the `gameId` check.

**I-2: `window.resize` listener not removed in `destroy()`**
- File: `packages/runtime/src/engine.ts`, lines 473-475 vs. lines 306-334
- The `updateScale` closure is registered on `window` as a fallback when `ResizeObserver` is unavailable. `destroy()` does not remove it because the reference is not stored.
- This causes a memory leak and potential use-after-free errors (the closure references `this.container` and `this.scalerEl` which are removed on destroy).
- Recommendation: Promote `updateScale` to a class field (e.g., `private resizeFallbackHandler: (() => void) | null = null`) and call `window.removeEventListener('resize', this.resizeFallbackHandler)` in `destroy()`.

### MINOR / Suggestion Findings

**M-1: `packages/core/src/validation/schema.ts` not implemented**
- Design step 1.7 specifies a JSON schema validation file. The bundler implements its own structural validation inline. The bundler validation is functional but is tied to the exporter and cannot be reused by other consumers of the core package (e.g., an editor or AI generator). Low priority for Phase 1-3.

**M-2: `as any` casts in state-machine.ts can be eliminated**
- File: `packages/core/src/state/state-machine.ts:429-432`
- The `'answers' in puzzle` type guard narrows `Puzzle | SubPuzzle` to the `Puzzle` branch but TypeScript still requires the cast. A dedicated type predicate function (e.g., `isPuzzleWithAnswers(p): p is Puzzle`) would eliminate the cast and make the narrowing explicit.

**M-3: `action: any` in `renderer.ts:extractWordsFromAction`**
- File: `packages/runtime/src/renderer/renderer.ts:471`
- The parameter type could be `HotspotAction` since the full union is available via `@gi-engine/core`. The method already handles `word_reveal`, `composite`, and `examine_image` discriminants. Using `HotspotAction` would enable exhaustive checking and catch future action type additions.

**M-4: No `Word` manifest on `Case` or `GameDefinition`**
- Files: `packages/core/src/models/types.ts`, `packages/runtime/src/renderer/renderer.ts:479`
- Words are reconstructed from hotspot actions with `display: { ko: wordId, en: wordId }` as a fallback. If `wordId` is `'w-murderer'`, the word bank will display `'w-murderer'` instead of a human-readable label. Game content authors must define a word manifest separately from hotspot wiring.
- Recommendation: Add a `words: Record<string, Word>` field to `Case` (or `GameDefinition`) and have `collectWordsForCase()` look up the display text from it, falling back to the ID only if no definition is found.

**M-5: Validator test count below design target**
- File: `packages/core/tests/validator.test.ts` (9 tests vs. 15+ target)
- All four sub-puzzle validators have passing tests in the state-machine integration tests, but direct validator unit tests do not cover `validateCharacterId`, `validateTimeline`, `validateRelationship`, or `validateScenario` directly. The 9 tests focus on `validateFillInBlank` and the routing function `validateSubPuzzle`. Suggest adding dedicated tests for each sub-puzzle validator for completeness.

---

## Plan Deviation Summary

| Deviation | Assessment |
|---|---|
| `schema.ts` not implemented (step 1.7) | Acceptable deferral — bundler validates inline |
| `migrate()` absent from SaveManager | Problematic gap — see Finding I-1 |
| Validator functions not public-exported individually | Acceptable — `validateSubPuzzle` as single entry point is better API design |
| Runtime has 0 unit tests | Known gap accepted for Phase 1-3 per QA report |
| Production minification (terser/cssnano) not implemented | Acceptable — design acknowledges bundle size concern but placeholder runtime is Phase 4 |

---

## What Was Done Well

- The pure-function state machine design is executed correctly with no hidden side effects.
- The `SaveState` is cleanly serializable — no class instances, no functions, no Symbols anywhere in the save data graph.
- The drag-drop implementation using `PointerEvent` with pointer capture is robust for both mouse and touch without needing two separate code paths.
- The HTML template injection protection (`</script>` escaping + `escapeHtml`/`escapeAttr`) is correct and covers the critical injection vectors.
- The fallback chain in `I18nManager.resolveText()` (locale -> fallback locale -> first available value -> warning) is thorough.
- Error handling at all system boundaries follows the design's tiered strategy (ignore/warn/throw at the appropriate level for each component).
- The 106-test suite with 0 failures across 9 test files provides solid coverage of all core logic.

---

**Verdict: APPROVED** — with the requirement that Finding I-2 (window.resize leak) is fixed before the runtime package ships, and Finding I-1 (SaveManager.migrate) is addressed before any version-bumping save compatibility work begins.
