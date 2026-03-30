# Technical Design: GIEngine Editor Improvements + AI Integration
**Date**: 2026-03-29

## Feature 1: Inline Name Editing (ProjectTree)

### Analysis
- Store already has `updateAct`, `updateCase`, `updateScene` — UI layer only needed
- Editing state is **local React state** in each node component (no store changes)

### Event Flow
```
double-click name → setIsEditing(true), setEditValue(current)
                  → useEffect: inputRef.focus() + .select()
Enter / blur      → commit: updateAct/Case/Scene with merged locale object
Escape            → cancel: setIsEditing(false)
empty name        → cancel (no empty names)
```

### Changes
- `ProjectTree.tsx` — add `isEditing`/`editValue`/`inputRef` to `SceneNode`, `CaseNode`, `ActNode`
- Double-click handler on name span + `e.stopPropagation()` to prevent expand/collapse
- Inline `<input>` replaces span when editing; styled to match tree text

---

## Feature 2: Hotspot Drag/Resize Bug Fix

### Root Causes (confirmed by code inspection)
1. `useCanvasDrag` not imported/called in `SceneCanvas.tsx`
2. `onHotspotPointerDown` prop missing from `<HotspotOverlay>` render call → handlers never fire
3. Resize handle `<rect>` elements have no `onPointerDown` handler
4. `scaleX`/`scaleY` computed from `clientWidth/clientHeight` at render time — wrong values (falls back to 800/450 when ref is null, doesn't account for CSS aspect-ratio)

### Fix Plan

**New file: `src/utils/hotspot-drag.ts`**
Pure function `applyDragToArea(original, dragState, mode, sceneDimensions)` — all drag math isolated here, fully unit-testable.

**`HotspotOverlay.tsx`**
- Add `onResizeHandlePointerDown?: (e, hotspotId, mode: DragMode) => void` prop
- Import `DragMode` from hook
- Add cursor→DragMode map; add `onPointerDown` to each resize `<rect>`

**`SceneCanvas.tsx`**
- Import `useCanvasDrag`, `computeScale`
- Add `canvasRectRef` + `liveScale` state
- `updateCanvasRect()` via `useLayoutEffect` + called at drag start
- Remove broken `scaleX/scaleY` from `clientWidth` — use `liveScale` from `getBoundingClientRect()`
- Wire `useCanvasDrag` with `onDragMove` (drag preview) + `onDragEnd` (commit to store)
- Add `handleHotspotPointerDown` + `handleResizeHandlePointerDown` callbacks
- Pass `onHotspotPointerDown` and `onResizeHandlePointerDown` to `<HotspotOverlay>`
- `effectiveHotspots` = replace dragged hotspot with `dragPreview.area` for live feedback

---

## Feature 3-A: Background Image Upload

### UI placement
PropertiesPanel → SceneProperties section (background is a property of the scene, not a canvas tool).

### New file: `src/components/properties/SceneProperties.tsx`
Extracted from `PropertiesPanel`'s `SceneInfo`. Adds:
- Thumbnail (or checkerboard if no background)
- Hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`
- Upload + Remove buttons
- `FileReader → dataUrl → base64 → AssetDefinition{inline} → addAsset() + updateScene()`

**`PropertiesPanel.tsx`** — import and use `SceneProperties`

---

## Feature 3-B: `packages/ai` Package

### Package structure
```
packages/ai/
├── package.json          (@gi-engine/ai, deps: @gi-engine/core + @google/generative-ai)
├── tsconfig.json
└── src/
    ├── index.ts
    ├── client.ts          GeminiClient wrapper
    ├── types.ts           Request/result interfaces
    ├── generators/
    │   ├── background-generator.ts   imagen-3.0-generate-002
    │   ├── story-generator.ts        gemini-2.0-flash JSON mode
    │   └── puzzle-generator.ts       gemini-2.0-flash JSON mode
    └── prompts/
        ├── background-prompts.ts
        ├── story-prompts.ts
        └── puzzle-prompts.ts
```

### Key interfaces (types.ts)
```typescript
BackgroundGenerateRequest { sceneDescription, style?, aspectRatio? }
BackgroundGenerateResult  { asset: AssetDefinition, promptUsed }
StoryGenerateRequest      { caseTitle, genre?, locale, hints? }
StoryGenerateResult       { description: LocalizedText, suggestedSceneNames: LocalizedText[] }
PuzzleGenerateRequest     { caseTitle, caseDescription, wordBank, locale }
PuzzleGenerateResult      { title: LocalizedText, template: PuzzleTemplate, answers }
```

### API Key management
- Stored in `localStorage` under `'gi_engine_gemini_api_key'`
- Never in store, never in .gi-project files
- `GeminiClient` instantiated on-demand (not at module load)
- New `AISettings.tsx` component in editor for key input/save/clear

### Editor AI integration
- `AISettings.tsx` — password input + save/clear buttons, reads/writes localStorage
- `AIBackgroundModal.tsx` — scene description textarea + style select → calls `generateBackground()` → `addAsset()` + `updateScene()`
- "AI 배경 생성" button in SceneCanvas toolbar (only when scene selected)
- AI story/puzzle generation via PropertiesPanel buttons (case/puzzle selected state)

---

## Implementation Order

| Wave | Files | Parallelizable |
|------|-------|----------------|
| 1a | `hotspot-drag.ts` (new), `HotspotOverlay.tsx`, `SceneCanvas.tsx` | with 1b |
| 1b | `ProjectTree.tsx` | with 1a |
| 2a | `SceneProperties.tsx` (new), `PropertiesPanel.tsx` | with 2b |
| 2b | `packages/ai/` — all new files | with 2a |
| 3  | `AISettings.tsx`, `AIBackgroundModal.tsx`, SceneCanvas AI button wiring | after 2a+2b |

## Tests
- `packages/editor/tests/hotspot-drag.test.ts` — `applyDragToArea` pure function
- `packages/ai/tests/generators.test.ts` — mock GeminiClient, verify output shapes
