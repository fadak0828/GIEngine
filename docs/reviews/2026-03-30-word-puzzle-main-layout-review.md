# Code Review: word-puzzle-main-layout Feature
**Date**: 2026-03-30
**Reviewer**: Reviewer Agent
**Design document**: `docs/designs/2026-03-30-word-puzzle-main-layout.md`
**QA report**: `docs/qa/2026-03-30-word-puzzle-main-layout-qa-report.md`

---

## Verdict: APPROVED

No critical issues found. All 12 implementation steps from the design are present and correctly implemented. One important finding (select-all checkbox indeterminate state) and three suggestions are documented below. No source file fixes were required.

---

## 1. Design Compliance — All 12 Steps

| Step | File | Status | Notes |
|------|------|--------|-------|
| 1 | `packages/core/src/models/types.ts` | PASS | `hint?: LocalizedText` and `imageUrl?: string` added to `Word` interface |
| 2 | `word-category-constants.ts` | PASS | All three exports present and values match design exactly |
| 3 | `WordRow.tsx` | PASS | Imports all three constants from shared file; no local duplicates |
| 4 | `WordAddForm.tsx` | PASS | Imports `WORD_CATEGORIES` and `CATEGORY_LABELS`; `CATEGORY_COLORS` correctly omitted (not used here) |
| 5 | `MainAreaTabBar.tsx` | PASS | All tabs, active states, badge, and all styles match the design spec |
| 6 | `WordManagerRow.tsx` | PASS | All props, draft state, expand/collapse, inline edit, hotspot chips match the design |
| 7 | `WordManagerPanel.tsx` | PASS | All five local states, all five `useMemo` derivations, full layout implemented |
| 8 | `AnswerKeyEditor.tsx` | PASS | `SlotWordPicker` implemented with correct outside-click pattern, search, clear option |
| 9 | `PuzzleEditorPanel.tsx` | PASS | Back button removed; two-column layout (flex 1.2 / 0.8), `renderPreview`, AI accordion all correct |
| 10 | `CaseProperties.tsx` | PASS | `WordVocabularyPanel` removed; "단어 관리 열기" button added above "퍼즐 편집 열기" |
| 11 | `MainLayout.tsx` | PASS | `MainAreaTabBar` and `WordManagerPanel` integrated; `words` panel route added |
| 12 | `ProjectTree.tsx` | PASS | `setActivePanel('words')` on CaseNode select; `setActivePanel('scene')` on SceneNode select |

---

## 2. Code Quality Assessment

### 2.1 word-category-constants.ts

Correct extraction of the three constants. All four consumer files (`WordRow`, `WordAddForm`, `WordManagerPanel`, `WordManagerRow`) import from the shared file with no residual local copies. The `Record<string, string>` type on `CATEGORY_LABELS` and `CATEGORY_COLORS` is acceptable given the `WordCategory` union is treated as string keys throughout the codebase.

### 2.2 MainAreaTabBar.tsx

Style objects match the design specification exactly for all four style variants (container, tab base, tab active, badge). The active detection logic `activePanel === 'scene' || activePanel === 'assets' || activePanel === 'settings'` correctly matches all scene-related sub-panels as specified.

One minor observation: the `wordCount` badge is always rendered regardless of whether a case is selected. When no case is selected the badge shows `0`, which is correct and consistent with the design's "returns 0 when no case is selected" note.

### 2.3 WordManagerPanel.tsx

The `connectionMap` algorithm is the most algorithmically complex part of this feature. It correctly:
- Initializes entries only for words belonging to the selected case (`for (const word of caseWords)`)
- Skips hotspot word IDs that are not case words (`if (wid in map)`)
- Handles both `word_reveal` and `composite → word_reveal` action nesting
- Uses a `processWordIds` helper to deduplicate the logic between direct and nested processing
- Returns early if `selectedCase` is null, preserving the initialized-but-empty map entries

This implementation is an improvement over the reference `WordVocabularyPanel` because it collects rich `chips` metadata (sceneName + hotspotName) rather than just a count.

The locale fallback chain for `sceneName` (`scene.name[locale] || scene.name.ko || scene.id`) is correct and consistent with all other locale access patterns in the codebase.

The `useMemo` dependency array `[caseWords, selectedCase, locale]` is correct. All three are used within the computation. Since `caseWords` is itself a `useMemo` output that changes when `words` or `caseId` changes, the dependency graph is properly layered.

### 2.4 WordManagerRow.tsx

The draft re-initialization `useEffect` correctly watches `[isExpanded, word]` and only re-initializes when `isExpanded` is `true`. This avoids unnecessary state churn on collapse and handles the case where the underlying store word is mutated externally while the row is open.

