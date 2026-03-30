# Technical Design: Content & Export — 4-Feature Implementation Plan

**Date**: 2026-03-30
**Spec**: `docs/specs/2026-03-30-content-and-export.md`

---

## Codebase Audit Summary

**Feature 1 — Case Description:**
- `Case` type has `description: LocalizedText` and `title: LocalizedText`. `makeDefaultCase()` initializes both.
- `updateCase(caseId, patch)` already handles title and description. No store changes needed.
- **Bug**: `setSelection` is a shallow merge. `CaseNode.onSelect` does not clear `sceneId: null`. Fix required.

**Feature 2 — Puzzle Editor:**
- `PuzzleTemplate.segments: PuzzleSegment[]` — union: `{type:'text', content:LocalizedText}`, `{type:'slot', slotId, placeholder?, acceptCategory?}`, `{type:'line_break'}`.
- `AnswerDefinition = { correctWordId: string; partiallyCorrectWordIds?: string[] }`. Keyed by `slotId`.
- `ActivePanel` already has `'puzzle'`. Store actions: `updateMainPuzzle`, `updatePuzzleTemplate`, `updatePuzzleAnswers`.

**Feature 3 — Export:**
- `bundler.ts` uses `node:fs/promises` — Node.js only.
- `assembleHtml()` in `template.ts` is pure string — browser-safe.
- Assets already stored as `inline` base64 in editor store.

**Feature 4 — AI Contextual Prompt:**
- `AIBackgroundModal` receives `sceneId/caseId` but no hotspot data.
- `Hotspot.area` can be `rect | circle | polygon` — must normalize all three.

---

## Architecture Decisions

### AD-1: PropertiesPanel Selection Routing
Fix `CaseNode.onSelect`:
```typescript
setSelection({ actId: act.id, caseId: c.id, sceneId: null, hotspotId: null })
```
New PropertiesPanel branch order:
1. `hotspot + scene` → HotspotProperties
2. `scene + caseId` → SceneProperties
3. `caseId (no scene)` → CaseProperties (NEW)
4. project exists → EmptyProperties

### AD-2: PuzzleEditorPanel in MainLayout
`activePanel === 'puzzle'` replaces `<SceneCanvas>` in center column. Entry: "퍼즐 편집 열기" button in `CaseProperties` → `setActivePanel('puzzle')`. Back button → `setActivePanel('scene')`.

### AD-3: Browser Export — Runtime placeholder
Extract `PLACEHOLDER_RUNTIME_JS`/`PLACEHOLDER_RUNTIME_CSS` from `bundler.ts` into new `runtime-placeholder.ts` (zero Node.js imports). Both `bundler.ts` and `browser-export.ts` import from it.

### AD-4: Export size in browser
Use `new TextEncoder().encode(str).byteLength` instead of `Buffer.byteLength`.

### AD-5: Contextual prompt location
`buildContextualBackgroundPrompt()` and `computeHotspotContexts()` added to `packages/ai/src/prompts/background-prompts.ts`. Exported from `packages/ai/src/index.ts`.

---

## Feature 1: Case Description Editor

### New file: `packages/editor/src/components/properties/CaseProperties.tsx`

Props: `{ caseData: Case }`

UI:
- Section header: `📁 {caseData.title[editorLocale]}`
- Read-only ID
- LocalizedText input for `title` (single-line): onChange → `updateCase(caseData.id, { title: ... })`
- LocalizedText input for `description` (multiline, rows=4): onChange → `updateCase(caseData.id, { description: ... })`
- "퍼즐 편집 열기" button → `setActivePanel('puzzle')`

Pattern for LocalizedText input: two rows (ko / en) using `<input>` elements, matching `SceneProperties` styling.

### Changes: `PropertiesPanel.tsx`
- Import `CaseProperties`
- Add `selectedCase` resolved from `selection.caseId`
- New branch: `selectedCase && !selectedScene` → `<CaseProperties caseData={selectedCase} />`

### Changes: `ProjectTree.tsx` — CaseNode
Change `onSelect` to:
```typescript
setSelection({ actId: act.id, caseId: c.id, sceneId: null, hotspotId: null })
```

---

## Feature 2: Puzzle Editor Panel

### File structure
```
packages/editor/src/components/puzzle/
├── PuzzleEditorPanel.tsx      — top-level, chrome + back button
├── PuzzleTemplateEditor.tsx   — segment list + add buttons
├── SegmentRow.tsx             — one PuzzleSegment (all 3 types)
├── AnswerKeyEditor.tsx        — slot → word mapping table
└── AIPuzzleGenerator.tsx      — AI generation + preview
```

### PuzzleEditorPanel.tsx
Reads: `selection.caseId`, case's `puzzles.main`, `words` filtered by caseId.
Actions: `updateMainPuzzle`, `updatePuzzleTemplate`, `updatePuzzleAnswers`, `setActivePanel`.

