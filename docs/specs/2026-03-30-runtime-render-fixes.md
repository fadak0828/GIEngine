# Spec: Runtime Render Fixes — Background, Word Display, Drag-Drop

**Date**: 2026-03-30
**Status**: Ready for Implementation
**Priority**: High
**Design Reference**: docs/designs/2026-03-30-runtime-fix-and-export.md

---

## Summary

Three bugs in the exported game runtime, diagnosed by tracing each symptom to its root cause in the current source code.

| # | Symptom | File(s) | Root Cause |
|---|---------|---------|-----------|
| 1 | Background images blank in exported HTML | `browser-export.ts`, `scene-renderer.ts` | Assets not inlined as base64 before export; relative `src` paths break in standalone HTML |
| 2 | Word bank shows raw IDs (e.g., `word-secretary-kim`) | `renderer.ts` `collectWordsForCase` | Word lookup only scans current case scenes; cross-case collected words are not found in the word map |
| 3 | Drag-drop from word bank to puzzle slot does nothing | `drag-drop-manager.ts`, `renderer.ts` | `ASSIGN_WORD` dispatch triggers a re-render but `renderThinking` skips re-mounting; `DragDropManager` does not call `updateSlotContent`/`updateWordBankItem` directly |

---

## Bug 1: Background Image Blank in Exported HTML

### Root Cause

`browserExport()` in `packages/exporter/src/browser-export.ts` serializes the `GameDefinition` to JSON as-is. The `game.json` asset entries have `src: "assets/backgrounds/living-room.png"` with no `inline` field:

```json
"bg-living-room": {
  "id": "bg-living-room",
  "type": "image",
  "src": "assets/backgrounds/living-room.png",
  "mimeType": "image/png"
}
```

When the exported HTML is opened as a standalone file, the `<img>` element in `scene-renderer.ts` `resolveAssetSrc()` returns `asset.src` (the relative path). That relative path is resolved against the HTML file's location, where no `assets/` directory exists — resulting in a 404 and a blank image.

`asset-inliner.ts` (`inlineAssets()`) exists and converts `src` paths to base64 data URIs, but it uses `node:fs/promises` and cannot run in the browser. `browserExport()` never calls it.

### Trace

```
browserExport()
  → JSON.stringify(gameDefinition)          ← assets have src only, no inline
  → assembleHtml({ gameData: gameDataJson })
  → <script type="application/json"> embeds asset entries with src paths

Exported HTML opens in browser:
  engine.__giEngineBoot__(root, gameData)
  → GIEngine constructor → this.definition.assets = { items: { "bg-living-room": { src: "assets/backgrounds/..." } } }
  → SceneRenderer.render()
  → resolveAssetSrc("bg-living-room")
  → asset = assets.items["bg-living-room"]  ← found, has src, no inline
  → return asset.src                         ← "assets/backgrounds/living-room.png"
  → <img src="assets/backgrounds/living-room.png"> ← 404 in standalone HTML
```

### Fix

**File**: `packages/exporter/src/browser-export.ts`

Before calling `assembleHtml`, traverse `gameDefinition.assets.items` and for each asset that has `src` but no `inline`, attempt to fetch it and convert to a base64 data URI. Return a new `GameDefinition` with the inlined assets manifest.

Because `browserExport` runs in the browser (no `node:fs`), use `fetch()` to load assets relative to the current page URL (editor origin). This requires the editor to serve the game's asset files statically.

Add a new helper function `inlineAssetsForBrowser` inside `browser-export.ts`:

```ts
async function inlineAssetsForBrowser(
  manifest: AssetManifest,
  baseUrl: string
): Promise<AssetManifest> {
  const inlinedItems: Record<string, AssetDefinition> = {};

  for (const [id, asset] of Object.entries(manifest.items)) {
    if (asset.inline) {
      // Already inlined — keep as-is
      inlinedItems[id] = asset;
      continue;
    }
    if (!asset.src) {
      inlinedItems[id] = asset;
      continue;
    }
    try {
      const url = new URL(asset.src, baseUrl).href;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const mimeType = asset.mimeType || response.headers.get('content-type') || 'application/octet-stream';
      inlinedItems[id] = {
        ...asset,
        inline: `data:${mimeType};base64,${base64}`,
        size: buffer.byteLength,
      };
    } catch (err) {
      console.warn(`[browserExport] Could not inline asset "${id}": ${err}. Using src path.`);
      inlinedItems[id] = asset;
    }
  }

  return { items: inlinedItems };
}
```

