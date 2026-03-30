# QA Report — runtime-render-fixes
**Date**: 2026-03-30
**Branch**: feature/gi-engine-core
**QA Agent**: Claude Sonnet 4.6

---

## 1. Scope

Changed files reviewed:
- `packages/runtime/src/renderer/renderer.ts`
- `packages/exporter/src/browser-export.ts`
- `packages/editor/src/components/export/ExportModal.tsx`

---

## 2. Test Execution Results

### Pre-existing test suites (all must pass)

| Package | Test Files | Tests | Result |
|---------|-----------|-------|--------|
| `@gi-engine/core` | 5 | 66 | PASS |
| `@gi-engine/exporter` | 4 | 42 | PASS |
| `@gi-engine/editor` | 5 | 140 | PASS |
| **Total** | **14** | **248** | **PASS** |

### New tests added by this QA pass

| Package | Test File | Tests | Result |
|---------|-----------|-------|--------|
| `@gi-engine/exporter` | `tests/browser-export.test.ts` | 10 | PASS |
| `@gi-engine/runtime` | `tests/renderer-collect-words.test.ts` | 7 | PASS |
| **Total new** | **2** | **17** | **PASS** |

### Grand total after QA additions

265 tests across 16 test files — all passing.

---

## 3. TypeScript Checks

| Config | Result |
|--------|--------|
| `packages/runtime/tsconfig.json` | PASS (0 errors) |
| `packages/editor/tsconfig.json` | PASS (0 errors) |

---

## 4. Code Analysis

### 4a. `renderer.ts` — `collectWordsForCase` three-tier lookup

**Finding: CORRECT**

The three-tier lookup is implemented correctly:

```
Tier 1 (primary):   def.words?.[wordId]  — global dictionary, covers cross-case words
Tier 2 (fallback):  scan case scenes → hotspot word_reveal actions via extractWordsFromAction()
Tier 3 (last resort): console.warn + id as display label to prevent silent data loss
```

Each tier uses `continue` to skip to the next word after a successful match, so tiers are mutually exclusive per wordId. The `extractWordsFromAction` helper handles composite and examine_image actions recursively, preventing missed nested word_reveal actions.

**Verification**: Tier 1 path confirmed working via new tests. Tier 2 confirmed by existing scene-scan logic and new test. Tier 3 confirmed by new test asserting `console.warn` fires with the missing wordId.

### 4b. `renderer.ts` — `lastSlotAssignments` diff logic

**Finding: CORRECT**

The diff logic in `renderThinking()`:
- On first visit (view !== `thinking:${puzzleId}`): calls `clearView([])`, then snapshots `lastSlotAssignments = { ...puzzleState.slotAssignments }` as the clean diff baseline before mounting.
- On repeat visit: iterates `current` slots and calls `updateSlotContent` only when `current[slotId] !== lastSlotAssignments[slotId]`. Updates `lastSlotAssignments[slotId]` after each call.
- Defensive pass: handles removed slots (slots in `lastSlotAssignments` absent from `current`) by calling `updateSlotContent(slotId, null, ...)` and deleting from the map.
- Word bank sync: always iterates all `caseWords` to call `updateWordBankItem`, keeping assigned state current.

No off-by-one issue, no missing update for the null→word transition.

### 4c. `renderer.ts` — `clearView` resets `lastSlotAssignments`

**Finding: CORRECT**

`clearView()` at line 131–132:
```typescript
this.lastSlotAssignments = {};
this.lastCollectedWordIds = [];
```

Both fields are reset unconditionally on every view change. This ensures that when the user navigates away from a puzzle and returns, the next `renderThinking` call (which checks `currentView !== 'thinking:...'`) correctly takes the first-visit branch and re-mounts with a fresh snapshot. Verified by new test `re-mounts deduction UI cleanly after transitioning away and back`.

### 4d. `browser-export.ts` — `inlineAssetsForBrowser` error handling

**Finding: CORRECT**

The function handles all edge cases before attempting a fetch:
1. `asset.inline` truthy → keep as-is, no fetch
2. `!asset.src` (empty string or undefined) → keep as-is, no fetch
3. `asset.src.startsWith('data:')` → keep as-is, no fetch
4. Fetch throws or returns non-ok response → `catch(err)` block logs `console.warn` and keeps original asset (graceful degradation, no throw)

The `def.assets` parameter is typed as `AssetManifest` (required on `GameDefinition`), so it cannot be `undefined` at the call site in `browserExport`. The `manifest.items` object is iterated via `Object.entries()` which handles an empty object safely.

**Verification**: New tests confirm all four edge cases.

### 4e. `browser-export.ts` — `browserExport` is async

**Finding: CORRECT**

The function signature is `export async function browserExport(...)`. It awaits `inlineAssetsForBrowser(...)` before proceeding. The return type is `Promise<BrowserExportResult>` which is correctly declared. All callers (ExportModal.tsx) use `await`.

### 4f. `ExportModal.tsx` — `await browserExport(...)` and error handling

**Finding: CORRECT**

```typescript
const exportResult = await exporterModule.browserExport({ gameDefinition: project as never, mode });
```

The call is inside an `async` `handleExport` function wrapped in a `try/catch`. On any error (including async rejection from `browserExport`), the catch block sets `setErrorMessage` and `setPhase('error')`, which renders the error UI. The modal UI correctly:
- Disables the close button and export button while `phase === 'exporting'`
- Shows a styled error panel with the error message
- Allows retry via the same "HTML 내보내기" button which re-shows as "다시 시도" after an error
- Resets state on close

No missing error handling found.

---

## 5. Coverage Gap Analysis

### Gap 1: `collectWordsForCase` with `def.words` populated
**Status: GAP EXISTED — FILLED**

No prior test exercised the Tier 1 path. Added `packages/runtime/tests/renderer-collect-words.test.ts` with 7 tests covering all three tiers and the `clearView` reset.

### Gap 2: `browserExport` async and asset inlining
**Status: GAP EXISTED — FILLED**

No prior test covered `browser-export.ts` at all. Added `packages/exporter/tests/browser-export.test.ts` with 10 tests covering:
- Return shape (all required fields present)
- `fileName` derivation from `gameDefinition.id`
- `html` contains expected content
- Empty assets manifest (no fetch called)
- Fetch error → graceful degradation with `console.warn`
- Already-inlined assets (no fetch)
- Already-data-URI assets (no fetch)
- No-src assets (no fetch)
- Development mode (pretty-printed JSON)

---

## 6. Issues Found

None. All logic is correct, all tests pass, TypeScript is clean.

---

## 7. Verdict

**QA PASSED**
