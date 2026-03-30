# Code Review: runtime-fix-and-export

**Date:** 2026-03-30
**Branch:** feature/gi-engine-core
**Reviewer:** Reviewer Agent
**Design Document:** docs/designs/2026-03-30-runtime-fix-and-export.md
**QA Report:** docs/qa/2026-03-30-runtime-fix-and-export-qa-report.md

---

## 1. Summary

Six files were changed as part of two interconnected tracks: the export pipeline fix (wiring the real runtime IIFE into the exported HTML) and the runtime engine fixes (composite action, word label display, boot contract). The implementation is substantially correct and aligns closely with the design document.

One critical finding was identified — the `renderControls` null-guard for `caseData.puzzles?.main` was missing, which the design explicitly required (section E.3 and F row 9). This fix was applied directly during this review. All other issues are minor observations with no blocking impact.

**Net verdict after fix applied: APPROVED.**

---

## 2. Plan Alignment

| Design Section | Status | Notes |
|---|---|---|
| A. Export Pipeline (browser-export.ts) | Aligned | Relative path used instead of package path — see section 4.1 |
| B.1 Boot Contract (index.ts) | Aligned | Matches spec exactly |
| B.4 Composite Action Fix (state-machine.ts) | Aligned | Full accumulation loop implemented correctly |
| B.5 Word Bank (renderer.ts + types.ts) | Aligned | Optional chaining, fallback, warn — all present |
| C. game.json words dictionary | Aligned | All 12 entries present and verified correct |
| D. Implementation Order | Aligned | Types → JSON → Renderer → StateMachine → Runtime → Exporter |
| E.3 renderControls null-guard | **MISSED (fixed)** | Guard was `if (caseData)` instead of `if (caseData && caseData.puzzles?.main)` |

---

## 3. File-by-File Assessment

### 3.1 `packages/core/src/models/types.ts`

**Assessment: Correct.**

- `WordDefinition` interface is placed before `Word` as required, after `CompositeAction`.
- Fields: `id`, `display`, `category?`, `hint?` — structurally consistent with `Word` (omits runtime-only `caseId`, `imageUrl`).
- `GameDefinition.words?` is declared as `Record<string, WordDefinition>` with the `?` making it optional — fully backward-compatible with existing game definitions.
- `WordDefinition` is exported via the existing wildcard `export * from './models/types.js'` in `packages/core/src/index.ts` — no explicit export line required.
- No `any` types introduced. No unsafe casts. Type-safe throughout.

### 3.2 `sample-games/tutorial/game.json`

**Assessment: Correct.**

- All 12 word IDs listed in design section C are present.
- Spot-checked against design table: `word-dinner` (category: `time`, ko: `저녁 식사`), `word-embezzlement` (category: `motive`), `word-housekeeper-lee` (category: `person`, ko: `이 가정부`) — all match.
- Internal consistency: `id` field inside each entry matches the map key.
- Note: `words` key appears after `assets` in the JSON key order (position 8 vs 7). JSON object key order is non-normative and has no semantic impact; this deviation from the design's suggested placement ("after acts, before assets") is inconsequential.

### 3.3 `packages/core/src/state/state-machine.ts`

**Assessment: Correct. Composite action fix verified sound.**

The accumulation loop correctly threads `workingCaseState` through each sub-action iteration. The spread order analysis:

```
workingSave = {
  ...save,
  caseStates: { ...save.caseStates, [caseId]: workingCaseState },
  ...accumulatedSaveState
}
```

On the first iteration, `accumulatedSaveState` is `{}` so the explicit `workingCaseState` wins. On subsequent iterations, `accumulatedSaveState.caseStates` contains the result of the previous sub-action (which is also what `workingCaseState` holds), so both branches agree — the spread order produces the correct result.

Edge case (sub-action that returns no `caseStates`, e.g., `navigate`): `workingCaseState` is not updated (guarded by the `if` check on line 367), and `accumulatedSaveState.caseStates` retains its previous value. Correct.

Empty actions array: guarded by `if (action.actions.length === 0) return noTransition(state)` on line 335. Correct.

### 3.4 `packages/runtime/src/index.ts`

**Assessment: Correct.**

