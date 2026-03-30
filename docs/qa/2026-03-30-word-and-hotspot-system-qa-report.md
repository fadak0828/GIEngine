# QA Report — word-and-hotspot-system

**Date**: 2026-03-30
**Branch**: feature/gi-engine-core
**Scope**: New word vocabulary and hotspot action integration feature

---

## Files Verified

| File | Status |
|------|--------|
| `packages/core/src/models/types.ts` | Reviewed |
| `packages/editor/src/store/editor-store.ts` | Reviewed |
| `packages/editor/src/components/words/WordAddForm.tsx` | Reviewed |
| `packages/editor/src/components/words/WordRow.tsx` | Reviewed + Fixed |
| `packages/editor/src/components/words/WordVocabularyPanel.tsx` | Reviewed + Fixed |
| `packages/editor/src/components/words/WordDropdown.tsx` | Reviewed + Fixed |
| `packages/editor/src/components/properties/CaseProperties.tsx` | Reviewed |
| `packages/editor/src/components/properties/HotspotProperties.tsx` | Reviewed |

---

## 1. TypeScript Check

Command: `npx tsc --noEmit -p packages/editor/tsconfig.json`

**Result: PASS — zero errors, zero warnings (before and after fixes)**

---

## 2. Existing Tests

Command: `npm test --workspace=packages/editor -- --run`

**Result: PASS — 5 test files, 140 tests, 0 failures (before and after fixes)**

```
✓ tests/coordinate.test.ts        (20 tests)
✓ tests/editor-store.test.ts      (43 tests)
✓ tests/editor-store-extra.test.ts(48 tests)
✓ tests/useCanvasDrag.test.ts     (13 tests)
✓ tests/LocalizedTextInput.test.tsx(16 tests)
```

No existing tests were modified. No tests were broken by the new code.

---

## 3. Code Review Findings

### 3.1 types.ts — `Hotspot.name?: string`

- Correct: `name` is typed as optional string with an editor-only comment. Runtime ignores it.
- No issues.

### 3.2 editor-store.ts — `addHotspot` with `name: ''`

- `name: ''` is set on new hotspots, satisfying the optional field without breaking the type.
- All 6 hotspot CRUD operations are correct. Immer draft mutations follow the existing pattern.
- No issues.

### 3.3 WordAddForm.tsx

- Imports: all present and correct (`LocalizedText`, `WordCategory`, `useEditorStore`, `LocalizedTextInput`).
- `canSave` guard (non-empty Korean name) is reasonable.
- ID generation uses `Date.now() + random` — adequate for editor use.
- No issues.

### 3.4 WordRow.tsx — FIXED

**Issue found (Minor):** `editorLocale: 'ko' | 'en'` was declared in `WordRowProps` and destructured, but was never read anywhere in the component body. The prop was scaffolding that was never wired up.

**Fix applied:** Removed `editorLocale` from `WordRowProps` interface and from the destructuring parameter list.

**Edit mode initialization:** `handleEditStart` correctly resets `draftDisplay` to `word.display` and `draftCategory` to `word.category ?? 'evidence'` before entering edit mode, so stale draft state cannot leak across multiple edit sessions.

**Delete when referenced:** Deleting a word with `connectionCount > 0` is visually discouraged (button turns muted, tooltip says "다른 곳에서 참조 중") but is not blocked. This is a deliberate design choice (no hard block), which is acceptable for an editor tool, though it risks orphaned `wordId` references in hotspot actions. Documented as a remaining risk below.

### 3.5 WordVocabularyPanel.tsx — FIXED

**connectionMap logic (verified correct):**
- Initialises every `caseWord.id` to 0 before scanning.
- Scans `word_reveal` actions at the top level of each hotspot.
- Also scans `composite` actions' sub-actions for `word_reveal` — this is the correct place to look.
- Uses `if (wid in map)` guard so cross-case word references cannot pollute the count.
- The `useMemo` dependency array `[caseWords, caseScenes]` is correct; `caseWords` is itself a memoized array so referential stability is maintained.
- No logic errors found.

**Duplicate import:** The original file imported `useWords` and `useEditorStore` as two separate import statements from the same module path. This is harmless but untidy; fixed as a side effect of removing the `ui` selector.

**Fix applied (cascading from WordRow fix):** Removed `const ui = useEditorStore(s => s.ui)` (now unused after removing the `editorLocale` prop pass-through) and consolidated the import to a single `import { useWords } from '@/store/editor-store'`.

### 3.6 WordDropdown.tsx — FIXED