The category select guard for unknown categories (lines 233-235) is a valuable defensive measure: if a `Word` has a non-canonical category string from a future schema version, it still renders correctly and is preserved unless the user changes it.

The hotspot chip rendering correctly shows `미연결` in accent-red when `connectionChips.length === 0`, and shows the `{sceneName}·{hotspotName}` badge pattern when connected.

### 2.5 AnswerKeyEditor.tsx — SlotWordPicker

The outside-click handler correctly uses `mousedown` (not `click`) to avoid race conditions with item selection. The `useEffect` cleanup returns the `removeEventListener` call and is correctly gated on `isOpen`, so the listener is not attached during the closed state.

The search filter `w.display.ko.includes(search)` is intentionally case-sensitive, which is consistent with how Korean text search is handled across this codebase.

The single-select behavior is correctly enforced: clicking any word calls `onSelect(slotId, word.id)` then immediately sets `isOpen(false)`, so only one word per slot is selectable. The "정답 없음" clear option calls `onSelect(slotId, '')` which triggers `delete newAnswers[slotId]` in `AnswerKeyEditor.handleSelect`.

`autoFocus` on the search input is appropriate for a picker dropdown.

No keyboard navigation (Arrow keys / Enter to select) was specified in the design, and none was implemented. The QA checklist item 7 mentions "keyboard/accessibility" — see Important finding below.

### 2.6 PuzzleEditorPanel.tsx

The `renderPreview` function is defined outside the component as a pure function (not a nested function inside the render), which is the correct pattern — it avoids recreation on every render.

The two-column layout uses `flex: 1.2` and `flex: 0.8` (60/40 split), matching the design. The AI accordion is pinned to the bottom of the left column using `flexShrink: 0` and is separated from the scrollable content by `borderTop`.

One observation: `selectedCase` is declared as `let selectedCase = null` (line 58) and then assigned inside a for loop. TypeScript infers the type as `Case | null`. All usages after the early-return guards are non-null by control flow — TypeScript's control flow analysis handles this correctly, so the non-null assertion on line 66 (`selectedCase!.id`) is technically redundant but not harmful.

### 2.7 MainLayout.tsx

The `renderCenterContent` priority chain (`puzzle` → `words` → default SceneCanvas) is the simplest and most readable approach. All previous panel values (`scene`, `assets`, `settings`) fall through to `<SceneCanvas />` correctly. No regressions to existing routing.

The `MainAreaTabBar` is placed above the center content container inside the flex column, with the content below occupying `flex: 1`. This is the correct layout integration.

### 2.8 ProjectTree.tsx

`setActivePanel` is destructured correctly at both usage sites — `CaseNode` (line 116, from `useEditorStore()`) and `ActNode` (line 253, from `useEditorStore()`). The tree expand toggle (`toggleCase`) is a local state operation completely independent of `setActivePanel`, so there is no interference between navigation and tree collapse behavior.

The `onSelect` callback for `CaseNode` calls `setSelection` before `setActivePanel`, then `toggleCase` — this ordering is correct because `setSelection` and `setActivePanel` are both synchronous Zustand state updates, and `toggleCase` is local state, so there are no ordering dependencies.

### 2.9 CaseProperties.tsx

`WordVocabularyPanel` import and usage are fully removed. The "단어 관리 열기" ghost button (transparent background, accent border) is placed before the "퍼즐 편집 열기" filled button, matching the design's specification of this ordering. Both buttons use the correct `ActivePanel` literal values.

---

## 3. Issues Found

### 3.1 Important: Select-All Checkbox — Cross-Filter State Leak

**File**: `packages/editor/src/components/words/WordManagerPanel.tsx`, line 277

**Code**:
```tsx
checked={selectedWordIds.size === filteredWords.length && filteredWords.length > 0}
```

**Problem**: `selectedWordIds` tracks selection across the full `caseWords` set, but `filteredWords` is a subset (filtered by search/category). If the user selects all words in one category filter, then switches to a different category filter, the checkbox logic may show the select-all as indeterminate (unchecked) even though all visible filtered words happen to be selected, or as checked when they are not, depending on the cardinality relationship between `selectedWordIds.size` and `filteredWords.length`.

Specifically: if a user selects 5 words in category A (selectedWordIds.size = 5), then switches to category B which also has 5 words (filteredWords.length = 5), the checkbox will appear checked even though none of the category B words are selected.

**Severity**: Important — visible UI inconsistency, no data loss.

**Recommended fix**: Change the condition to also verify that every filtered word is in `selectedWordIds`:
```tsx
checked={filteredWords.length > 0 && filteredWords.every(w => selectedWordIds.has(w.id))}
```

This is slightly more expensive (O(n) iteration vs O(1) set size comparison) but `filteredWords` is bounded by case word count, which is small in practice.