Change `browserExport` to be `async` and add the inlining step:

```ts
export async function browserExport(options: BrowserExportOptions): Promise<BrowserExportResult> {
  const { gameDefinition, mode } = options;

  // Inline all assets as base64 before serializing
  const baseUrl = window.location.href;
  const inlinedManifest = await inlineAssetsForBrowser(gameDefinition.assets, baseUrl);
  const exportDef: GameDefinition = {
    ...gameDefinition,
    assets: inlinedManifest,
  };

  // 1. Serialize game data with inlined assets
  const gameDataJson = JSON.stringify(exportDef, null, mode === 'development' ? 2 : undefined);

  // ... rest unchanged ...
}
```

**Callers that must be updated**: Any caller of `browserExport` in the editor must `await` the result since it is now async.

**Fallback behavior**: If `fetch()` fails for an asset (network error, CORS, 404), the asset entry is kept with its original `src` path. A `console.warn` is emitted. The exported HTML may still have broken images for that asset, but the export does not fail.

**Edge case — already-inlined assets**: If an asset already has `inline` set (e.g., from a previous inlining pass), `inlineAssetsForBrowser` skips it and keeps the data URI. No redundant fetch.

**Edge case — audio/font assets**: Same logic applies. Audio and font assets with relative `src` paths are also base64-inlined. This prevents broken audio in the exported HTML.

---

## Bug 2: Word Bank Displays Raw IDs Instead of Display Names

### Root Cause

`collectWordsForCase()` in `packages/runtime/src/renderer/renderer.ts` builds its word map by scanning only the **current case's** scene hotspot actions for `word_reveal` entries:

```ts
private collectWordsForCase(def, caseId, caseState): Word[] {
  const caseData = findCase(def, caseId);
  const wordMap = new Map<string, Word>();

  for (const scene of caseData.scenes) {              // ← only current case
    for (const hotspot of scene.hotspots) {
      this.extractWordsFromAction(hotspot.action, def, caseId, wordMap);
    }
  }

  return caseState.collectedWordIds
    .map(id => wordMap.get(id))                       // ← undefined if word from other case
    .filter((w): w is Word => w !== undefined);
}
```