- `typeof window !== 'undefined'` guard is present — safe in SSR / Node.js environments.
- `GameDefinition` is imported as a `type` import — no runtime import of `@gi-engine/core` at module level (it is already bundled in the IIFE anyway, but the type-only import is correct style).
- `GIEngine` is re-imported as `_GIEngine` to avoid shadowing the named export. Correct pattern.
- Boot function signature `(root: HTMLElement, gameData: GameDefinition) => Promise<void>` matches exactly what `template.ts` line 74 calls.
- `root.innerHTML = ''` is a safe assignment of a constant empty string — not user data. Removes the "Loading..." placeholder as required.
- No `eval()`. No unsafe `innerHTML` with user data.

### 3.5 `packages/runtime/src/renderer/renderer.ts`

**Assessment: Correct after applied fix.**

The `extractWordsFromAction` method correctly uses `def.words?.[wordId]` (optional chaining), logs a `console.warn` for missing definitions, and falls back to `{ ko: wordId, en: wordId }`. The recursive walk handles `composite` and `examine_image` with `innerHotspots`. Type safety: `action` parameter is typed `any` which is necessary because this is a recursive dispatch over the union type — acceptable.

**Fix applied by this review (Critical):**

The `renderControls` method used `if (caseData)` as the guard for creating the puzzle HUD button, then accessed `caseData.puzzles.main.id` unconditionally. Design section E.3 explicitly required this guard to be `if (caseData && caseData.puzzles?.main)` to prevent a `TypeError` when `game.json` has a malformed or missing `puzzles.main` field.

Before fix:
```ts
if (caseData) {
  const puzzleBtn = ...
  this.dispatch({ type: 'OPEN_PUZZLE', puzzleId: caseData.puzzles.main.id });
```

After fix:
```ts
if (caseData && caseData.puzzles?.main) {
  const puzzleBtn = ...
  this.dispatch({ type: 'OPEN_PUZZLE', puzzleId: caseData.puzzles.main.id });
```

### 3.6 `packages/exporter/src/browser-export.ts`

**Assessment: Correct. Path deviation from design is a justified improvement.**

**Path deviation from design**: The design (section A.3) specified:
```ts
import runtimeJs from '@gi-engine/runtime/dist/index.iife.js?raw';
```

The implementation uses:
```ts
import runtimeJs from '../../runtime/dist/index.iife.js?raw';
```

This is a beneficial deviation. The runtime `package.json` exports map only exposes `"."` (the main ESM entry), not `"./dist/index.iife.js"`. Accessing a non-exported path via the package name (`@gi-engine/runtime/dist/...`) would fail in environments with strict package exports enforcement (Node.js 12+ with `"exports"` field). The relative path bypasses the exports map and directly addresses the file, which is more reliable for this monorepo build context.

**`@ts-ignore` comments**: The two `@ts-ignore` directives on the `?raw` imports are appropriate because TypeScript does not understand Vite's `?raw` suffix. These directives are targeted (they suppress only the immediately following line) and accurately explained in the comments.

**Size calculation**: `byteLength(runtimeJs)` and `byteLength(runtimeCss)` use `TextEncoder`, which is browser-safe and correct for UTF-8 byte counting.

**Build-time failure requirement**: If `packages/runtime/dist/index.iife.js` does not exist, Vite will emit a module-not-found error at editor build time. The dist files are confirmed present in the repository (`packages/runtime/dist/` directory exists with both `index.iife.js` and `runtime.css`). This satisfies the design's requirement (section A.3) that silent fallback is not acceptable.

---

## 4. Boot Contract Verification

The boot contract chain was traced end-to-end:

1. **Template** (`template.ts` line 70-75): Inlines `safeJs` (the IIFE) then calls `window.__giEngineBoot__(root, gameData)`.
2. **Runtime** (`index.ts` lines 24-37): The IIFE runs at module level and assigns `window.__giEngineBoot__` before the template's `if` check executes. The IIFE is self-executing — it runs synchronously when the `<script>` tag is evaluated. The template's check comes after the inlined script, so the function is defined when the `if` runs.
3. **Signature match**: Template passes `(HTMLElement, GameDefinition)`. Runtime accepts `(root: HTMLElement, gameData: GameDefinition)`. Exact match.
4. **Async handling**: The template does not `await` the boot call. The boot function's returned `Promise<void>` is fire-and-forget. This is correct — the engine manages its own loading state internally.