---

## 4. Suggestions (Non-Blocking)

### 4.1 SlotWordPicker — Missing Keyboard Navigation

**File**: `packages/editor/src/components/puzzle/AnswerKeyEditor.tsx`

The `SlotWordPicker` dropdown has no keyboard navigation support: no `onKeyDown` handler for Arrow Up/Down to move through the word list, no Enter to confirm selection, and no Escape to close. The chip trigger div has no `tabIndex` so it is not keyboard-reachable at all.

This was not specified in the design, so it is not a compliance failure. However, review checklist item 7 mentions "keyboard/accessibility" and the current implementation would fail a WCAG 2.1 AA audit for the answer key section. Recommend opening a follow-up ticket to add `tabIndex={0}`, `role="combobox"`, `aria-expanded`, and keyboard handlers.

### 4.2 `flex` on `<td>` Elements Has No Effect

**File**: `packages/editor/src/components/words/WordManagerRow.tsx`, lines 86, 120, 135

The design specification listed `{ flex: 2 }` and `{ flex: 1 }` for variable-width table columns. The `flex` CSS property has no effect on `<td>` elements in a `display: table` context. These properties are silently ignored by all browsers.

The columns still render reasonably because `tableLayout: 'fixed'` distributes remaining width (after fixed-width columns) evenly among columns with no explicit width. The design intent (wider word column, narrower hint/hotspot columns) is only approximately achieved.

This is a design specification error that made it through into implementation. No functional impact. To achieve proper proportional column widths in a table, `colgroup`/`col` elements with percentage widths should be used instead.

### 4.3 Empty State Text Contains Literal Newline Character

**File**: `packages/editor/src/components/words/WordManagerPanel.tsx`, line 293

```tsx
{searchQuery || activeCategory !== 'all' ? '검색 결과가 없습니다.' : '이 사건에는 단어가 없습니다.\n＋ 단어 추가 버튼으로 추가하세요.'}
```

The `\n` in a JSX string expression renders as a literal space in HTML, not a line break. The second sentence will appear on the same line as the first. This should either use `<>...<br />...</>` or CSS `whiteSpace: 'pre-line'` on the container.

---

## 5. Checklist Results

| # | Checklist Item | Result |
|---|---------------|--------|
| 1 | Design compliance — all 12 implementation steps done correctly? | PASS |
| 2 | UI consistency — inline styles match editor CSS variable patterns? | PASS |
| 3 | WordManagerPanel: connectionMap algorithm correct? Filter pills correct? | PASS |
| 4 | WordManagerRow: expand/collapse, inline edit, hotspot chips rendering? | PASS |
| 5 | MainAreaTabBar: active tab detection handles all panel values? | PASS |
| 6 | PuzzleEditorPanel: two-column layout, renderPreview, AI accordion? | PASS |
| 7 | AnswerKeyEditor SlotWordPicker: single-select behavior, keyboard/accessibility? | PARTIAL — single-select correct; no keyboard navigation (not spec'd but noted) |
| 8 | No regressions in SceneCanvas, PropertiesPanel, ProjectTree expand/collapse | PASS |
| 9 | TypeScript: no `any` leaks, all props typed correctly | PASS |
| 10 | Performance: no excessive re-renders (useMemo usage where needed) | PASS |

---

## 6. What Was Done Well

- The `connectionMap` algorithm is correct and represents a genuine improvement over the reference `WordVocabularyPanel` implementation by carrying chip metadata.
- The `handleBulkDelete` implementation correctly uses separate statements rather than the buggy `&&` short-circuit chain shown in the design spec (where `forEach` returns `undefined`, causing `setSelectedWordIds` to be skipped). The implementation fixed a latent design spec bug.
- The `WordManagerRow` category select guard for non-canonical categories is a thoughtful defensive addition not specified in the design.
- The `renderPreview` function is correctly defined at module scope as a pure function rather than as a nested closure, avoiding unnecessary recreation on each render.
- All `useMemo` hooks have correct, minimal dependency arrays. No over-triggering patterns found.
- All inline style values reference CSS variables consistent with the rest of the editor codebase.
- The `WordAddForm.tsx` import refactor correctly omits `CATEGORY_COLORS` (which it does not use), keeping imports minimal.

---

## 7. Summary

The implementation is complete, correct, and passes all functional quality gates. One important select-all checkbox logic issue is identified (cross-filter state leak) that should be fixed in a follow-up or in this branch before merge. Two non-functional issues (no-op `flex` on `<td>`, `\n` in JSX string) and one accessibility gap (SlotWordPicker keyboard navigation) are documented as suggestions.

The QA report's conclusion of zero defects was accurate for the items it checked. The select-all checkbox issue falls outside the QA report's checklist scope.
