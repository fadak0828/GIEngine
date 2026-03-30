# QA Report — word-puzzle-main-layout feature
**Date**: 2026-03-30
**Branch**: feature/gi-engine-core
**Packages**: `@gi-engine/core`, `@gi-engine/editor`

---

## 1. TypeScript Check

| Package | Command | Result |
|---------|---------|--------|
| `@gi-engine/core` | `npx tsc --noEmit -p packages/core/tsconfig.json` | PASS (0 errors) |
| `@gi-engine/editor` | `npx tsc --noEmit -p packages/editor/tsconfig.json` | PASS (0 errors) |

No type errors in new or modified files.

---

## 2. Test Results

### `@gi-engine/editor`
```
Test Files: 5 passed (5)
Tests:      140 passed (140)
Duration:   1.57s
```

### `@gi-engine/core`
```
Test Files: 5 passed (5)
Tests:      64 passed (64)
Duration:   514ms
```

**Total: 204 / 204 tests passed. Zero failures.**

No test regressions caused by the feature changes. The single `stderr` line in core tests (`[i18n] Unknown engine text key: "ui.unknown_key"`) is a pre-existing expected warning from the i18n test suite and unrelated to this feature.

---

## 3. Code Review Checklist

### 3.1 `WordManagerPanel.tsx` — connectionMap algorithm

**Verdict: CORRECT**

The `connectionMap` `useMemo` at lines 37-71 correctly mirrors the reference implementation in `WordVocabularyPanel.tsx`. Specifically:

- Iterates `selectedCase.scenes` → `scene.hotspots` → checks `hotspot.action`.
- Handles `action.type === 'word_reveal'` directly (lines 59-60).
- Handles `action.type === 'composite'` by iterating `action.actions` and checking each sub-action for `type === 'word_reveal'` (lines 61-67).
- Uses the same `wid in map` guard to skip word IDs not belonging to this case.

Improvement over the reference: `WordManagerPanel` stores rich `chips` (sceneName + hotspotName) per word instead of just a count, which supports the richer chip UI in `WordManagerRow`.

The locale fallback for `sceneName` (`scene.name[locale] || scene.name.ko || scene.id`) is correct and matches the rest of the codebase's locale-fallback pattern.

### 3.2 `AnswerKeyEditor.tsx` — `SlotWordPicker` outside-click cleanup

**Verdict: CORRECT**

`useEffect` at lines 21-30:
```tsx
useEffect(() => {
  if (!isOpen) return;
  const handleMouseDown = (e: MouseEvent) => { ... };
  document.addEventListener('mousedown', handleMouseDown);
  return () => document.removeEventListener('mousedown', handleMouseDown);
}, [isOpen]);
```

- Returns a cleanup function that removes the listener.
- Gated on `isOpen` so the listener is only attached when the dropdown is visible.
- Uses `mousedown` (not `click`), preventing race conditions with picker selection.

### 3.3 `WordManagerRow.tsx` — draft re-initialization when `isExpanded` becomes `true`

**Verdict: CORRECT**

`useEffect` at lines 34-41:
```tsx
useEffect(() => {
  if (isExpanded) {
    setDraftDisplay(word.display);
    setDraftCategory(word.category ?? 'evidence');
    setDraftHint(word.hint ?? { ko: '', en: '' });
    setDraftImageUrl(word.imageUrl ?? '');
  }
}, [isExpanded, word]);
```

- Watches `[isExpanded, word]` — fires when expanded state changes OR when the word object changes.
- Only re-initializes when `isExpanded` is `true`, so closing the row does not unnecessarily reset state.
- Covers all four editable draft fields: `display`, `category`, `hint`, `imageUrl`.

### 3.4 `MainAreaTabBar.tsx` — badge updates when words are added/removed

**Verdict: CORRECT**

The `wordCount` selector (lines 6-9):
```tsx
const wordCount = useEditorStore(s => {
  const caseId = s.selection.caseId;
  return caseId ? s.words.filter(w => w.caseId === caseId).length : 0;
});
```

