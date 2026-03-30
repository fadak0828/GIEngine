# Code Review: content-and-export Feature
**Date**: 2026-03-30
**Reviewer**: Reviewer Agent
**Design document**: `docs/designs/2026-03-30-content-and-export.md`
**QA report**: `docs/qa/2026-03-30-content-and-export-qa-report.md`

---

## Verdict: APPROVED_WITH_NOTES

Zero CRITICAL issues. Zero security issues. Two MAJOR issues that must be addressed before the next milestone (one is a logic correctness defect, one is a runtime regression risk). The remaining findings are MINOR or NOTE-level.

---

## Summary

All four features are structurally complete and match the design document in intent. TypeScript compiles cleanly across both packages. The QA report's "critical" finding regarding `@gi-engine/exporter` in `package.json` is actually resolved — the dependency is present. However, independent review surfaces two issues the QA agent missed: a logic error in `totalSize` accounting and an anchor element that is appended to the DOM but never removed. The `useEffect` dep array in `AIBackgroundModal` is correct with no infinite-loop risk, and the `nextSlotId` scan is sound.

---

## Findings

### MAJOR — M-1: `totalSize` calculation is not the sum of `breakdown` fields

**File**: `packages/exporter/src/browser-export.ts`, lines 61–68

**Description**: The design document (AD-4, Feature 3 section) specifies that `totalSize` and `breakdown` collectively account for all bytes in the exported HTML. The implementation instead computes each field independently:

```typescript
const jsSize   = byteLength(PLACEHOLDER_RUNTIME_JS);
const cssSize  = byteLength(PLACEHOLDER_RUNTIME_CSS);
const dataSize = byteLength(gameDataJson);
const totalSize = byteLength(html);                       // total of whole document

const assetsSize = Math.max(0, totalSize - jsSize - cssSize - dataSize); // residual
```

`breakdown.js + breakdown.css + breakdown.assets + breakdown.data` is designed to equal `totalSize`. Under the current scheme this identity holds only incidentally because `assetsSize` is computed as a residual. The problem is that the residual absorbs the HTML boilerplate (~600 bytes of markup, `<html>`, `<head>`, `<body>`, the boot script wrapper, CSS base reset, etc.) and presents it under the `assets` label, which is semantically wrong. When the game has zero inlined base64 assets the `assets` field will show several hundred bytes that are actually template overhead, not asset data.

This causes the `ExportModal` size breakdown table shown to the user to display misleading information. In a project with no assets, `assets` reads as ~600 B when it should read 0.

**Recommendation**: Compute `assetsSize` by measuring the base64/inline asset payload in `gameDefinition.assets.items` before serializing, then use `breakdown.js + breakdown.css + breakdown.assets + breakdown.data` to produce `totalSize` additively. If exact HTML framing overhead tracking is not required for this sprint, the minimum acceptable fix is to rename the `assets` field to `overhead` and document it as template overhead, so the UI label is accurate.

---

### MAJOR — M-2: Anchor element appended to `document.body` is never removed

**File**: `packages/editor/src/components/export/ExportModal.tsx`, lines 62–67

**Description**: The download trigger sequence is:

```typescript
const a = document.createElement('a');
a.href = url;
a.download = exportResult.fileName;
a.click();
URL.revokeObjectURL(url);
```

The anchor `a` is created and clicked but is never appended to `document.body`. While `a.click()` works in modern Chromium without appending, Firefox and some older WebKit engines require the element to be in the document for programmatic `.click()` to trigger a download. If a developer adds the required `document.body.appendChild(a)` call to fix cross-browser compatibility, the element will leak unless `document.body.removeChild(a)` is also added immediately after the click.

The QA report confirms `URL.revokeObjectURL` is called correctly. However, it does not flag the missing append/remove pattern. Because the code works in the primary target browser (Chromium) today, this is classified MAJOR rather than CRITICAL, but it represents a latent cross-browser defect.

**Recommendation**: Use the standard safe pattern:

