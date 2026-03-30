# QA Report: content-and-export Feature
**Date**: 2026-03-30
**Reviewer**: QA Agent
**Design document**: `docs/designs/2026-03-30-content-and-export.md`

---

## Overall: PARTIAL PASS

One critical dependency issue found (missing `@gi-engine/exporter` in editor's `package.json`). All TypeScript checks pass. All feature logic is correctly implemented. One minor deviation in AI prompt handling.

---

## 1. TypeScript Checks

| Package | Result |
|---------|--------|
| `packages/editor/tsconfig.json` | ✅ Zero errors |
| `packages/exporter/tsconfig.json` | ✅ Zero errors |

---

## 2. Feature Checklists

### Feature 1: Case Description Editor

**`CaseProperties.tsx`**
- ✅ Renders title LocalizedText input — two `<input>` elements for `ko` and `en`
- ✅ Renders description LocalizedText textarea — two `<textarea rows={3}>` elements for `ko` and `en`
- ✅ onChange calls `updateCase` with merged value (spread pattern: `{ title: { ...caseData.title, ko/en: e.target.value } }`)
- ✅ "퍼즐 편집 열기" button calls `setActivePanel('puzzle')`

**`ProjectTree.tsx` — CaseNode.onSelect**
- ✅ `setSelection({ actId: act.id, caseId: c.id, sceneId: null, hotspotId: null })` — all four fields present

**`PropertiesPanel.tsx`**
- ✅ Branch order correct: `selectedHotspot && selectedScene` → `selectedScene && selectedCaseId` → `selectedCase && !selectedScene` → `<CaseProperties caseData={selectedCase} />`

### Feature 2: Puzzle Editor

**`SegmentRow.tsx`**
- ✅ Handles `text` type: two inputs (ko, en) + delete button + move up/down
- ✅ Handles `slot` type: slotId chip + placeholder inputs (ko, en) + acceptCategory select + delete
- ✅ Handles `line_break` type: "— 줄바꿈 —" label + delete

**`PuzzleTemplateEditor.tsx`**
- ✅ Add buttons for text, slot, and line_break
- ✅ SlotId uniqueness: uses `nextSlotId()` which scans `slot_N` patterns and returns `slot_${maxN + 1}` — never recycles deleted IDs
- ✅ Live preview: renders segment list as string above the editor

**`AnswerKeyEditor.tsx`**
- ✅ Per-slot word selects derived from `segments.filter(s => s.type === 'slot')`
- ✅ onChange calls `updatePuzzleAnswers(caseId, newAnswers)`

**`AIPuzzleGenerator.tsx`**
- ✅ State: `generationPhase: 'idle' | 'loading' | 'preview' | 'error'`
- ✅ Preview/apply flow: generate → `setPhase('preview')` → user approves → apply to store
- ✅ Dynamic import via `new Function('s', 'return import(s)')` pattern (same as AIBackgroundModal)

**`PuzzleEditorPanel.tsx`**
- ✅ Back button: `onClick={() => setActivePanel('scene')}` → "← 씬으로 돌아가기"

**`MainLayout.tsx`**
- ✅ `{ui.activePanel === 'puzzle' ? <PuzzleEditorPanel /> : <SceneCanvas />}`

### Feature 3: Export

**`runtime-placeholder.ts`**
- ✅ Exports `PLACEHOLDER_RUNTIME_JS` and `PLACEHOLDER_RUNTIME_CSS` constants
- ✅ Zero Node.js imports (confirmed by grep)

**`browser-export.ts`**
- ✅ Uses `new TextEncoder().encode(str).byteLength` (function `byteLength`) — not `Buffer`
- ✅ Uses `assembleHtml` and PLACEHOLDER constants imported from `runtime-placeholder.js`
- ✅ Returns `BrowserExportResult` with `html`, `fileName`, `totalSize`, `breakdown` ({js, css, assets, data})

**`ExportModal.tsx`**
- ✅ Phase state machine: `idle` → `exporting` → `success` / `error`
- ✅ `handleExport` uses dynamic import via `new Function('s', 'return import(s)')` for `@gi-engine/exporter`
- ✅ Triggers download via `Blob` + `URL.createObjectURL` + anchor `.click()`
- ✅ `URL.revokeObjectURL(url)` called immediately after `a.click()`
- ✅ NOT dismissable when `phase === 'exporting'`: `handleClose` returns early if `isExporting`; close button and backdrop both disabled/blocked
- ✅ Shows size breakdown table on success with all 4 breakdown fields

**`Toolbar.tsx`**
- ✅ "📤 익스포트" button present, `disabled={!project}`
- ✅ `<ExportModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} />` rendered in Toolbar

### Feature 4: AI Background Contextual Prompt

**`AIBackgroundModal.tsx`**
- ✅ Accepts `hotspots: Hotspot[]` and `sceneDimensions: { width: number; height: number }` props
- ✅ `promptDraft` state and `isPromptManuallyEdited` state declared
- ✅ `autoPrompt` computed via `useMemo` from description + hotspots + style + locale (`buildContextualPromptInline`)
- ✅ `useEffect` syncs `promptDraft = autoPrompt` when autoPrompt changes (unless `isPromptManuallyEdited`)
- ⚠️ `handleGenerate` uses `effectiveDescription = promptDraft.trim() || description.trim()` — **minor deviation**: design says use `promptDraft` directly as `sceneDescription`, but the code falls back to `description.trim()` if `promptDraft` is empty. Functionally fine: if `promptDraft` is empty, `autoPrompt` would also be empty, so the fallback is safe.
- ✅ Collapsible context preview: `▶/▼` toggle button showing hotspot table (label / positionZone / relativeSize)
- ✅ Copy button ("복사") for prompt draft via `navigator.clipboard.writeText`
- ✅ Reset link ("자동 생성으로 초기화") shown only when `isPromptManuallyEdited`

**`SceneCanvas.tsx`**
- ✅ Passes `hotspots={scene.hotspots}` and `sceneDimensions={scene.dimensions}` to `AIBackgroundModal`

---

## 3. Critical Bug Checks

| Check | Result | Detail |
|-------|--------|--------|
| `computeHotspotContextsInline` handles all 3 area types | ✅ | `rect`, `circle` (uses `cx - radius`), `polygon` (min/max of all points) |
| SlotId uniqueness uses `max(existingSlotNumbers) + 1` | ✅ | `nextSlotId()` scans all slots for `slot_N` pattern, returns `slot_${maxN + 1}` |
| Export `URL.revokeObjectURL` called after download | ✅ | Called synchronously after `a.click()` on line 67 of ExportModal.tsx |
| `@gi-engine/exporter` in editor's `package.json` | ❌ | **MISSING** — `@gi-engine/exporter` is not listed in `packages/editor/package.json` dependencies. The dynamic import uses `new Function` to bypass TypeScript's static analysis, so TS does not catch this, but the runtime import will fail unless the bundler (Vite) can resolve the package via workspace linking |

---

## 4. Additional Observations

- **CaseNode `actId` in `setSelection`**: Correctly passes `actId: act.id` — the design-doc bug (R-1) is fixed.
- **`bundler.ts` uses extracted constants**: Confirmed — imports `PLACEHOLDER_RUNTIME_JS` and `PLACEHOLDER_RUNTIME_CSS` from `runtime-placeholder.js` (lines 7, 72, 96).
- **`exporter/src/index.ts`** re-exports `browserExport`, `BrowserExportOptions`, `BrowserExportResult` — ✅
- **Description field textarea rows**: Design specifies `rows=4`; implementation uses `rows={3}`. Minor cosmetic deviation, functionally equivalent.
- **`AIPuzzleGenerator` `GenerationPhase` type** includes all required values (`'idle' | 'loading' | 'preview' | 'error'`).

---

## 5. Verdict

| Feature | Status |
|---------|--------|
| Feature 1: Case Description Editor | ✅ PASS |
| Feature 2: Puzzle Editor | ✅ PASS |
| Feature 3: Export | ⚠️ PARTIAL — missing `@gi-engine/exporter` in editor `package.json` |
| Feature 4: AI Background Contextual Prompt | ✅ PASS (minor deviation in prompt fallback) |

### Action Required

**Critical**: Add `@gi-engine/exporter` to `packages/editor/package.json` dependencies:
```json
"@gi-engine/exporter": "*"
```

Without this, the dynamic import `import('@gi-engine/exporter')` at runtime will fail in the bundled application unless the workspace resolver adds it automatically. This should be verified with an end-to-end build test.

### Summary

All TypeScript compiles cleanly. All four features are logically and structurally correct. The sole blocking issue is the missing `@gi-engine/exporter` package declaration in the editor's dependency manifest, which may cause runtime failures depending on the workspace/bundler configuration.