---

## 5. Security Assessment

| Concern | Finding |
|---|---|
| `eval()` | Not present in any changed file |
| `innerHTML` with user data | Not present. Only use is `root.innerHTML = ''` (constant empty string) |
| Unsafe type casts | Only `(window as any).__giEngineBoot__` — necessary for browser globals, isolated |
| User input in HTML template | `escapeHtml()` and `escapeAttr()` used for title and lang in `template.ts`; game JSON embedded in `<script type="application/json">` tag which browsers do not execute |
| Script injection via game JSON | `gameData.replace(/<\/script>/gi, '<\\/script>')` in `template.ts` prevents early `</script>` tag termination |

No security issues found.

---

## 6. Backward Compatibility

Old `game.json` files without a `words` field continue to work correctly:
- `GameDefinition.words` is optional (`?`) in TypeScript — no compilation error.
- `def.words?.[wordId]` returns `undefined` when `words` is absent — fallback to ID-as-label applies.
- The `console.warn` fires for each missing word definition, alerting game authors without crashing.

---

## 7. Issues Found

### Critical (fixed during review)

**C-01: Missing `caseData.puzzles?.main` null-guard in `renderControls`**
- File: `packages/runtime/src/renderer/renderer.ts`
- Design reference: Section E.3 and F (row 9)
- Problem: `if (caseData)` guard does not protect against `caseData.puzzles.main` being undefined when game JSON is malformed. `caseData.puzzles.main.id` would throw `TypeError`.
- Fix: Changed guard to `if (caseData && caseData.puzzles?.main)`.
- Status: Fixed by this review.

### Important (should fix in follow-up)

**I-01: `extractWordsFromAction` uses `action: any` parameter**
- File: `packages/runtime/src/renderer/renderer.ts`
- While necessary given the recursive dispatch pattern over the `HotspotAction` union, a typed overload or a type assertion at the call site would improve type safety. Low priority given the function is private.
- Recommendation: Type the parameter as `HotspotAction` and use type narrowing via `if (action.type === ...)` guards.

**I-02: `VALIDATE_PUZZLE` uses `validatePuzzle(puzzle as any, ...)`**
- File: `packages/core/src/state/state-machine.ts` (pre-existing)
- Not introduced by this PR, but present in the changed file. The `as any` cast hides whether `validatePuzzle` accepts all puzzle union variants.
- Recommendation: Address in a follow-up refactor sprint.

### Suggestions (nice to have)

**S-01: Unit test for `renderControls` puzzle button creation**
- The `puzzles?.main` guard is now tested only implicitly. A jsdom-based unit test for `Renderer.renderControls` with a malformed `caseData` (no `puzzles.main`) would prevent regression.

**S-02: Runtime package exports map should expose the IIFE path**
- `packages/runtime/package.json` currently exports only `"."`. Adding an export for `"./dist/index.iife.js"` and `"./dist/runtime.css"` would allow the design's intended `@gi-engine/runtime/dist/...` import path to work, which is cleaner than the relative path fallback.
- Low priority as the relative path works correctly for the monorepo build.

**S-03: `words` key placement in `game.json`**
- The `words` key appears after `assets` (position 8 vs 7). Design suggests it should precede `assets`. Cosmetic only — no functional impact.

---

## 8. What Was Done Well

- The composite action accumulation fix is clean and correct. The `workingCaseState` threading pattern ensures each sub-action sees the mutations from all prior sub-actions in the composite, without mutating shared state.
- The `typeof window !== 'undefined'` guard in `index.ts` is a thoughtful addition that keeps the module safe for non-browser environments (test runners, SSR).
- The fallback and warning pattern in `extractWordsFromAction` is well-calibrated: informative without being fatal, and the word is still fully functional (puzzle validator matches by ID, not display label).
- Using a relative path for the `?raw` import rather than the package name is a pragmatic improvement over the design suggestion, given the runtime package's unexpanded exports map.
- The `escapeHtml` / `escapeAttr` / `</script>` escaping in `template.ts` demonstrates solid defensive output encoding.
- The two new accumulation tests in `state-machine-extra.test.ts` directly target the exact bug scenario (two `word_reveal` sub-actions) and verify both words appear in `collectedWordIds`.

---

## 9. Verdict

VERDICT: APPROVED