```typescript
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

---

### MINOR — m-1: SceneNode `setSelection` does not pass `actId`

**File**: `packages/editor/src/components/tree/ProjectTree.tsx`, line 232

**Description**: `CaseNode` correctly calls `setSelection({ actId: act.id, caseId: c.id, sceneId: null, hotspotId: null })` (design requirement R-1, verified). However, the nested `SceneNode.onSelect` delegate inside `CaseNode` calls:

```typescript
onSelect={() => setSelection({ caseId: caseData.id, sceneId: scene.id, hotspotId: null })}
```

`actId` is omitted. If `setSelection` performs a full replace (not a merge), this clears `actId` from the selection whenever a scene is clicked, which would break any downstream code that depends on `selection.actId` being populated when a scene is selected.

The design document does not describe a bug here because it only specifies the fix for the case selection path. Whether `setSelection` is additive or destructive determines severity. This should be verified against the store implementation and, if destructive, `actId: actId` (passed as a prop to `CaseNode`) must be threaded into the `onSelect` call.

---

### MINOR — m-2: `PuzzleTemplateEditor` uses array index as React key for segment list

**File**: `packages/editor/src/components/puzzle/PuzzleTemplateEditor.tsx`, line 109

```tsx
{segments.map((seg, i) => (
  <SegmentRow key={i} ...
```

Using the array index as `key` causes React to misidentify elements after deletions or reorder operations. When a segment is deleted from the middle of the list, React reuses DOM nodes from adjacent entries rather than unmounting the correct element, which can cause stale controlled-input values to appear in the wrong row. Since segments are actively reordered via move-up/move-down, this is an active issue, not merely theoretical.

**Recommendation**: Use a stable identity. For `slot` segments, `slotId` is already unique. For `text` and `line_break`, generate a stable `id` field when the segment is created (e.g., a `crypto.randomUUID()` call in `addText`/`addLineBreak`) and use that as the key.

---

### MINOR — m-3: `AnswerKeyEditor` drops `partiallyCorrectWordIds` on every save

**File**: `packages/editor/src/components/puzzle/AnswerKeyEditor.tsx`, lines 40–46

```typescript
const handleSelect = (slotId: string, wordId: string) => {
  const newAnswers: Record<string, AnswerDefinition> = { ...answers };
  if (wordId === '') {
    delete newAnswers[slotId];
  } else {
    newAnswers[slotId] = { correctWordId: wordId };   // <-- full replacement
  }
  updatePuzzleAnswers(caseId, newAnswers);
};
```

`AnswerDefinition` includes an optional `partiallyCorrectWordIds` field. Each time the user changes the correct word for a slot, `handleSelect` replaces the entire `AnswerDefinition` with `{ correctWordId: wordId }`, silently discarding any previously set `partiallyCorrectWordIds`.

This sprint does not expose UI for partial-credit words, so no data can be entered through the editor. However, if a puzzle is generated by `AIPuzzleGenerator` and the AI returns `partiallyCorrectWordIds`, a subsequent user edit in `AnswerKeyEditor` will erase them.

**Recommendation**: Spread the existing definition to preserve optional fields: `newAnswers[slotId] = { ...answers[slotId], correctWordId: wordId }`.

---

### NOTE — n-1: QA-flagged `@gi-engine/exporter` dependency is actually present

**File**: `packages/editor/package.json`, line 17

The QA report classifies this as a critical blocker. The dependency is present in the actual file:

```json
"@gi-engine/exporter": "*"
```

The QA agent's finding was incorrect. No action required.

---

### NOTE — n-2: `useEffect` dep array in `AIBackgroundModal` is correct — no infinite loop

**File**: `packages/editor/src/components/ai/AIBackgroundModal.tsx`, lines 136–140

```typescript
useEffect(() => {
  if (!isPromptManuallyEdited) {
    setPromptDraft(autoPrompt);
  }
}, [autoPrompt, isPromptManuallyEdited]);
```

The dep array `[autoPrompt, isPromptManuallyEdited]` is correct and complete. `setPromptDraft` does not affect `autoPrompt` (which is derived from `description`, `sceneDimensions`, `hotspots`, `locale`, `style`), so there is no circular dependency. Setting `promptDraft` does not change `isPromptManuallyEdited` from within the effect. No infinite loop risk.

---

### NOTE — n-3: Description textarea uses `rows={3}`, design specifies `rows=4`

**File**: `packages/editor/src/components/properties/CaseProperties.tsx`, lines 83 and 103

The design document specifies `rows=4` for the description textarea. Both KO and EN textareas use `rows={3}`. This is a cosmetic deviation with no functional impact, already noted by the QA agent. Trivial to correct if desired.

---

### NOTE — n-4: `AIPuzzleGenerator` re-filters `words` from store instead of using prop from parent

**File**: `packages/editor/src/components/puzzle/AIPuzzleGenerator.tsx`, lines 23–26

```typescript
const words = useEditorStore(s => s.words);
const caseWords = words.filter(w => w.caseId === caseId);
```

`PuzzleEditorPanel` already computes `caseWords` and passes `caseTitle`/`caseDescription` down, but passes the full word list to `AIPuzzleGenerator` via the store rather than as a prop. This is a minor cohesion issue: the filtering logic is duplicated between `PuzzleEditorPanel` (line 24) and `AIPuzzleGenerator` (line 26). There is no correctness defect; both produce the same result.

---

### NOTE — n-5: `assembleHtml` call parameters verified correct

**File**: `packages/exporter/src/browser-export.ts`, lines 52–58

The `assembleHtml` signature is `{ title, css, js, gameData, lang }`. The call in `browserExport` passes:
- `title` — derived from `gameDefinition.title.ko ?? .en ?? 'GIEngine Game'`
- `css` — `PLACEHOLDER_RUNTIME_CSS`
- `js` — `PLACEHOLDER_RUNTIME_JS`
- `gameData` — `gameDataJson`
- `lang` — `gameDefinition.supportedLocales?.[0] ?? 'ko'`

All parameters are present and correctly typed. No issue.

---

### NOTE — n-6: `ExportModal` state is not reset when modal is unmounted externally

**File**: `packages/editor/src/components/export/ExportModal.tsx`, lines 33, 38–45

The modal returns `null` when `open === false`, which unmounts the component and resets all `useState` values automatically via React's lifecycle. The design note R-5 ("Modal unmounts on close → all state resets fresh on reopen") is correctly implemented. The explicit reset in `handleClose` is redundant but harmless.

---

## Checklist Summary

| File | Design match | No untyped `any` | Memory/cleanup | Edge cases | Security | React correctness |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| `runtime-placeholder.ts` | Pass | Pass | N/A | Pass | Pass | N/A |
| `browser-export.ts` | Pass (M-1) | Pass | N/A | Pass | Pass | N/A |
| `exporter/index.ts` | Pass | Pass | N/A | N/A | N/A | N/A |
| `CaseProperties.tsx` | Pass | Pass | Pass | Pass | Pass | Pass |
| `PropertiesPanel.tsx` | Pass | Pass | Pass | Pass | Pass | Pass |
| `ProjectTree.tsx` (CaseNode) | Pass (m-1) | Pass | Pass | Pass | Pass | Pass |
| `PuzzleEditorPanel.tsx` | Pass | Pass | Pass | Pass | Pass | Pass |
| `PuzzleTemplateEditor.tsx` | Pass | Pass | Pass | Pass | Pass | Warn (m-2) |
| `SegmentRow.tsx` | Pass | Pass | Pass | Pass | Pass | Pass |
| `AnswerKeyEditor.tsx` | Pass | Pass | Pass | Warn (m-3) | Pass | Pass |
| `AIPuzzleGenerator.tsx` | Pass | Note (eslint suppressed) | Pass | Pass | Pass | Pass |
| `ExportModal.tsx` | Pass | Note (eslint suppressed) | Warn (M-2) | Pass | Pass | Pass |
| `MainLayout.tsx` | Pass | Pass | N/A | Pass | N/A | Pass |
| `AIBackgroundModal.tsx` | Pass | Note (eslint suppressed) | Pass | Pass | Pass | Pass |

---

## Action Required Before Next Milestone

1. **M-1** (`browser-export.ts`): Fix `assetsSize` computation or relabel the field so the size breakdown table is accurate.
2. **M-2** (`ExportModal.tsx`): Add `document.body.appendChild(a)` / `document.body.removeChild(a)` around the anchor click for cross-browser download compatibility.

## Recommended (Non-Blocking)

3. **m-2** (`PuzzleTemplateEditor.tsx`): Replace index-based React keys with stable IDs to prevent stale-input bugs during segment reorder/delete.
4. **m-3** (`AnswerKeyEditor.tsx`): Spread existing `AnswerDefinition` to preserve `partiallyCorrectWordIds` when updating `correctWordId`.
5. **m-1** (`ProjectTree.tsx`): Verify whether `setSelection` is destructive; if so, thread `actId` into `SceneNode.onSelect`.
