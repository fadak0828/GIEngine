# Code Review: word-and-hotspot-system Feature
**Date**: 2026-03-30
**Reviewer**: Reviewer Agent
**Design document**: `docs/designs/2026-03-30-word-and-hotspot-system.md`
**QA report**: `docs/qa/2026-03-30-word-and-hotspot-system-qa-report.md`

---

## Verdict: APPROVED

No critical issues found in the post-QA codebase. The one critical issue identified by QA (C1: missing `position: relative` on the WordDropdown container) has been correctly fixed. All planned features are implemented and match the design specification. One new minor finding is documented below but does not block approval.

---

## 1. Design Compliance

### 1.1 types.ts — Hotspot.name
- `name?: string` added with correct editor-only comment. Placement is between `id` and `area`, matching the design spec exactly.
- The optional type is correctly backward-compatible with existing JSON data that lacks the field.
- PASS.

### 1.2 editor-store.ts — addHotspot factory
- `name: ''` is present in the `newHotspot` object literal at line 510.
- The `useWords()` selector is exported at line 861 and is used by `WordVocabularyPanel` and `WordDropdown`. Both new files consume the selector rather than calling `useEditorStore(s => s.words)` inline, which is the correct pattern for this codebase.
- Word CRUD (`addWord`, `updateWord`, `deleteWord`) is implemented outside the Immer `produce()` path since `words` is a flat array on the store root, not nested inside `project`. This is the correct architecture choice.
- PASS.

### 1.3 WordAddForm
- All props match the design spec: `caseId: string`, `onSaved: (wordId: string) => void`, `onCancel: () => void`.
- Local state initialisation matches spec: `display: { ko: '', en: '' }`, `category: 'evidence'`.
- `canSave` guard: `display.ko.trim() !== ''` — matches spec.
- ID generation pattern: `'word_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)` — matches spec.
- All seven canonical categories present in `WORD_CATEGORIES` array and `CATEGORY_LABELS` map.
- PASS.

### 1.4 WordRow
- `editorLocale` prop removed by QA (M1 fix). The design spec included this prop but the component never needed it; QA correctly eliminated the dead code. This is a beneficial deviation: the design spec was scaffolding that was never used.
- Custom-category guard in edit `<select>` is present (lines 115–117): if `word.category` is not in the canonical list, an `<option>` for it is rendered before the canonical options. This matches the design spec edge-case table.
- `handleEditStart` correctly resets `draftDisplay` and `draftCategory` from `word.*` before entering edit mode, preventing stale draft state across sessions.
- Delete button is not blocked when `connectionCount > 0`, only visually discouraged (muted color, tooltip). This matches the design intent as documented.
- PASS.

### 1.5 WordVocabularyPanel
- Props match spec: `caseId: string`, `caseScenes: Scene[]`.
- `caseWords` filtering: `words.filter(w => w.caseId === caseId)` — correct.
- `connectionMap` `useMemo` scans `word_reveal` at top level and inside `composite` sub-actions. The `if (wid in map)` guard prevents cross-case word IDs from polluting counts. This exactly matches the spec's data flow description.
- Dependency array `[caseWords, caseScenes]` is correct. `caseWords` is itself memoized so referential stability is maintained.
- Section header, word count badge, `+ 단어 추가` button, empty state, and `WordAddForm` visibility toggle all implemented per spec.
- The `_wordId` parameter in `handleSaved` uses the underscore convention to signal intentional non-use. TypeScript accepts this without a lint warning.
- PASS.

### 1.6 WordDropdown
- Props match spec: `caseId: string`, `wordIds: string[]`, `onChange: (wordIds: string[]) => void`.
- Chip rendering: known words show `word.display.ko`; unknown IDs show `(알 수 없음 — {id})` with muted styling. Matches spec.
- `×` chip button correctly calls `removeWord` with `e.stopPropagation()` to prevent dropdown toggle on chip click. Correct.
- Dropdown panel: `position: 'absolute'`, `zIndex: 50`, `minWidth: 200`, `maxHeight: 220` with `overflowY: 'auto'`. Matches spec.
- Already-selected words shown with `✓` prefix and `opacity: 0.5`. Clicking them is a no-op (`if (!selected) addWord(word.id)`). Matches spec.
- Empty `caseWords` state shows "이 사건에는 단어가 없습니다". Matches spec.
- Warning `⚠ 단어가 선택되지 않았습니다` shown when `wordIds.length === 0`. Matches spec.
- Outside-click listener attached only when `isOpen === true`, cleaned up on every close. No memory leak.
- `position: 'relative'` on container div (C1 fix): confirmed present at line 41.
- PASS.