When a player collects `word-secretary-kim` in case 1 and then opens the puzzle in case 3, `caseState.collectedWordIds` for case 3 includes `word-secretary-kim` (because it was saved to case 1's state but the puzzle references it cross-case, or because `collectedWordIds` are accumulated per-case). Even within a single case, if the puzzle's slot shows an `assignedWordId`, `createSlot` in `deduction-renderer.ts` looks up the word from `collectedWords`:

```ts
const word = words.find(w => w.id === assignedWordId);
el.textContent = word ? this.i18n.resolveText(word.display) : assignedWordId;
//                                                             ↑ raw ID fallback
```

If `collectWordsForCase` fails to populate `wordMap` for a word ID — either because that word was collected in a different case whose scenes aren't being scanned, or because the word has no `word_reveal` hotspot in the current case (only in `def.words`) — the `words.find()` returns `undefined` and the raw ID is displayed.

The same issue affects `renderWordBank`: if `collectWordsForCase` returns an empty or incomplete array, the word bank renders no items or shows partial words.

### Trace

```
renderer.renderThinking()
  → collectWordsForCase(def, "case-3", caseState)
  → caseData = case-3 scenes
  → wordMap built from case-3 scene hotspots only
  → wordMap does NOT contain "word-secretary-kim" (collected in case-1)
  → caseState.collectedWordIds = ["word-secretary-kim", "word-knife", ...]
  → words = ["word-knife", ...]  ← word-secretary-kim filtered out

deductionRenderer.render(puzzle, puzzleState, words, assignedWordIds)
  → createSlot(segment, puzzleState, words)
  → assignedWordId = "word-secretary-kim"
  → word = words.find(w => w.id === "word-secretary-kim")  ← undefined
  → el.textContent = "word-secretary-kim"  ← raw ID shown
```

### Fix

**File**: `packages/runtime/src/renderer/renderer.ts`, `collectWordsForCase` method

Replace the scene-scanning approach with a direct `def.words` lookup for all collected word IDs. Fall back to scene-scanning only for words not in `def.words` (backward compatibility):

```ts
private collectWordsForCase(
  def: GameDefinition,
  caseId: string,
  caseState: CaseState
): Word[] {
  const results: Word[] = [];

  for (const wordId of caseState.collectedWordIds) {
    // Primary: look up word definition from the global words dictionary
    const wordDef = def.words?.[wordId];
    if (wordDef) {
      results.push({
        id: wordId,
        display: wordDef.display,
        category: wordDef.category,
        hint: wordDef.hint,
        caseId,
      });
      continue;
    }

    // Fallback: scan all scenes in this case for word_reveal actions
    const caseData = findCase(def, caseId);
    if (caseData) {
      const wordMap = new Map<string, Word>();
      for (const scene of caseData.scenes) {
        for (const hotspot of scene.hotspots) {
          this.extractWordsFromAction(hotspot.action, def, caseId, wordMap);
        }
      }
      const found = wordMap.get(wordId);
      if (found) {
        results.push(found);
        continue;
      }
    }

    // Last resort: use ID as display label and emit warning
    console.warn(`[GIEngine] No word definition found for collected word: "${wordId}"`);
    results.push({
      id: wordId,
      display: { ko: wordId, en: wordId },
      caseId,
    });
  }

  return results;
}
```

Note: `extractWordsFromAction` is kept for the fallback path and for backward compatibility with game definitions that do not have a top-level `words` dictionary. The primary path (`def.words?.[wordId]`) short-circuits immediately for all words that have definitions, which covers the tutorial game's entire word set.

**Effect on `renderWordBank`**: Since `collectWordsForCase` now always returns a `Word` for every collected word ID, the word bank will always show all collected words with their display names.

**Effect on `createSlot`**: The `words.find(w => w.id === assignedWordId)` lookup in `deduction-renderer.ts` will always find the word in `collectedWords`, so the slot will always show the display name.

---

## Bug 3: Drag-Drop Drops Are Silently Ignored

### Root Cause

There are two independent causes that together prevent visual slot updates after a drag-drop:

**Cause A — `renderThinking` skips re-render on `editing` sub-state:**

`renderer.ts` `renderThinking()` uses a `currentView` guard to avoid re-mounting the deduction UI on every state update:

```ts
if (this.currentView !== `thinking:${state.puzzleId}`) {
  // Full re-render: mount deduction UI
  this.deductionRenderer.render(puzzle, puzzleState, caseWords, assignedWordIds);
  this.currentView = `thinking:${state.puzzleId}`;
}

// Sub-state handling
if (state.sub.type === 'showing_result') {
  this.deductionRenderer.showValidationResults(state.sub.results);
}
// No handler for sub.type === 'editing'
```

After `ASSIGN_WORD` is dispatched, `handleThinking` returns `nextState: { ...state, sub: { type: 'editing' } }`. The re-render loop calls `renderThinking`, which finds `currentView === 'thinking:puzzleId'` (unchanged) and skips the full re-render. The `state.sub.type === 'editing'` has no special case in the sub-state handler. Nothing updates the DOM.

**Cause B — `DragDropManager` does not call direct update methods:**

The design document (section G.4) states that `DragDropManager` should call `deductionRenderer.updateSlotContent()` and `updateWordBankItem()` directly for immediate visual feedback. However, `drag-drop-manager.ts` `onPointerUp()` only dispatches:

```ts
this.dispatch({ type: 'ASSIGN_WORD', slotId: targetSlotId, wordId });
// No direct call to updateSlotContent or updateWordBankItem
```

The `ASSIGN_WORD` dispatch updates the state machine but the visual slot update never happens because of Cause A.

The result: the state machine updates correctly (slot assignment is saved), but the slot element remains visually empty/unchanged. The word bank item is not marked assigned. The user sees no feedback that the drop succeeded.

### Trace

```
User drags word-knife → drops on slot-weapon

DragDropManager.onPointerUp()
  → ghost.remove()
  → targetSlotId = "slot-weapon"
  → dispatch({ type: 'ASSIGN_WORD', slotId: 'slot-weapon', wordId: 'word-knife' })
    → handleThinking() → slotAssignments['slot-weapon'] = 'word-knife'
    → nextState.sub = { type: 'editing' }
    → render() called
      → renderThinking()
        → currentView === 'thinking:puzzle-main' ← SKIP full re-render
        → state.sub.type === 'editing' ← no case handled
        → no DOM update
  ← dispatch returns

DOM: slot-weapon still shows placeholder text "___"
DOM: word-knife still shows as unassigned (no gi-word--assigned class)
```

### Fix

**Primary fix — File**: `packages/runtime/src/renderer/renderer.ts`, `renderThinking` method

Add explicit update calls for the `editing` sub-state after a slot assignment changes. Track the previous `slotAssignments` to detect what changed:

Add a private field to `Renderer`:
```ts
private lastSlotAssignments: Record<string, string | null> = {};
private lastCollectedWordIds: string[] = [];
```

In `renderThinking`, after the `currentView` guard (i.e., for repeat visits to the same puzzle), add incremental update logic:

```ts
if (this.currentView !== `thinking:${state.puzzleId}`) {
  this.clearView([]);
  this.removeControls();
  this.currentView = `thinking:${state.puzzleId}`;
  this.lastSlotAssignments = { ...puzzleState.slotAssignments };

  if ('template' in puzzle) {
    this.deductionRenderer.render(puzzle as Puzzle, puzzleState, caseWords, assignedWordIds);
  }
} else {
  // Incremental update: sync slot elements and word bank items
  for (const [slotId, wordId] of Object.entries(puzzleState.slotAssignments)) {
    if (this.lastSlotAssignments[slotId] !== wordId) {
      this.deductionRenderer.updateSlotContent(slotId, wordId, caseWords);
      this.lastSlotAssignments[slotId] = wordId;
    }
  }
  // Sync word bank assigned state
  for (const word of caseWords) {
    const isAssigned = assignedWordIds.has(word.id);
    this.deductionRenderer.updateWordBankItem(word.id, isAssigned);
  }
}

// Sub-state handling
if (state.sub.type === 'showing_result') {
  this.deductionRenderer.showValidationResults(state.sub.results);
}
```

This ensures that when `ASSIGN_WORD` or `UNASSIGN_WORD` triggers a re-render, the changed slots are updated incrementally without re-mounting the entire deduction UI.

**Secondary fix — reset `lastSlotAssignments` on view change:**

In `clearView()` or wherever `currentView` is reset, also reset `this.lastSlotAssignments = {}` to avoid stale diff state when opening a new puzzle.

```ts
private clearView(except: string[]): void {
  if (!except.includes('scene')) this.sceneRenderer.destroy();
  if (!except.includes('deduction')) this.deductionRenderer.destroy();
  if (!except.includes('caseSelect')) this.caseSelectRenderer.destroy();
  if (!except.includes('popup')) this.popupRenderer.dismiss();
  this.removeCompletion();
  this.removeLoading();
  this.lastSlotAssignments = {};  // ← add this line
  this.lastCollectedWordIds = []; // ← add this line
}
```

---

## Files to Change

| # | File | Change Type | Description |
|---|------|-------------|-------------|
| 1 | `packages/exporter/src/browser-export.ts` | Modify | Add `inlineAssetsForBrowser()` async helper; change `browserExport` to `async`; call inlining before serialization |
| 2 | `packages/runtime/src/renderer/renderer.ts` | Modify | Rewrite `collectWordsForCase` to use `def.words` dictionary as primary source; add incremental update logic in `renderThinking`; add `lastSlotAssignments` field; reset in `clearView` |

---

## Acceptance Criteria

### Bug 1: Background Image

- AC1.1: When a game is exported from the editor and the resulting HTML file is opened directly in a browser (file:// or served from any origin with no `assets/` directory), scene background images render correctly.
- AC1.2: Layer images also render correctly (same inlining path via `resolveAssetSrc`).
- AC1.3: Export fails gracefully if an asset file cannot be fetched — a `console.warn` is emitted and the asset src path is kept; the rest of the export completes.
- AC1.4: If a `GameDefinition` has all assets already inlined (inline field set), the export result is identical to the non-async path — no redundant fetch calls.

### Bug 2: Word Display Names

- AC2.1: After collecting words in any scene and opening the puzzle, all collected word IDs appear in the word bank with their human-readable display names (Korean or English per locale), not raw IDs like `word-secretary-kim`.
- AC2.2: Filled puzzle slots show the display name of the assigned word.
- AC2.3: Empty slots show their placeholder text (not a raw ID).
- AC2.4: Words collected in a different case (cross-case word reuse) are still resolved correctly from `def.words`.
- AC2.5: If `def.words` is absent (older game format), the existing scene-scan fallback is used and a `console.warn` is emitted.

### Bug 3: Drag-Drop

- AC3.1: After dragging a word from the word bank and dropping it on an empty puzzle slot, the slot immediately shows the word's display name.
- AC3.2: After a successful drop, the word in the word bank is visually marked as assigned (dimmed/strikethrough via `gi-word--assigned` class).
- AC3.3: Dragging a word from a filled slot to another empty slot: the source slot returns to its empty/placeholder state and the target slot fills with the word.
- AC3.4: Dropping a word from a filled slot onto an empty area of the screen unassigns the word from that slot; the slot returns to placeholder state.
- AC3.5: Dropping a word onto its own slot (no movement) does not change state or produce errors.
- AC3.6: After a drop, dispatching `VALIDATE_PUZZLE` evaluates the current assignments including the just-dropped word.

---

## Implementation Notes

### Bug 1 — async export call chain

The editor's export button handler must be updated to `await` the result. Example in the editor's export action:

```ts
// Before:
const result = browserExport({ gameDefinition, mode: 'production' });

// After:
const result = await browserExport({ gameDefinition, mode: 'production' });
```

If the editor uses a synchronous export pipeline, a loading state should be shown while assets are fetched.

### Bug 1 — base64 encoding in browser

`btoa()` is used for base64 encoding. For binary data, the `Uint8Array` → `String.fromCharCode` loop is required to avoid corrupted base64 for non-ASCII bytes. `TextDecoder` and `atob`/`btoa` on raw binary do not reliably handle bytes above 127.

An alternative using `FileReader`:
```ts
const blob = new Blob([buffer], { type: mimeType });
const dataUrl = await new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});
```
Either implementation is acceptable. The `FileReader` approach is simpler and handles all MIME types correctly.

### Bug 2 — no changes to `deduction-renderer.ts`

The `updateSlotContent` and `renderWordBank` methods in `deduction-renderer.ts` are already correct. The only fix needed is in `collectWordsForCase` in `renderer.ts`.

### Bug 3 — `lastSlotAssignments` initialization

`lastSlotAssignments` must be initialized to `{}` in the `Renderer` constructor (not undefined). This ensures the incremental diff in `renderThinking` works correctly on first entry to a puzzle.

### Bug 3 — `updateSlotContent` requires `caseWords`

The `updateSlotContent(slotId, wordId, words)` method in `deduction-renderer.ts` line 138 requires the `words` array to look up display text. Pass the same `caseWords` array from `renderThinking`. Since `caseWords` is already computed in `renderThinking`, this does not require an additional collection step.

### Bug 3 — no changes to `drag-drop-manager.ts`

The drag-drop manager's event dispatch approach is correct. The fix is entirely in `renderer.ts`'s handling of the resulting `editing` sub-state. The direct call approach (`updateSlotContent` in the manager) was described in the design doc but was not implemented; the renderer-side incremental update is the cleaner solution since it keeps DOM mutation inside the renderer.

---

## Non-Goals

- This spec does not cover audio asset inlining verification (same code path as images, should work automatically).
- This spec does not address the `UNASSIGN_WORD` visual update — it follows the same pattern as `ASSIGN_WORD` and will be fixed by the same `renderThinking` incremental update logic (the diff loop iterates all slot assignments, so a null-set slot is also detected).
- This spec does not address sub-puzzle word display (CharacterIdPuzzle, etc.) — those use separate renderers not yet implemented.
- Touch/mobile drag-drop is covered by the existing PointerEvent implementation and does not require separate fixes.