Layout:
```
[← 씬으로 돌아가기]    [퍼즐 편집 — {case.title}]
────────────────────────────────────────────
PuzzlePreview (read-only rendered sentence)
[퍼즐 제목: LocalizedTextInput]
PuzzleTemplateEditor
AnswerKeyEditor
AIPuzzleGenerator
```

### SegmentRow.tsx
- `text`: two inputs (ko, en) + delete button
- `slot`: slotId chip + placeholder inputs + acceptCategory select + delete
- `line_break`: "— 줄바꿈 —" label + delete

### AnswerKeyEditor.tsx
Derives slots from `segments.filter(s => s.type === 'slot')`. Per slot: `<select>` of case words, onChange → `updatePuzzleAnswers(caseId, newAnswers)`.

### AIPuzzleGenerator.tsx
State: `generationPhase: 'idle' | 'loading' | 'preview' | 'error'`, `previewResult: PuzzleGenerateResult | null`.
Dynamic import `@gi-engine/ai` (same pattern as `AIBackgroundModal`).
Flow: generate → preview → user approves → apply to store.

### SlotId uniqueness rule
When adding a slot: scan existing slotIds in the template, use `slot_${maxN + 1}` where maxN is the highest existing slot number. Never recycle deleted slot IDs.

### MainLayout.tsx change
```tsx
{ui.activePanel === 'puzzle' ? <PuzzleEditorPanel /> : <SceneCanvas />}
```

---

## Feature 3: Export to Single HTML

### New file: `packages/exporter/src/runtime-placeholder.ts`
Extract `PLACEHOLDER_RUNTIME_JS` and `PLACEHOLDER_RUNTIME_CSS` constants from `bundler.ts`. Zero Node.js imports.

### Modify: `packages/exporter/src/bundler.ts`
Import constants from `runtime-placeholder.ts` instead of defining them inline.

### New file: `packages/exporter/src/browser-export.ts`

```typescript
import type { GameDefinition } from '@gi-engine/core';
import { assembleHtml } from './template.js';
import { PLACEHOLDER_RUNTIME_JS, PLACEHOLDER_RUNTIME_CSS } from './runtime-placeholder.js';

export interface BrowserExportOptions {
  gameDefinition: GameDefinition;
  mode: 'development' | 'production';
}

export interface BrowserExportResult {
  html: string;
  fileName: string;
  totalSize: number;
  breakdown: { js: number; css: number; assets: number; data: number };
}

export function browserExport(options: BrowserExportOptions): BrowserExportResult
```

Algorithm:
1. `gameDataJson = JSON.stringify(gameDefinition, null, mode === 'development' ? 2 : undefined)`
2. `html = assembleHtml({ title, css: PLACEHOLDER_RUNTIME_CSS, js: PLACEHOLDER_RUNTIME_JS, gameData: gameDataJson, lang })`
3. Sizes: `new TextEncoder().encode(str).byteLength`
4. Return result

### Update: `packages/exporter/src/index.ts`
Re-export `browserExport`, `BrowserExportOptions`, `BrowserExportResult`.

### New file: `packages/editor/src/components/export/ExportModal.tsx`

Props: `{ open: boolean; onClose: () => void }`
State: `phase: 'idle' | 'exporting' | 'success' | 'error'`, `fileName`, `mode: 'development' | 'production'`, `result`, `errorMessage`

`handleExport()`:
1. `phase = 'exporting'`
2. Dynamic import `@gi-engine/exporter` → `browserExport({ gameDefinition: project, mode })`
3. Download: `Blob` + `URL.createObjectURL` + anchor click → `URL.revokeObjectURL`
4. `phase = 'success'`, show size breakdown
5. On error: `phase = 'error'`, show message

Modal NOT dismissable when `phase === 'exporting'`.

Size format helper: `< 1KB` → bytes, `< 1MB` → KB, else MB.

### Changes: `Toolbar.tsx`
Add `"📤 익스포트"` button → `setExportModalOpen(true)`. Disabled when no project.
Toolbar renders `<ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />`.

---

## Feature 4: AI Background Context-Aware Prompt

### New functions in `packages/ai/src/prompts/background-prompts.ts`

#### Types
```typescript
export interface HotspotContext {
  label: string;
  positionZone: string;  // e.g. "left-top", "center-middle"
  relativeSize: 'small' | 'medium' | 'large';
  description: string;
}

export interface ContextualBackgroundPromptOptions {
  sceneDescription: string;
  scene: { dimensions: { width: number; height: number } };
  hotspots: Hotspot[];
  locale: Locale;
  style?: BackgroundStyle;
}
```

#### `computeHotspotContexts(scene, hotspots, locale): HotspotContext[]`
Normalize area to bounding box:
- `rect`: x, y, width, height directly
- `circle`: `x=cx-r, y=cy-r, w=h=2r`
- `polygon`: min/max of all points

Zone: center of bounding box divided by scene dimensions into 3x3 grid.
Size: `width / scene.width` → `< 0.10` small, `< 0.30` medium, else large.
Label: `ariaLabel[locale]` → `action.title?.[locale]` → `hotspot.id`.