- Reads directly from `s.words` (the live store array), so any mutation via `addWord` / `deleteWord` will trigger a re-render.
- Scoped to the selected case (`s.selection.caseId`), so the badge shows words for the active case, not the global total.
- Returns `0` when no case is selected (safe default).

### 3.5 `PuzzleEditorPanel.tsx` — `renderPreview` locale fallback

**Verdict: CORRECT**

In `renderPreview` (lines 10-43):
- Text segment: `seg.content[locale] || seg.content.ko` — Korean fallback if locale string is empty.
- Slot with word: `word.display[locale] || word.display.ko` — same fallback.
- The `locale` variable is sourced from `ui.editorLocale` (line 53), typed as `'ko' | 'en'`, consistent with `LocalizedText`.

No issue. Both content types use the correct dual-locale fallback.

### 3.6 `MainLayout.tsx` — 'words' panel route doesn't break 'scene'/'puzzle' routes

**Verdict: CORRECT**

`renderCenterContent` (lines 15-19):
```tsx
const renderCenterContent = () => {
  if (ui.activePanel === 'puzzle') return <PuzzleEditorPanel />;
  if (ui.activePanel === 'words') return <WordManagerPanel />;
  return <SceneCanvas />;
};
```

- Priority: `puzzle` > `words` > default (`SceneCanvas`).
- `scene`, `assets`, `settings` all correctly fall through to `<SceneCanvas />` (matching the prior behavior).
- `MainAreaTabBar` uses `isSceneActive = activePanel === 'scene' || activePanel === 'assets' || activePanel === 'settings'`, which correctly highlights the "씬 편집" tab for all three scene-related sub-panels.
- No state leaks between routes: each panel is a distinct React subtree.

### 3.7 `ProjectTree.tsx` — `setActivePanel` placement

**Verdict: CORRECT**

`setActivePanel` is called in `CaseNode.onSelect` (line 385) and `SceneNode.onSelect` (line 234):

**Case selection** (`CaseNode`, lines 383-387):
```tsx
onSelect={() => {
  setSelection({ actId: act.id, caseId: c.id, sceneId: null, hotspotId: null });
  setActivePanel('words');
  if (!expandedCases.has(c.id)) toggleCase(c.id);
}}
```
- `setSelection` runs first, then `setActivePanel('words')`, then tree expand/collapse.
- Tree expand (`toggleCase`) is a local state operation independent of `setActivePanel`, so no interference.

**Scene selection** (`SceneNode.onSelect`, lines 232-235):
```tsx
onSelect={() => {
  setSelection({ caseId: caseData.id, sceneId: scene.id, hotspotId: null });
  setActivePanel('scene');
}}
```
- Similarly ordered: selection first, panel switch second.
- `CaseNode.onToggle` (the expand/collapse button) only calls `onToggle` (which maps to `toggleCase`), and does NOT call `setActivePanel`. Expand/collapse is therefore decoupled from navigation.

---

## 4. Issues Found and Fixed

**None.** All checklist items passed review without defects. No fixes were required.

---

## 5. Additional Observations (non-blocking)

- `WordRow.tsx` (modified): the `handleDelete` function does not show a confirmation dialog, unlike `WordManagerRow.handleDelete`. This is intentional — `WordRow` is used in the sidebar context where the UX is lighter-weight. Not a defect.
- `WordAddForm.tsx` (modified): imports `WORD_CATEGORIES` and `CATEGORY_LABELS` from the new shared constants file — correct refactor, no duplication.
- `CaseProperties.tsx` (modified): adds two navigation buttons (`setActivePanel('words')` and `setActivePanel('puzzle')`) — both use the correct `ActivePanel` literal values from the store type.
- `packages/core/src/models/types.ts`: `Word.hint` and `Word.imageUrl` are correctly typed as optional (`hint?: LocalizedText`, `imageUrl?: string`). All consumers guard against `undefined` with `?? { ko: '', en: '' }` and `?? ''` respectively.

---

## 6. Verdict

**PASS**

- TypeScript: 0 errors across both packages.
- Tests: 204/204 passed, 0 failures, 0 regressions.
- All 7 code-review checklist items confirmed correct.
- No issues were found that required fixing.