### 1.7 CaseProperties
- `WordVocabularyPanel` imported and rendered at line 123, positioned before the puzzle button at line 126. Matches spec exactly.
- Props passed: `caseId={caseData.id}` and `caseScenes={caseData.scenes}`. Both are correctly typed.
- PASS.

### 1.8 HotspotProperties
- `caseId` is read from `selection.caseId` (line 29) and guarded at line 27.
- `caseId` prop added to `ActionEditorProps` interface (line 122) and threaded to `ActionEditor` call site (line 111).
- `word_reveal` case replaced with `<WordDropdown>` plus `LocalizedTextInput` for the optional feedback field (lines 150–156). Matches spec.
- `WordDropdown` import is present at line 4.
- PASS.

---

## 2. TypeScript Correctness

- No `any` types introduced anywhere in the new files.
- `e.target.value as WordCategory` casts in both `WordAddForm` and `WordRow` are safe: the `<select>` is controlled and only contains `WordCategory` values as options.
- `e.target.value as HotspotAction['type']` in `HotspotProperties` is safe for the same reason.
- `e.currentTarget as HTMLDivElement` cast in `WordDropdown` hover handlers is safe (the event is fired from a `<div>`).
- `word.category as WordCategory` in `WordRow`'s custom-category guard is safe; the check `!WORD_CATEGORIES.includes(word.category as WordCategory)` correctly handles the open `string & {}` union.
- QA report confirms TypeScript check passes with zero errors.
- PASS.

---

## 3. React Patterns

### Re-render Analysis
- `WordVocabularyPanel`: `caseWords` and `connectionMap` are both memoized with `useMemo`. The word list will re-render only when `words` or `caseId` changes. Correct.
- `WordDropdown`: `caseWords` is computed inline with `words.filter(...)` on every render (line 15). This is not memoized.

  This is a minor issue. `WordDropdown` is rendered inside `ActionEditor`, which is rendered as part of `HotspotProperties`. The subscription `useWords()` returns the full words array; any word change anywhere will trigger a re-render of `WordDropdown` and recompute `caseWords`. In practice the words array is small for an editor tool, so the performance cost is negligible, but it is an inconsistency with `WordVocabularyPanel`'s approach. Documented as a minor finding below.

- `WordRow`, `WordAddForm`: No unnecessary subscriptions. `useEditorStore()` is called only for the two action functions needed; no state slice is subscribed to. Correct.

### useCallback
- Event handlers in `WordVocabularyPanel` (`handleSaved`) and `WordRow` (`handleEditStart`, `handleSave`, `handleCancel`, `handleDelete`) are not wrapped in `useCallback`. For row-level components in a short list, this is an acceptable trade-off. No evidence of prop-drilling to deeply nested children that would cause cascading re-renders.

---

## 4. Store Usage

- `useWords()` selector is used consistently across all new files that need word data.
- `useEditorStore()` is called with a selector only where specific slices are needed (`s => s.ui`, `s => s.selection`). No component subscribes to the entire store.
- `CaseProperties` uses `useEditorStore(s => s.ui)` and a second destructured `useEditorStore()` call for actions. This is the existing pattern in the file and not a regression.
- Word CRUD actions (`addWord`, `updateWord`, `deleteWord`) are correctly destructured from `useEditorStore()`.
- PASS with one note: see minor finding M1 below.

---

## 5. Inline Style Consistency

All new components follow the editor's established inline-style conventions:
- CSS custom properties (`var(--border-color)`, `var(--text-primary)`, `var(--text-muted)`, `var(--accent)`, `var(--bg-card)`, `var(--bg-secondary)`) are used consistently.
- Section headers use `fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em'` — consistent with `CaseProperties` and `HotspotProperties` headers.
- Label style pattern (`fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em'`) matches the `labelStyle` constant in `HotspotProperties`.
- Button patterns (accent background with `'#000'` text, card background with secondary text, border-radius 3) are consistent with the rest of the editor.
- PASS.

---

## 6. Edge Case Handling

