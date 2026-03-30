# GIEngine Visual Editor — Code Review Report

**Date**: 2026-03-29
**Package under review**: `packages/editor` (`@gi-engine/editor` v0.1.0)
**Reviewer**: Claude Sonnet 4.6 (Reviewer Agent)
**Design document**: `docs/designs/2026-03-29-gi-editor.md`
**QA report**: `docs/qa/2026-03-29-gi-editor-qa-report.md`

---

## Verdict: APPROVED

| Category | Count |
|----------|-------|
| CRITICAL | 0 |
| IMPORTANT | 4 |
| MINOR | 6 |

The implementation is functionally correct and architecturally sound. All critical paths work as designed. The four Important findings represent meaningful technical debt that should be addressed in a follow-up iteration; none of them block delivery.

---

## 1. Architecture Review

### 1.1 Package Structure — PARTIAL DEVIATION

The design document specifies a detailed directory layout that includes many sub-directories and files not yet present in the implementation. The design calls for:

```
src/store/slices/          (7 slice files)
src/components/project-tree/
src/components/scene-editor/
src/components/puzzle-designer/
src/components/asset-library/
src/components/word-bank/
src/components/modals/
src/hooks/                 (6 hook files)
src/utils/                 (5 util files)
src/i18n/
```

The implementation delivers a condensed but functional subset:

```
src/store/editor-store.ts  (single monolithic store — no slices directory)
src/components/canvas/     (renamed from scene-editor/)
src/components/tree/       (renamed from project-tree/)
src/components/layout/
src/components/properties/
src/components/preview/
src/components/shared/
src/hooks/useCanvasDrag.ts (1 of 6 planned hooks)
src/utils/coordinate.ts    (1 of 5 planned utils)
```

**Assessment**: The consolidation is an acceptable Phase 4 MVP scope reduction. The renamed directories (`canvas/` vs `scene-editor/`, `tree/` vs `project-tree/`) are consistent deviations applied uniformly. The monolithic store is a more significant architectural departure (see Section 2).

### 1.2 Dependency Rules — PASS

All imports into `packages/editor` follow the prescribed rules:
- Types from `@gi-engine/core` are imported via package alias, never via relative paths into the core package.
- No direct imports of `@gi-engine/runtime` exist — the design correctly calls for `srcdoc` injection, and the implementation defers to a runtime availability check.
- No direct imports of `@gi-engine/exporter` are present in the reviewed files (the export pathway is not yet wired, consistent with MVP scope).

### 1.3 No Cross-Package Modifications — PASS

`packages/core`, `packages/runtime`, and `packages/exporter` are not modified by the editor implementation. Confirmed by checking all import graphs.

### 1.4 Circular Dependencies — PASS

No circular dependencies are detectable. The dependency graph flows strictly: `editor` → `core` types.

---

## 2. Store Design Review

### 2.1 Monolithic Store vs. Slice Architecture — IMPORTANT

**Finding**: The design document specifies a slice-based store architecture with 7 dedicated slice files under `src/store/slices/`. The implementation delivers a single 865-line `editor-store.ts` file with all logic inlined.

**Impact**: The monolithic store is functionally equivalent and works correctly. However, it will become difficult to maintain as the store grows. The design's slice pattern would make ownership boundaries clearer and individual slices independently testable.

**Recommendation**: Refactor `editor-store.ts` into the designed slice structure in the next sprint. Each slice should be a pure function that accepts `set/get` and returns its action handlers, then composed in the main store file.

### 2.2 Immer Usage — PASS

All state mutations use `produce(state.project, draft => { ... })` correctly. The draft is only mutated inside the `produce` callback; the outer `set()` call receives a new reference. No direct mutations of `state.project` outside Immer were found. This is the correct pattern for Zustand + standalone Immer.

