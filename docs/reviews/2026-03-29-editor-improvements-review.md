# Code Review: editor-improvements
**Date**: 2026-03-30
**Reviewer**: Senior Code Reviewer (Claude Sonnet 4.6)
**Design Document**: `docs/designs/2026-03-29-editor-improvements.md`
**QA Report**: `docs/qa/2026-03-29-editor-improvements-qa-report.md`

---

## Overall Verdict: APPROVED_WITH_NOTES

Zero CRITICAL findings. Zero security violations. One MAJOR finding (API key singleton stale-cache bug confirmed by QA but unresolved), three MINOR findings, and several NOTEs. The feature branch is safe to land after the MAJOR issue is addressed.

---

## Summary

All five feature areas align with the design document. Plan compliance is high: every specified file was created or modified, every named function and prop exists, and no unplanned scope creep was observed. The QA report correctly identified functional completeness; this review adds independent analysis of security, memory safety, correctness edge cases, and React best-practice compliance.

---

## Findings

### MAJOR

#### M-1 — GeminiClient singleton does not call `reset()` after key update
**File**: `packages/editor/src/components/ai/AISettings.tsx` lines 14–20; `packages/ai/src/client.ts` lines 31–36

`GeminiClient.getGenAI()` caches `_genAI` on first call using the API key read at that moment. Subsequent calls reuse the cached instance regardless of whether the key in `localStorage` has changed. `GeminiClient.reset()` exists precisely for this case (client.ts line 41–43) but `handleSave` in `AISettings.tsx` never invokes it.

Consequence: if a user enters a wrong key, calls `generateBackground`, gets an auth error, then enters the correct key and saves, the next generation attempt will still use the old (broken) `_genAI` instance. The only recovery path is a page reload.

`AISettings` cannot directly import `geminiClient` from `@gi-engine/ai` without breaking the dynamic-import isolation the design requires for the editor package. However, the same `new Function` pattern used in `AIBackgroundModal` could be applied in `handleSave` to call `geminiClient.reset()` after saving.

The design document does not specify this behavior, making this a gap between design intent ("instantiated on-demand") and the actual implementation.

---

### MINOR

#### m-1 — `FileReader` error path not handled in `SceneProperties`
**File**: `packages/editor/src/components/properties/SceneProperties.tsx` lines 31–53

`reader.onload` is set but `reader.onerror` is not. If the `FileReader` fails (e.g. file is locked, OS read error), the error is silently swallowed. The UI shows no feedback and the file input resets as if the user cancelled. The design document does not require error handling here, but the absence creates a confusing user experience and violates the error-handling principle "never suppress silently."

**Recommendation**: Add `reader.onerror = () => { /* set an error state and display it */ }` before the `reader.readAsDataURL(file)` call.

#### m-2 — `SceneCanvas.tsx`: `updateCanvasRect` dependency on `scene` causes `ResizeObserver` churn
**File**: `packages/editor/src/components/canvas/SceneCanvas.tsx` lines 46–61

`updateCanvasRect` is declared with `useCallback` and lists `scene` in its dependency array (line 54). `useLayoutEffect` also lists `updateCanvasRect` as a dependency (line 61). Every time `scene` changes (any hotspot move, any property edit), `updateCanvasRect` gets a new function reference, the `useLayoutEffect` re-runs, the old `ResizeObserver` is disconnected, and a new one is attached. This is functionally correct but creates unnecessary observer teardown/re-creation on every scene state change.

The `scene` reference is used only to call `computeScale`. The scale computation could instead be separated into a second `useLayoutEffect` that depends on `scene.dimensions` directly, leaving the observer-setup effect to depend only on the stable `containerRef`.

This is not a bug — the `ResizeObserver` is always properly disconnected in the cleanup — but it is a performance waste at higher hotspot-edit rates.

#### m-3 — `AIBackgroundModal`: backdrop click closes modal while generation is in progress
**File**: `packages/editor/src/components/ai/AIBackgroundModal.tsx` line 71

The backdrop `<div onClick={onClose}>` fires regardless of `isLoading`. If the user clicks the backdrop while Imagen is generating (which can take several seconds), the modal closes, but the in-flight `handleGenerate` async function continues executing. On resolution it calls `addAsset` and `updateScene` with `caseId`/`sceneId` that may no longer be valid (the user may have navigated to a different scene). The store mutations would silently apply to the wrong scene.

**Recommendation**: Change `onClick={onClose}` on the backdrop to `onClick={isLoading ? undefined : onClose}`, or guard the `addAsset`/`updateScene` calls at the end of `handleGenerate` with a mounted-ref check.

---

### NOTE

#### n-1 — `hotspot-drag.ts`: diagonal resize with both left and right edges (NE/NW/SE/SW) computes right-edge width before left-edge shift
**File**: `packages/editor/src/utils/hotspot-drag.ts` lines 54–79

For `resize-nw` the right-edge block does not run, only the left and top blocks execute. For `resize-ne` only the right and top blocks execute. The computation order is correct for all diagonal modes as currently written; however the comment at line 47 ("compute candidate new corners") does not note that the right-edge `newW` and left-edge `newW` are calculated using distinct `newX` values (the right block uses the unchanged `newX`; the left block modifies `newX` first, then recalculates `newW`). This is correct but subtle. A brief inline note would aid future maintainers.

#### n-2 — `HotspotOverlay.tsx`: resize handle uses array index as React key
**File**: `packages/editor/src/components/canvas/HotspotOverlay.tsx` line 79

`key={i}` is used for the 8 resize handle `<rect>` elements. Since the array is statically ordered and never reordered, this is functionally safe. A more explicit key like `key={cursor}` (which is unique per handle) would be semantically cleaner and make intent clearer.