#### `buildContextualBackgroundPrompt(options): string`
If `hotspots.length === 0`, delegate to `buildBackgroundPrompt`.
Otherwise build structured English prompt with spatial layout section.

### Update: `packages/ai/src/index.ts`
Export `buildContextualBackgroundPrompt`, `computeHotspotContexts`, `HotspotContext`, `ContextualBackgroundPromptOptions`.

### Changes: `AIBackgroundModal.tsx`

New props: `hotspots: Hotspot[]`, `sceneDimensions: { width: number; height: number }`

New state:
- `promptDraft: string`
- `isPromptManuallyEdited: boolean`
- `contextExpanded: boolean`

`useMemo` → `autoPrompt` from description + hotspots + style + locale.
`useEffect` → sync `promptDraft = autoPrompt` when autoPrompt changes (if not manually edited).
`handleGenerate` → uses `promptDraft` as `sceneDescription`.

New UI sections:
1. **Context preview** (collapsible `▶`): table of label/zone/size per hotspot
2. **Prompt draft** (editable `<textarea rows=5>` + "복사" button + "자동 생성으로 초기화" link when manually edited)

### Changes: `SceneCanvas.tsx`
```tsx
<AIBackgroundModal
  open={aiModalOpen}
  onClose={() => setAiModalOpen(false)}
  sceneId={scene.id}
  caseId={selection.caseId}
  hotspots={scene.hotspots}
  sceneDimensions={scene.dimensions}
/>
```

---

## Implementation Order

| Wave | Files | Parallelizable |
|------|-------|----------------|
| 1a | `packages/exporter/src/runtime-placeholder.ts` (new) | with 1b |
| 1b | `packages/ai/src/prompts/background-prompts.ts` — add context fns | with 1a |
| 2a | `packages/exporter/src/bundler.ts` — extract constants | after 1a |
| 2b | `packages/exporter/src/browser-export.ts` (new) | after 1a, with 2c |
| 2c | `packages/exporter/src/index.ts` — add exports | after 2b |
| 2d | `packages/ai/src/index.ts` — add new exports | after 1b |
| 3a | `packages/editor/src/components/properties/CaseProperties.tsx` (new) | with 3b, 3d |
| 3b | `packages/editor/src/components/tree/ProjectTree.tsx` — fix CaseNode | with 3a |
| 3c | `packages/editor/src/components/properties/PropertiesPanel.tsx` | after 3a |
| 3d | `packages/editor/src/components/export/ExportModal.tsx` (new) | with 3a |
| 3e | `packages/editor/src/components/layout/Toolbar.tsx` — export button | after 3d |
| 4a | `packages/editor/src/components/puzzle/SegmentRow.tsx` (new) | with 4b–4d |
| 4b | `packages/editor/src/components/puzzle/PuzzleTemplateEditor.tsx` (new) | with 4a |
| 4c | `packages/editor/src/components/puzzle/AnswerKeyEditor.tsx` (new) | with 4a |
| 4d | `packages/editor/src/components/puzzle/AIPuzzleGenerator.tsx` (new) | with 4a |
| 4e | `packages/editor/src/components/puzzle/PuzzleEditorPanel.tsx` (new) | after 4a–4d |
| 5a | `packages/editor/src/components/layout/MainLayout.tsx` | after 4e, 3c |
| 5b | `packages/editor/src/components/ai/AIBackgroundModal.tsx` | after 2d |

---

## Test Strategy

| Test | Coverage |
|------|----------|
| `packages/ai/src/__tests__/background-prompts.test.ts` | `computeHotspotContexts` (all area types, all zones, sizes), `buildContextualBackgroundPrompt` |
| `packages/exporter/src/__tests__/browser-export.test.ts` | valid HTML output, embedded JSON, size breakdown |
| `packages/editor/src/__tests__/CaseProperties.test.tsx` | renders fields, onChange, puzzle button |
| `packages/editor/src/__tests__/PuzzleTemplateEditor.test.tsx` | add/delete/reorder, slotId uniqueness |
| `packages/editor/src/__tests__/AnswerKeyEditor.test.tsx` | per-slot rows, word select, updatePuzzleAnswers |
| `packages/editor/src/__tests__/ExportModal.test.tsx` | phase transitions, not dismissable during export |
| `packages/editor/src/__tests__/PropertiesPanel.test.tsx` | CaseProperties shown when caseId+no sceneId |

---

## Risk Notes

**R-1**: `setSelection` sceneId retention — most critical fix, one line in ProjectTree.tsx.
**R-2**: SlotId uniqueness — use max existing N + 1, not total count.
**R-3**: Export uses runtime placeholder JS/CSS — sufficient for this sprint. Real runtime integration deferred.
**R-4**: Dynamic import typing via `new Function` pattern for `@gi-engine/ai` and `@gi-engine/exporter`.
**R-5**: Modal unmounts on close → all state resets fresh on reopen. Correct behavior.