**Note**: The design specifies `create<EditorStore>()(immer(...))` (Zustand's Immer middleware), but the implementation uses standalone `import { produce } from 'immer'`. Both patterns are correct and produce identical immutability semantics. The standalone approach is slightly more verbose but avoids wrapping the entire store in middleware.

### 2.3 State Fields Coverage — PASS

All required state fields from the design specification are present and correctly typed:
- `project: GameDefinition | null` — present
- `words: Word[]` — present (design section 3.2 explicitly recommends this field)
- `meta: ProjectMeta` (filePath, isDirty, lastSavedAt) — present
- `selection: SelectionState` (actId, caseId, sceneId, hotspotId, puzzleId, layerId) — present
- `ui: UIState` (activePanel, editorLocale, previewLocale, zoom, previewVisible, previewHeight, leftPanelWidth, rightPanelWidth, sceneTool) — present

### 2.4 CRUD Actions Coverage — PASS

All required CRUD actions from the design specification are implemented:
addAct, updateAct, deleteAct, reorderActs, addCase, updateCase, deleteCase, reorderCases, addScene, updateScene, deleteScene, reorderScenes, addHotspot, updateHotspot, updateHotspotArea, updateHotspotAction, deleteHotspot, addLayer, updateLayer, deleteLayer, updateMainPuzzle, updatePuzzleTemplate, updatePuzzleAnswers, addSubPuzzle, updateSubPuzzle, deleteSubPuzzle, addAsset, updateAsset, deleteAsset, addWord, updateWord, deleteWord.

### 2.5 `isDirty` Flag — PASS

Every mutation action correctly sets `meta: { ...state.meta, isDirty: true }`. Save operations correctly reset `isDirty` to false. The `setDirty` action provides manual override capability.

### 2.6 Selection Cleanup on Deletion — PASS

- `deleteAct`: resets selection to `defaultSelection` when the deleted act was selected.
- `deleteCase`: resets to `{ ...defaultSelection, actId: state.selection.actId }` — preserves the parent act selection correctly, as the QA report verified.
- `deleteScene`: resets `sceneId` and `hotspotId` to `null` while preserving the rest.
- `deleteHotspot`: resets `hotspotId` to `null` while preserving the rest.

All selection cascade rules are correctly implemented and match the design intent.

### 2.7 `loadProject` Signature Deviation — IMPORTANT

**Finding**: The design document specifies `loadProject(definition: GameDefinition, filePath?: string)`. The implementation signature is `loadProject(definition: GameDefinition, words?: Word[], filePath?: string)` — an additional `words` parameter was added.

**Assessment**: This is a justified and beneficial deviation. Design section 3.2 explicitly acknowledges that `words` should either live in `GameDefinition` or be managed separately, and recommends the root-level `words` array. The implementation cleanly supports loading a separate words array alongside the definition, matching the save format `{ definition, words }`. The deviation improves the API.

---

## 3. Component Review

### 3.1 Empty/Null State Handling — PASS

All reviewed components handle the null/empty case gracefully:

- `ProjectTree`: renders a Korean guidance message when `project` is null.
- `SceneCanvas`: renders a centered empty-state message with icon when no scene is selected, and includes a secondary message when no project exists.
- `PropertiesPanel`: renders tiered messages — no project, no scene selected, no hotspot selected — at each level.
- `PreviewPane`: renders a collapsed bar when not visible; renders three distinct states when open (no scene selected, runtime checking, runtime missing).

### 3.2 `LocalizedTextInput` — PASS

The component correctly:
- Defaults active tab to `'ko'`.
- Calls `onChange({ ...value, [lang]: text })` — spreads the full `LocalizedText` object, so both `ko` and `en` fields are always present in the returned value regardless of which tab is active.
- Shows `⚠` warning on inactive tabs when `required` is true and the field is empty (both `hasWarningKo` and `hasWarningEn` are independently computed).
- Switches between `<input>` and `<textarea>` based on the `multiline` prop.

### 3.3 `SceneCanvas` — SVG Overlay — PASS

`SceneCanvas` uses `<HotspotOverlay>` which renders an SVG element (`<svg>`) with `<rect>` elements for each hotspot. The Canvas 2D API is not used. Drawing preview during `draw_rect` mode uses a positioned `<div>` overlay rather than SVG, which is acceptable and keeps the overlay stateless.

**Minor note**: The design specification (section 5.2) specifies that the SVG should use a `viewBox` matching the scene design resolution, which would eliminate the need for explicit `scaleX`/`scaleY` coordinate transformation in `HotspotOverlay`. The current implementation instead passes `scaleX` and `scaleY` as props and applies them manually. Both approaches are correct; the viewBox approach is architecturally cleaner. See Minor finding M-1.

### 3.4 `useCanvasDrag` — PointerEvent — PASS

The hook uses `React.PointerEvent` for the `startDrag` entry point, and native `PointerEvent` for the internally registered `pointermove`/`pointerup` listeners. `setPointerCapture` and `releasePointerCapture` are correctly called. The hook does not use `MouseEvent` anywhere.

**Event listener cleanup**: The `handleMove` and `handleUp` listeners are added dynamically on `startDrag` and removed inside `handleUp` with `removeEventListener`. This is correct for the drag lifecycle. However, if the component unmounts mid-drag the listeners will not be cleaned up (see Important finding I-3).

### 3.5 `PreviewPane` Runtime Unavailability — PASS

When `runtimeExists === false`, the component renders a graceful message with the exact build command needed (`npm run build -w packages/runtime`). The component does not crash or render an empty state. The three-state `null | true | false` pattern for async availability detection is well-implemented.

**Note**: The `<iframe>` is rendered without a `srcdoc` attribute when `runtimeExists === true` (lines 128-133). The iframe is structurally present but empty — the design specifies that `usePreviewSync` injects content via `postMessage`/`srcdoc`. Since `usePreviewSync` is not implemented in the reviewed file set, this is a known gap consistent with MVP scope, not a defect in the reviewed code.

---

## 4. Code Quality Review

### 4.1 TypeScript `any` Usage — PASS WITH NOTE

One `any` cast was found:

`D:\claude_ws\GIEngine\packages\editor\src\components\layout\Toolbar.tsx:23`
```typescript
loadProject(data.definition as any, (data.words ?? []) as any, file.name);
```

This is accompanied by an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment. The cast is necessary because the file is parsed from raw JSON without schema validation. The comment signals awareness of the type escape.

**Recommendation (Minor M-2)**: Replace the `any` cast with a Zod schema validation step before calling `loadProject`. This would provide user-facing error messages for malformed files and eliminate the type escape. The design references Zod as a tech stack dependency for exactly this purpose.

### 4.2 React 19 Patterns — PASS

No deprecated React APIs were found. Components use standard functional component patterns with hooks. No class components, no deprecated lifecycle methods, no `ReactDOM.render()`.

### 4.3 Event Listener Cleanup — IMPORTANT

**Finding** (I-3): In `useCanvasDrag.ts`, event listeners are registered on the drag target element inside `startDrag`:

```typescript
target.addEventListener('pointermove', handleMove);
target.addEventListener('pointerup', handleUp);
```

These are removed in `handleUp`. However, there is no cleanup path for the case where the component unmounts during an active drag. If unmounting occurs mid-drag, the two listeners will persist on a detached DOM element, creating a memory leak. This is a low-probability scenario in practice but is a correctness gap.

**Recommendation**: The hook should expose a `cancelDrag` function, or the calling component should call `target.removeEventListener` in a `useEffect` cleanup return. The design's hook signature does not account for this, suggesting it was an oversight.

### 4.4 Prop Drilling — PASS

Store state is accessed directly via `useEditorStore` selectors throughout the component tree. There is no prop drilling beyond one level. Components subscribe to exactly the slices they need (e.g., `useEditorStore(s => s.project)`, `useEditorStore(s => s.ui)`). This is the correct Zustand pattern.

**Performance note (Minor M-3)**: Several components call the bare `useEditorStore()` (no selector) to destructure action functions:

```typescript
const { newProject, saveProject, setEditorLocale } = useEditorStore();
```

In Zustand 5, calling `useEditorStore()` without a selector subscribes the component to the full store and re-renders on any state change. Since action functions are stable references (they are created once in `create()`), the intent is to extract stable references — but the subscription is unnecessarily broad. Using `useEditorStore.getState()` or individual action selectors would avoid this.

### 4.5 `App.tsx` — WelcomeScreen Not Rendered — IMPORTANT

**Finding** (I-4): The design document specifies that `App.tsx` should route between `WelcomeScreen` (when `project` is null) and `MainLayout` (when `project` is loaded). The implementation's `App.tsx` always renders `<MainLayout />` and calls `loadDemoProject()` in a `useEffect`, bypassing the welcome screen entirely.

```typescript
export function App(): React.ReactElement {
  useEffect(() => {
    loadDemoProject();
  }, []);
  return <MainLayout />;
}
```

The welcome screen component (`WelcomeScreen.tsx`) is referenced in the design but not present in the implementation at all. `MainLayout` renders `ProjectTree` and `SceneCanvas`, both of which handle the null-project case gracefully (so no crash occurs), but the designed onboarding UX is absent.

**Assessment**: This is a meaningful UX gap — a first-time user sees an empty 3-panel layout instead of a clear call to action. The demo project auto-load masks this in development but will not be present in production builds.

**Recommendation**: Implement the `WelcomeScreen` component and restore the `project === null` routing logic in `App.tsx`. Remove or guard `loadDemoProject()` behind a development environment flag.

---

## 5. Security Review

### 5.1 `dangerouslySetInnerHTML` — PASS

No usage of `dangerouslySetInnerHTML` was found in any reviewed source file.

### 5.2 `iframe srcdoc` — PASS

The `PreviewPane` renders an `<iframe>` with `sandbox="allow-scripts allow-same-origin"`. The `srcdoc` attribute is not set in the reviewed code (the `usePreviewSync` hook that would set it is out of scope for this review). The sandbox attribute correctly restricts the iframe context.

**Note for future review**: When `usePreviewSync` is implemented and begins injecting content into the iframe via `srcdoc`, care must be taken to ensure the runtime script content is built from a trusted build artifact, not from user-supplied strings. The design's architecture (static IIFE + postMessage for data, never innerHTML) is the correct approach.

### 5.3 File Loading — PASS

The Toolbar's file-open handler parses JSON from user-selected files. The parsed data is cast via `as any` and passed to `loadProject`. There is no execution of file content as code. User-supplied strings from parsed JSON flow into the store as data only, with no rendering path that would interpret them as markup.

### 5.4 `window.confirm` / `alert` — MINOR

Multiple components use `window.confirm()` and `alert()` for delete confirmation and error display. This is not a security issue but is noted for UX reasons (see Minor M-4).

---

## 6. Test Coverage Review

### 6.1 `coordinate.ts` — 100% Coverage — PASS

The QA report confirms 20 tests covering all four exported functions (`canvasToScene`, `sceneToCanvas`, `clampToScene`, `computeScale`). Full coverage verified.

### 6.2 `editor-store.ts` — Core Actions Tested — PASS

The original 43 tests plus the 48 new tests in `editor-store-extra.test.ts` collectively cover all public store actions. The QA report explicitly lists every previously-untested action and confirms each now has tests.

### 6.3 `useCanvasDrag.ts` — Tested — PASS

13 tests covering: null initial state, startDrag no-op on null rect, drag state initialization, coordinate computation, pointer capture, `pointermove` delta calculation, `pointerup` reset, and mode forwarding.

### 6.4 Missing Tests — MINOR

The following components are acknowledged in the QA report as untested at unit level:
- `Toolbar.tsx` (browser file-picker API dependency noted as out of scope)
- `SceneCanvas.tsx` (not in QA report scope)
- `PropertiesPanel.tsx` (not in QA report scope)

These are acceptable for an MVP iteration but should be tracked for the next quality pass.

---

## 7. Design Deviation Summary

| Deviation | Nature | Severity |
|-----------|--------|----------|
| No `slices/` directory; single monolithic store | Architectural simplification | IMPORTANT |
| `loadProject` takes extra `words` parameter | Justified improvement | Neutral |
| Component directories renamed (`canvas/`, `tree/`) | Cosmetic rename | MINOR |
| Many planned components not yet implemented (WelcomeScreen, puzzle-designer, asset-library, etc.) | MVP scope reduction | Expected |
| `App.tsx` routes only to `MainLayout`, no WelcomeScreen | UX gap | IMPORTANT |
| Immer used standalone, not as Zustand middleware | Equivalent pattern | Neutral |
| SVG without `viewBox`; uses manual scaleX/scaleY | Alternative correct approach | MINOR |
| `usePreviewSync` not implemented | Scope deferral | Expected |
| `useHotspotDraw`, `useFileSystem`, `useExport` etc. not implemented | Scope deferral | Expected |

---

## 8. Findings Detail

### IMPORTANT Findings

**I-1: Monolithic store should be refactored into slices**
- File: `D:\claude_ws\GIEngine\packages\editor\src\store\editor-store.ts`
- The 865-line file combines 7 logical domains. The design explicitly specifies the slice pattern.
- Action: Refactor in next sprint. Create `src/store/slices/` with the 7 slice files per design §7.3.

**I-2: `loadProject` signature deviation is beneficial but undocumented**
- File: `D:\claude_ws\GIEngine\packages\editor\src\store\editor-store.ts:139`
- Design specifies `loadProject(definition, filePath?)`. Implementation is `loadProject(definition, words?, filePath?)`.
- Action: Update the design document to reflect this approved deviation.

**I-3: `useCanvasDrag` event listeners not cleaned up on component unmount mid-drag**
- File: `D:\claude_ws\GIEngine\packages\editor\src\hooks\useCanvasDrag.ts:113-114`
- Listeners added dynamically are only removed via `handleUp`. No unmount cleanup path exists.
- Action: Expose a cleanup mechanism or return a `useEffect` cleanup from the hook.

**I-4: `App.tsx` skips WelcomeScreen routing; demo project auto-loaded unconditionally**
- File: `D:\claude_ws\GIEngine\packages\editor\src\App.tsx`
- The designed `WelcomeScreen` onboarding path is absent. `loadDemoProject()` fires unconditionally on mount.
- Action: Implement `WelcomeScreen`, restore `project === null` routing, guard demo loading behind `import.meta.env.DEV`.

### MINOR Findings

**M-1: `HotspotOverlay` uses manual scaleX/scaleY instead of SVG viewBox**
- File: `D:\claude_ws\GIEngine\packages\editor\src\components\canvas\HotspotOverlay.tsx`
- The design specifies `viewBox="0 0 {width} {height}"` to avoid coordinate math. The current approach is correct but more coupled.

**M-2: `Toolbar.tsx` file-load uses `any` cast instead of Zod validation**
- File: `D:\claude_ws\GIEngine\packages\editor\src\components\layout\Toolbar.tsx:23`
- Malformed project files are not validated before being loaded into the store.

**M-3: Bare `useEditorStore()` calls subscribe to entire store**
- Files: `Toolbar.tsx:8`, `ProjectTree.tsx:50`, `ProjectTree.tsx:126`, `ProjectTree.tsx:211`
- `const { addAct } = useEditorStore()` subscribes the component to all state changes. Use `useEditorStore.getState().addAct` or individual action selectors.

**M-4: `window.confirm` and `alert` used for delete confirmation and error display**
- Files: `SceneCanvas.tsx:183`, `Toolbar.tsx:26`, `ProjectTree.tsx:95`, `ProjectTree.tsx:182`
- Browser dialogs block the main thread and are visually inconsistent. The design specifies `ConfirmDialog` (Radix `AlertDialog`) which is not yet implemented.

**M-5: `coordinate.ts` does not match design spec's `Math.round` behavior**
- File: `D:\claude_ws\GIEngine\packages\editor\src\utils\coordinate.ts`
- The design spec (§5.1) shows `Math.round()` applied in `canvasToScene`. The implementation returns floating-point values. Rounding is applied at call sites (e.g., `SceneCanvas.tsx:75-78`), which is functionally equivalent but inconsistent with the spec.

**M-6: `SceneCanvas` scale computation uses `clientWidth ?? 800` fallback before first render**
- File: `D:\claude_ws\GIEngine\packages\editor\src\components\canvas\SceneCanvas.tsx:86-87`
- `scaleX` and `scaleY` are computed outside a `useEffect` or `useLayoutEffect`, so `containerRef.current` may be null on the first render pass, causing a fallback to `800×450` defaults. These scale values are used for the `HotspotOverlay` rendering and the drawing preview overlay. On the first render the hotspot positions will be slightly incorrect until the ref is populated and a re-render occurs.

---

## 9. What Was Done Well

- The Zustand store is cleanly implemented with consistent immutable update patterns using Immer throughout.
- All CRUD actions correctly handle the "no project" guard (`if (!state.project) return state`), preventing null-pointer crashes.
- Selection cascade cleanup on deletion is correctly and completely implemented for all entity levels.
- The `LocalizedTextInput` component is well-designed: it handles both tabs correctly, produces a merged output on every change, and provides accessible warning indicators.
- `useCanvasDrag` correctly uses `PointerEvent`, `setPointerCapture`/`releasePointerCapture`, and produces the correct delta values. Mode forwarding is clean.
- `coordinate.ts` is well-documented with JSDoc and has 100% test coverage.
- All components handle null/empty states gracefully with informative messages rather than crashes.
- Security posture is good: no `dangerouslySetInnerHTML`, iframe uses sandbox, no code execution from user-provided content.
- The QA agent proactively identified and filled all coverage gaps, raising the test count from 63 to 140.

---

## 10. Approval Rationale

All four approval criteria are met:

1. **Zero CRITICAL findings** — confirmed.
2. **Zero security issues** — confirmed. No unsafe rendering, no code injection vectors in the reviewed scope.
3. **Core architecture matches design** — the fundamental data model (EditorStore, GameDefinition as single source of truth, Immer immutability, coordinate transformation, SVG overlay, PointerEvent drag) all match the design intent. The monolithic store is an architectural shortcut, not an architectural violation.
4. **Minor issues acceptable** — the six Minor findings are all quality improvements, not correctness defects. The four Important findings are tracked for the next sprint.

**APPROVED** — subject to Important findings I-3 and I-4 being addressed before any production release. I-1 (slice refactor) and I-2 (doc update) are sprint-backlog items.