#### n-3 — `client.ts`: `@ts-expect-error` justification is accurate but the `any` cast on line 75 could be narrowed
**File**: `packages/ai/src/client.ts` lines 65–75

The two `@ts-expect-error` comments on lines 65 and 67 are properly justified (Imagen API is not in the TypeScript types for `@google/generative-ai`). The `as any` cast on line 75 to access `result.images[0].imageBytes` is necessary given the same typing gap, and is protected by the `if (!imageBytes)` guard on line 76–78 immediately after. This is acceptable. The `eslint-disable` comment on line 74 is appropriate. No action required; noted for completeness.

#### n-4 — `background-generator.ts`: `size` field omitted from generated asset
**File**: `packages/ai/src/generators/background-generator.ts` lines 19–28

The returned `AssetDefinition` does not include a `size` field. `SceneProperties.tsx` manually passes `size: file.size` for user-uploaded assets (line 45). If `AssetDefinition.size` is a required field in `@gi-engine/core`, the AI-generated asset will fail a type check. The QA report (observation 2) flags this same issue. It is mitigated in the modal by the dynamic import pattern that bypasses compile-time type checking, but it could cause a runtime issue if downstream code reads `asset.size` and expects a number. This should be tracked to resolution.

#### n-5 — Test file TypeScript errors (pre-existing, not introduced by this feature)
**Files**: `tests/editor-store-extra.test.ts`, `tests/useCanvasDrag.test.ts`

Six TypeScript errors exist in test files. QA confirmed these are pre-existing and unrelated to this feature's production code. They are carried forward here as a NOTE to ensure they are not forgotten. They should be resolved in a dedicated cleanup pass.

---

## Plan Compliance

| Design Requirement | Implemented | Notes |
|---|---|---|
| `hotspot-drag.ts` pure function `applyDragToArea` | Yes | Matches spec |
| All 8 resize modes + move mode | Yes | |
| `HotspotOverlay` `onResizeHandlePointerDown` prop | Yes | |
| `SceneCanvas` uses `getBoundingClientRect` not `clientWidth` | Yes | Bug fixed |
| `SceneCanvas` `useLayoutEffect` + `ResizeObserver` | Yes | Minor perf note (m-2) |
| `SceneCanvas` `effectiveHotspots` live preview | Yes | |
| `ProjectTree` inline editing all three node types | Yes | |
| `useEffect` focus + select on edit entry | Yes | |
| Enter/Escape/blur commit/cancel | Yes | |
| Empty name guard | Yes | |
| `SceneProperties` new file | Yes | |
| FileReader DataURL path | Yes | Missing onerror (m-1) |
| `PropertiesPanel` uses `SceneProperties` | Yes | |
| `packages/ai` package structure | Yes | All files present |
| API key in `localStorage` only, never logged | Yes | |
| `GeminiClient` lazy instantiation | Yes | |
| `GeminiClient.reset()` defined | Yes | Not called on key update (M-1) |
| `AISettings` password input, save/clear | Yes | |
| `AISettings` calls `reset()` after save | No | M-1 |
| `AIBackgroundModal` dynamic import | Yes | |
| Modal backdrop blocks during load | No | m-3 |

---

## Security Assessment

**API key exposure**: The API key is stored only in `localStorage` under `'gi_engine_gemini_api_key'`. It is never logged, never serialized into project files, and never included in any network request except the direct `@google/generative-ai` SDK call. The `type="password"` input prevents shoulder-surfing. No XSS vectors for the key were found.

**XSS via image data**: Base64 image data is rendered exclusively via `src={`data:${mimeType};base64,${data}`}` on `<img>` elements or as a CSS background on a container `<div>`. Neither path creates a script execution vector.

**User file input**: `handleFileChange` reads only the result of `FileReader.readAsDataURL`, which produces a data URL. The mime type is extracted from the data URL prefix, not from `file.type` (which could be spoofed), and is not used in any eval or dynamic script context. The base64 payload is stored as a string. No injection risk.

**`new Function` in AIBackgroundModal**: `new Function('s', 'return import(s)')` called with the string literal `'@gi-engine/ai'` (line 45) is not a user-controlled input. This is a known pattern for bypassing static analysis of dynamic imports and does not introduce an XSS vector here because the module specifier is hardcoded.

**Overall**: No security issues found.

---

## Memory Safety Assessment

**ResizeObserver cleanup**: `SceneCanvas.tsx` line 60 correctly calls `observer.disconnect()` in the `useLayoutEffect` cleanup function. No leak.

**Drag refs**: `dragHotspotIdRef` is set to `null` in both `onDragEnd` (line 91) and the early-exit path (line 82). No dangling ref.

**FileReader**: `FileReader` instances in `SceneProperties.handleFileChange` are created on the stack inside the event handler. They are referenced by the closure (`reader.onload`) but are naturally garbage-collected after the `onload` fires. No persistent reference is held. No leak.

**AIBackgroundModal async closure**: As noted in m-3, the `handleGenerate` closure captures `addAsset`, `updateScene`, `caseId`, and `sceneId` at call time. These remain alive for the duration of the in-flight request. The values themselves are not leaked; only the functional concern about potential wrong-scene mutation applies.

**Overall**: No memory leaks found.

---

## Resolution Requirements Before Merge

| Finding | Severity | Required? |
|---|---|---|
| M-1: `geminiClient.reset()` not called after key save | MAJOR | Yes — fix before merge |
| m-1: `FileReader.onerror` missing | MINOR | Recommended |
| m-2: `ResizeObserver` churn | MINOR | Optional — track as tech debt |
| m-3: Backdrop closes modal during load | MINOR | Recommended |
| n-1 through n-5 | NOTE | No action required for merge |