| Case | Implementation | Status |
|------|---------------|--------|
| Unknown wordId in chips | `(알 수 없음 — {id})` fallback with muted styling; `×` still removes it | Correct |
| Word deleted while hotspot references it | Chip shows fallback; no crash | Correct |
| Empty caseWords in dropdown | "이 사건에는 단어가 없습니다" message shown | Correct |
| KO display name empty on save | `canSave` guard blocks save, button disabled/styled | Correct |
| caseScenes empty | `connectionMap` initialises all counts to 0; `?? 0` fallback in render | Correct |
| Hotspot name missing in existing JSON | `name?: string` optional; field renders as undefined gracefully | Correct |
| Custom category not in canonical list | Edit `<select>` guard adds option for current non-canonical value | Correct |
| Duplicate word selection | `if (!wordIds.includes(id))` guard in `addWord` | Correct |
| Dropdown open during component unmount | `useEffect` cleanup removes the `mousedown` listener | Correct |

All design-specified edge cases are handled. PASS.

---

## 7. SOLID Principles

- **Single Responsibility**: Each component has one clear purpose. `WordAddForm` only handles creation; `WordRow` handles display and editing of a single word; `WordVocabularyPanel` composes the list; `WordDropdown` handles the hotspot-side selection UI.
- **Open/Closed**: The `ActionEditor` switch in `HotspotProperties` was extended for `word_reveal` without modifying other cases. Correct.
- **Liskov/Interface Segregation**: Component props are narrowly typed; no prop is broader than needed.
- **Dependency Inversion**: Components depend on the `useEditorStore`/`useWords` abstraction, not on store implementation details.
- PASS.

---

## 8. Regression Check

- The QA report confirms all 140 pre-existing tests pass after the changes.
- `HotspotProperties` modifications are additive: existing action type editors (`examine`, `examine_image`, `navigate`, `toggle_layer`, `composite`) are unchanged in their logic.
- `CaseProperties` receives one new child component rendered before the puzzle button. No existing DOM or event logic is affected.
- `types.ts` addition is additive and backward-compatible.
- PASS.

---

## Critical Findings

None. The critical layout bug (C1) identified by QA was correctly fixed before this review.

---

## Minor Findings

### M1 — WordDropdown: caseWords not memoized (consistency)

**File**: `packages/editor/src/components/words/WordDropdown.tsx`, line 15

`const caseWords = words.filter(w => w.caseId === caseId);` runs on every render without memoization. `WordVocabularyPanel` memoizes the equivalent computation. This is an inconsistency. In the current editor context (small word lists, infrequent renders) the performance impact is negligible, but it is a departure from the pattern established in the sibling component.

Recommendation: Wrap in `useMemo`:
```tsx
const caseWords = useMemo(
  () => words.filter(w => w.caseId === caseId),
  [words, caseId]
);
```

Severity: Suggestion. No functional impact.

### M2 — WordDropdown: dropdown panel lacks explicit top/left anchoring

**File**: `packages/editor/src/components/words/WordDropdown.tsx`, lines 136–147

The dropdown panel uses `position: 'absolute'` with `marginTop: 2` but no explicit `top` or `left` values. The panel relies on browser "static position" fallback to place itself after the chip area within the flex column container. This works in practice (Chromium, Firefox) because the static position of an absolute element in a flex column container is resolved to after the last laid-out sibling, but this is not a CSS guarantee and may behave unexpectedly in edge cases (e.g., when `wordIds.length === 0` shows the warning banner, changing the offset to the chip area).

Recommendation: Replace `marginTop: 2` with `top: '100%', left: 0, marginTop: 2` on the dropdown panel's style to anchor it explicitly to the container's bottom edge.

Severity: Suggestion. No crash or data impact; visual-only risk in edge cases.

---

## Acknowledged Risks (from QA report, carried forward)

| Risk | Severity | Notes |
|------|----------|-------|
| Deleting a word with active hotspot references is not blocked | Medium | Visual warning only. Orphaned `wordId` strings in `word_reveal` arrays are gracefully handled by `WordDropdown`. No crash. Acceptable for editor tool; confirmation dialog recommended in a future iteration. |
| Navigate action scene picker is incomplete | Low | Only shows current `targetSceneId`; does not enumerate case scenes. Acknowledged with an in-code comment. |
| WordDropdown panel has no maxWidth constraint | Low | `minWidth: 200` set but no `maxWidth`. Panel may overflow narrow sidebars. Visual only. |

---

## Summary

The implementation is correct, complete, and aligns with the design specification. QA caught and fixed the one critical issue (missing `position: relative` on the dropdown container) and one minor dead-code issue (`editorLocale` prop removal). The post-fix codebase passes TypeScript compilation with zero errors and all 140 existing tests.

The two new minor findings (M1: non-memoized `caseWords` in `WordDropdown`; M2: implicit dropdown positioning) are suggestions with no functional or data-integrity impact. They do not warrant a rejection or a forced fix at this stage.

The feature is ready to land.