**Issue found (Critical — layout bug):** The dropdown panel was rendered with `position: 'absolute'` but the container `<div ref={containerRef}>` had no `position: 'relative'` set. Without a positioned ancestor, the browser resolves `position: absolute` against the nearest ancestor that has a non-static position, which could be the panel scroll container, the properties sidebar, or even the viewport — causing the dropdown to appear visually detached from the chip area.

**Fix applied:** Added `position: 'relative'` to the container `<div>` style.

**Outside-click cleanup:** The `useEffect` correctly returns `() => document.removeEventListener('mousedown', handleMouseDown)` as its cleanup function, and it only attaches the listener when `isOpen` is true (early-return guard). The event listener is properly cleaned up on every close. No leak.

**Word deduplication:** `addWord` checks `if (!wordIds.includes(id))` before adding, preventing duplicates. Correct.

### 3.7 CaseProperties.tsx

- Imports: correct. Passes `caseData.id` as `caseId` and `caseData.scenes` as `caseScenes` to `WordVocabularyPanel`. Both are well-typed.
- Title and description fields correctly spread existing `LocalizedText` before overwriting one locale, preserving the other.
- No issues.

### 3.8 HotspotProperties.tsx — `caseId` threading

**caseId threading verified:**
1. `HotspotProperties` reads `selection.caseId` from the store (line 24–28).
2. Guards against `null` selection with early return.
3. `caseId` is passed directly to `ActionEditor` as a prop (line 108).
4. `ActionEditor` receives `caseId: string` in its `ActionEditorProps` interface (line 122).
5. For the `word_reveal` case, `caseId` is forwarded to `<WordDropdown caseId={caseId} ...>` (line 151).
6. `WordDropdown` uses `caseId` to filter `words.filter(w => w.caseId === caseId)`.

The chain is complete and correct. The dropdown will only show words belonging to the same case as the hotspot being edited.

**navigate action edge case:** The `navigate` action editor builds a `<select>` that only offers the current `targetSceneId` as an option (line 165–168) — essentially a read-only select plus a free-text input below. This is a known limitation ("상세 편집은 차후 업데이트") and not a bug introduced by this feature.

---

## 4. Issues Summary

### Critical Issues

| # | File | Description | Status |
|---|------|-------------|--------|
| C1 | `WordDropdown.tsx` | `position: absolute` dropdown had no `position: relative` on the container, causing the dropdown to anchor to an incorrect ancestor and appear in the wrong location. | **Fixed** |

### Minor Issues

| # | File | Description | Status |
|---|------|-------------|--------|
| M1 | `WordRow.tsx` | `editorLocale` prop declared in interface and destructured but never read inside the component body (dead code). | **Fixed** |
| M2 | `WordVocabularyPanel.tsx` | Cascading cleanup: removed unused `ui` selector and duplicate `useEditorStore` import after M1 fix. | **Fixed** |

---

## 5. Issues Fixed

### C1 — WordDropdown missing `position: relative`

```tsx
// Before
<div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

// After
<div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
```

### M1 — WordRow dead `editorLocale` prop

```tsx
// Before
interface WordRowProps {
  word: Word;
  connectionCount: number;
  editorLocale: 'ko' | 'en';  // never used
}
export function WordRow({ word, connectionCount, editorLocale }: WordRowProps) { ... }

// After
interface WordRowProps {
  word: Word;
  connectionCount: number;
}
export function WordRow({ word, connectionCount }: WordRowProps) { ... }
```

### M2 — WordVocabularyPanel cleanup

Removed `const ui = useEditorStore(s => s.ui)` (made redundant by M1 fix) and consolidated to a single named import.

---

## 6. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Deleting a word with active hotspot references is not blocked | Medium | `WordRow` shows a visual warning (muted color, tooltip) but allows the delete. Orphaned `wordId` strings remain in `word_reveal` action arrays, which `WordDropdown` gracefully handles by showing `(알 수 없음 — {id})`. No crash, but data integrity is weakened. A future improvement could add a confirmation dialog or a hard block. |
| `navigate` action scene picker is incomplete | Low | The scene-select dropdown only reflects the current `targetSceneId`; it does not enumerate all scenes in the case. Acknowledged as a future update in the component comment. |
| `WordDropdown` dropdown panel has no max-width constraint relative to its container | Low | `minWidth: 200` is set but no `maxWidth`, so the panel could overflow its container in narrow sidebars. Visual-only, no data impact. |

---

## 7. Verdict

**PASS**

All TypeScript checks pass with zero errors. All 140 existing tests pass. Two issues were found through code review (one critical layout bug, one dead-code minor issue) and both were fixed. The fixes do not introduce any new test failures. Core logic for `connectionMap`, outside-click cleanup, edit mode draft initialization, and `caseId` threading through `HotspotProperties → ActionEditor → WordDropdown` is all correct.
