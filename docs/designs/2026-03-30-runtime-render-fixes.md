# Design: Runtime Render Fixes — Background, Word Display, Drag-Drop

**Date**: 2026-03-30
**Status**: Ready for Implementation
**Spec Reference**: docs/specs/2026-03-30-runtime-render-fixes.md
**Priority**: High

---

## Overview

Three independent runtime bugs are fixed in this design. Each fix is fully self-contained in one or two files. The design records exact code changes, invariants preserved, edge cases handled, and the final file implementation order.

| # | Bug | Root Cause (confirmed by code read) | Fix Location |
|---|-----|--------------------------------------|--------------|
| 1 | Background images blank in exported HTML | `browserExport()` serializes asset entries with relative `src` paths; standalone HTML has no `assets/` directory; `resolveAssetSrc()` returns the bare `src` string | `packages/exporter/src/browser-export.ts` + `packages/editor/src/components/export/ExportModal.tsx` |
| 2 | Word bank shows raw IDs | `collectWordsForCase()` scans only current-case scene hotspots; words collected in other cases or defined only in `def.words` are not in the scene-built map | `packages/runtime/src/renderer/renderer.ts` |
| 3 | Drag-drop drops produce no DOM update | `renderThinking()` skips re-render when `currentView` is already set; no handler exists for `sub.type === 'editing'`; `deductionRenderer.updateSlotContent` / `updateWordBankItem` are never called | `packages/runtime/src/renderer/renderer.ts` |

---

## Confirmed Code Analysis

### Bug 1 — `browser-export.ts` line 37–90

`browserExport` is a **synchronous** function. It calls `JSON.stringify(gameDefinition)` directly at line 41–45 with no asset inlining. The `assembleHtml` call at line 55 embeds the raw JSON (including asset entries that have only `src: "assets/backgrounds/..."`) into a `<script>` tag.

In `scene-renderer.ts` line 222–227, `resolveAssetSrc()` checks `asset.inline` first, then falls back to `asset.src`. Because `inline` is never set during browser export, the exported HTML always uses the relative `src` path, which resolves to nothing in a standalone file.

`asset-inliner.ts` (Node.js path, uses `node:fs/promises`) exists but is never called by `browserExport`.

`ExportModal.tsx` line 54: `exporterModule.browserExport(...)` is called **without** `await`, consistent with the current synchronous signature. This line must be updated to `await`.

### Bug 2 — `renderer.ts` lines 443–468

`collectWordsForCase()` builds a `wordMap` by calling `extractWordsFromAction()` (lines 470–500) over scenes in the current case only (`extractWords(caseData.scenes)`). The result map is then used at line 465 to look up each `collectedWordId`.

`extractWordsFromAction()` already performs `def.words?.[wordId]` lookup (line 479) — it does have access to the global words dictionary — but the issue is that `extractWordsFromAction` is only called for hotspot actions in the *current case's scenes*. If a word was collected in a different case and its `word_reveal` hotspot is in that other case's scenes (not the current case), the map has no entry for it, and the `map(id => wordMap.get(id))` call at line 466 returns `undefined`, which is then filtered out.

The fix: bypass scene scanning entirely for words that exist in `def.words`. The `extractWordsFromAction` already knows how to build a `Word` from `def.words`; we replicate that logic directly in `collectWordsForCase` as the primary lookup path.

### Bug 3 — `renderer.ts` lines 260–278

The `renderThinking()` guard at line 260:

```ts
if (this.currentView !== `thinking:${state.puzzleId}`) {
  // full render — only runs once per puzzle
  this.deductionRenderer.render(...);
  this.currentView = `thinking:${state.puzzleId}`;
}
// sub-state handling
if (state.sub.type === 'showing_result') {
  this.deductionRenderer.showValidationResults(...);
}
```

After `ASSIGN_WORD` → `transition()` → `nextState.sub = { type: 'editing' }` → `render()` → `renderThinking()`: the `currentView` guard is true (puzzle ID unchanged), the `if` block is skipped, and the `editing` sub-state has no handler. The DOM is never updated.

`deductionRenderer.updateSlotContent()` (line 138 of `deduction-renderer.ts`) and `updateWordBankItem()` (line 160) are fully implemented and work via `slotElements` / `wordElements` Maps. The infrastructure exists; it just needs to be called.

`DragDropManager` does receive a `getDeductionRenderer` callback (engine.ts line 148) and could call update methods directly, but the spec and notes confirm the fix belongs in `renderer.ts` — the renderer-side diff is cleaner since it keeps all DOM mutation inside the renderer layer.

---

## Bug 1 Design: `inlineAssetsForBrowser` in `browser-export.ts`

### New Helper Function

Insert before the `browserExport` export function.

```ts
/**
 * Fetches each asset with a relative src path and converts it to a base64 data URI.
 * Uses fetch() + FileReader — both browser-native, no Node.js APIs.
 * Returns a new AssetManifest; the original is not mutated.
 *
 * @param manifest  The asset manifest from the GameDefinition.
 * @param baseUrl   Base URL for resolving relative src paths (window.location.href).
 */
async function inlineAssetsForBrowser(
  manifest: AssetManifest,
  baseUrl: string
): Promise<AssetManifest> {
  const inlinedItems: Record<string, AssetDefinition> = {};

  for (const [id, asset] of Object.entries(manifest.items)) {
    // Already inlined — keep as-is (no redundant fetch)
    if (asset.inline) {
      inlinedItems[id] = asset;
      continue;
    }
    // No src (unusual edge case) — keep as-is
    if (!asset.src) {
      inlinedItems[id] = asset;
      continue;
    }
    // Already a data URI — keep as-is
    if (asset.src.startsWith('data:')) {
      inlinedItems[id] = asset;
      continue;
    }

    try {
      const url = new URL(asset.src, baseUrl).href;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const mimeType =
        asset.mimeType ||
        response.headers.get('content-type')?.split(';')[0].trim() ||
        'application/octet-stream';

      // Use FileReader for reliable binary → base64 conversion (handles all byte values)
      const blob = new Blob([buffer], { type: mimeType });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      inlinedItems[id] = {
        ...asset,
        inline: dataUrl,
        size: buffer.byteLength,
      };
    } catch (err) {
      // Graceful degradation: warn and keep original src
      console.warn(
        `[browserExport] Could not inline asset "${id}" (src: "${asset.src}"): ${err}. Using src path.`
      );
      inlinedItems[id] = asset;
    }
  }

  return { items: inlinedItems };
}
```

### Updated `browserExport` Function

Change signature from `function browserExport(...)` to `async function browserExport(...)`. Add inlining call before JSON serialization. Update size breakdown to use the inlined manifest.

```ts
export async function browserExport(options: BrowserExportOptions): Promise<BrowserExportResult> {
  const { gameDefinition, mode } = options;

  // 0. Inline all assets as base64 data URIs (browser fetch, no Node.js)
  const baseUrl = window.location.href;
  const inlinedManifest = await inlineAssetsForBrowser(gameDefinition.assets, baseUrl);
  const exportDef: GameDefinition = {
    ...gameDefinition,
    assets: inlinedManifest,
  };

  // 1. Serialize game data with inlined assets
  const gameDataJson = JSON.stringify(
    exportDef,
    null,
    mode === 'development' ? 2 : undefined,
  );

  // 2. Determine title and lang
  const title =
    exportDef.title?.ko ??
    exportDef.title?.en ??
    'GIEngine Game';
  const lang = exportDef.supportedLocales?.[0] ?? 'ko';

  // 3. Assemble HTML
  const html = assembleHtml({
    title,
    css: runtimeCss,
    js: runtimeJs,
    gameData: gameDataJson,
    lang,
  });

  // 4. Compute sizes
  const jsSize = byteLength(runtimeJs);
  const cssSize = byteLength(runtimeCss);
  const totalSize = byteLength(html);

  const assetsSize = Object.values(inlinedManifest.items).reduce(
    (sum, asset) => sum + (asset.inline ? byteLength(asset.inline) : 0),
    0,
  );
  const dataSize = Math.max(0, byteLength(gameDataJson) - assetsSize);

  const fileName = `${exportDef.id ?? 'game'}.html`;

  return {
    html,
    fileName,
    totalSize,
    breakdown: { js: jsSize, css: cssSize, assets: assetsSize, data: dataSize },
  };
}
```

### Key Design Decisions

- **FileReader over btoa loop**: The spec allows either approach. FileReader is chosen because it is the idiomatic browser API for blob-to-data-URI conversion and handles all MIME types and byte values without manual binary string construction.
- **Deep copy via spread**: `{ ...gameDefinition, assets: inlinedManifest }` creates a shallow copy of the definition with a new assets manifest. The original `gameDefinition` object is never mutated — important because the editor holds a live reference to it.
- **`data:` URI skip guard**: Prevents double-encoding if `asset.src` was somehow already a data URI (e.g., an in-memory test fixture).
- **Size breakdown uses `inlinedManifest`**: The original `browserExport` computed `assetsSize` from `gameDefinition.assets`, which would be 0 before inlining. After the fix, it correctly reflects inlined sizes.
- **`window.location.href` as base URL**: The editor is a web app; `window.location.href` gives the correct origin for resolving relative asset paths like `assets/backgrounds/living-room.png`.

### Required Import: `AssetManifest` and `AssetDefinition`

`AssetManifest` is already imported transitively via `GameDefinition` from `@gi-engine/core`. `AssetDefinition` needs to be added to the import if not already present. Check and add if needed:

```ts
import type { GameDefinition, AssetManifest, AssetDefinition } from '@gi-engine/core';
```

---

## Bug 1 Design: `ExportModal.tsx` Caller Update

### Change at line 54

Current (synchronous call, no await):
```ts
const exportResult = exporterModule.browserExport({ gameDefinition: project as never, mode });
```

Updated (awaited):
```ts
const exportResult = await exporterModule.browserExport({ gameDefinition: project as never, mode });
```

### No Other Changes Needed

`handleExport` is already declared `async` (line 47). The `try/catch` already wraps the call. The `setPhase('exporting')` call and the loading UI text `'익스포트 중...'` (line 246) are already in place. The only change is adding `await`.

---

## Bug 2 Design: `collectWordsForCase` Rewrite in `renderer.ts`

### New Implementation

Replace the current `collectWordsForCase` method (lines 443–468) with:

```ts
private collectWordsForCase(
  def: GameDefinition,
  caseId: string,
  caseState: CaseState
): Word[] {
  const results: Word[] = [];

  for (const wordId of caseState.collectedWordIds) {
    // Primary path: look up from the global words dictionary
    // Covers all cases — including words collected cross-case
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

    // Fallback path: scan scenes in the current case for word_reveal actions
    // Preserves backward compatibility with game definitions that lack def.words
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

    // Last resort: emit warning and use ID as display label
    // Prevents silent data loss — the word appears but with a visible broken label
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

### What Is Preserved

- `extractWordsFromAction()` (lines 470–500) is **not changed**. It continues to handle `word_reveal`, `composite`, and `examine_image` action trees. The fallback path in the new `collectWordsForCase` calls it exactly as before.
- The `Word` type from `@gi-engine/core` (types.ts line 159–167) has fields: `id`, `display`, `category`, `caseId`, `hint`, `imageUrl`. The new code populates all applicable fields from `WordDefinition` (types.ts line 152–157).
- `WordDefinition` has: `id`, `display`, `category`, `hint`. The new code maps these faithfully.

### Edge Cases

| Case | Behavior |
|------|----------|
| Word in `def.words` (normal case) | Primary path: direct lookup, O(1) per word |
| Word not in `def.words`, hotspot in current case scenes | Fallback: scene scan, same as old behavior |
| Word not in `def.words`, hotspot in *different* case scenes | Last resort: warn + use ID as label |
| `def.words` is `undefined` or `null` (old format) | `def.words?.[wordId]` is `undefined`, falls through to scene scan |
| `caseState.collectedWordIds` is empty | Returns `[]` immediately (loop body never executes) |
| Duplicate word IDs in `collectedWordIds` | Each ID processed independently; result array may contain duplicates — same behavior as before since `wordMap.get` is idempotent |

### No Changes to `deduction-renderer.ts`

`deduction-renderer.ts` `createSlot()` at line 232:
```ts
const word = words.find(w => w.id === assignedWordId);
el.textContent = word ? this.i18n.resolveText(word.display) : assignedWordId;
```

After the fix, `collectWordsForCase` guarantees a `Word` entry for every collected ID (with either the real display name or the ID itself as fallback). The `words.find` will always succeed for any word in `assignedWordId` that was collected.

---

## Bug 3 Design: Incremental Slot Update in `renderer.ts`

### New Private Fields

Add two fields to the `Renderer` class, initialized in the class body (not constructor body — initialization at declaration ensures they are `{}` / `[]` from the start):

```ts
private lastSlotAssignments: Record<string, string | null> = {};
private lastCollectedWordIds: string[] = [];
```

These fields are declared alongside the existing `private currentView: string = ''` at line 44.

### Updated `renderThinking` Method

Replace the current `renderThinking` body (lines 238–279) with:

```ts
private renderThinking(
  state: GameState & { type: 'thinking' },
  save: SaveState,
  def: GameDefinition
): void {
  const caseData = findCase(def, state.caseId);
  if (!caseData) return;
  const caseState = save.caseStates[state.caseId];
  if (!caseState) return;

  const puzzle = findPuzzle(caseData.puzzles, state.puzzleId);
  if (!puzzle) return;
  const puzzleState = caseState.puzzleStates[state.puzzleId];
  if (!puzzleState) return;

  // Collect words for this case from the game definition
  const caseWords = this.collectWordsForCase(def, state.caseId, caseState);

  // Compute which words are currently assigned to any slot
  const assignedWordIds = new Set<string>();
  for (const wordId of Object.values(puzzleState.slotAssignments)) {
    if (wordId) assignedWordIds.add(wordId);
  }

  if (this.currentView !== `thinking:${state.puzzleId}`) {
    // First visit to this puzzle: full mount
    this.clearView([]);
    this.removeControls();
    this.currentView = `thinking:${state.puzzleId}`;
    // Snapshot current assignments so the diff starts clean
    this.lastSlotAssignments = { ...puzzleState.slotAssignments };

    if ('template' in puzzle) {
      this.deductionRenderer.render(
        puzzle as Puzzle,
        puzzleState,
        caseWords,
        assignedWordIds
      );
    }
  } else {
    // Repeat visit (e.g. after ASSIGN_WORD / UNASSIGN_WORD dispatch):
    // Apply incremental DOM updates — do NOT re-mount the deduction UI
    const current = puzzleState.slotAssignments;

    for (const slotId of Object.keys(current)) {
      const newWordId = current[slotId] ?? null;
      const oldWordId = this.lastSlotAssignments[slotId] ?? null;
      if (newWordId !== oldWordId) {
        this.deductionRenderer.updateSlotContent(slotId, newWordId, caseWords);
        this.lastSlotAssignments[slotId] = newWordId;
      }
    }

    // Also handle slots that existed in lastSlotAssignments but were removed
    // (e.g. if the puzzle template changed — defensive)
    for (const slotId of Object.keys(this.lastSlotAssignments)) {
      if (!(slotId in current)) {
        this.deductionRenderer.updateSlotContent(slotId, null, caseWords);
        delete this.lastSlotAssignments[slotId];
      }
    }

    // Sync word bank assigned state for all words
    for (const word of caseWords) {
      this.deductionRenderer.updateWordBankItem(word.id, assignedWordIds.has(word.id));
    }
  }

  // Sub-state handling (same position as before — after the mount/update branch)
  if (state.sub.type === 'showing_result') {
    this.deductionRenderer.showValidationResults(state.sub.results);
  }
}
```

### Updated `clearView` Method

Add two reset lines at the end of `clearView` (lines 122–129):

```ts
private clearView(except: string[]): void {
  if (!except.includes('scene')) this.sceneRenderer.destroy();
  if (!except.includes('deduction')) this.deductionRenderer.destroy();
  if (!except.includes('caseSelect')) this.caseSelectRenderer.destroy();
  if (!except.includes('popup')) this.popupRenderer.dismiss();
  this.removeCompletion();
  this.removeLoading();
  this.lastSlotAssignments = {};       // Reset diff state when view changes
  this.lastCollectedWordIds = [];      // Reset word tracking
}
```

### Why `lastCollectedWordIds` Is Included

Although the immediate fix only uses `lastSlotAssignments`, `lastCollectedWordIds` is added as a companion field for future use (e.g., detecting when a new word is collected while the puzzle is open and updating the word bank without a full re-render). Adding it now avoids a second PR. It is reset in `clearView` for symmetry but is otherwise unused in this patch.

### Key Design Decisions

**Diff direction**: The diff iterates `puzzleState.slotAssignments` (current truth), not `lastSlotAssignments` (previous snapshot). This means newly-introduced slot IDs (e.g., from a hot-reload) are always detected. Removed slot IDs are handled by the second loop.

**`updateSlotContent` signature**: `deduction-renderer.ts` line 138 signature is `updateSlotContent(slotId: string, wordId: string | null, words: Word[]): void`. The third parameter `words` is required for display name lookup. The `caseWords` array computed in `renderThinking` is passed directly — no extra work.

**`updateWordBankItem` on every incremental update**: Syncing all word bank items on every `ASSIGN_WORD` / `UNASSIGN_WORD` is O(n) on the number of collected words, but this list is small (typically <30 words per case) and the DOM operation is lightweight (toggle one CSS class per element). This is simpler and more correct than tracking which words changed.

**`showing_result` sub-state is unaffected**: The `showValidationResults` call remains at the bottom of the method, after both the mount and incremental branches. It fires any time the sub-state is `showing_result`, regardless of whether a full mount or incremental update just occurred. This is correct behavior.

**`UNASSIGN_WORD` fix is automatic**: The `UNASSIGN_WORD` event sets `slotAssignments[slotId] = null` (per state machine logic). The diff detects `null !== previousWordId` and calls `updateSlotContent(slotId, null, caseWords)`, which restores the placeholder text and removes `gi-slot--filled`. No additional handling is needed.

**No changes to `drag-drop-manager.ts`**: The manager correctly dispatches `ASSIGN_WORD` (and `UNASSIGN_WORD` for source slot). The renderer-side diff handles the visual update. The `getDeductionRenderer` callback passed at construction time remains available for potential future direct-update optimizations.

---

## `updateSlotContent` and `updateWordBankItem` Behavior Verification

Reading `deduction-renderer.ts` lines 138–163:

**`updateSlotContent(slotId, wordId, words)`**:
- Looks up `slotEl` from `this.slotElements` Map (populated during `render()` via `createSlot()`)
- Clears validation classes (`gi-slot--correct`, `gi-slot--partial`, `gi-slot--incorrect`, `gi-slot--animate`)
- If `wordId` is truthy: sets `textContent` to the resolved display name (or raw ID if word not found), adds `gi-slot--filled`, removes `gi-slot--empty`, sets `dataset.wordId`
- If `wordId` is null/empty: restores placeholder from `dataset.placeholder`, adds `gi-slot--empty`, removes `gi-slot--filled`, deletes `dataset.wordId`

**`updateWordBankItem(wordId, assigned)`**:
- Looks up `wordEl` from `this.wordElements` Map
- Toggles `gi-word--assigned` class based on `assigned` boolean

Both methods are no-ops if the element is not in the Map (i.e., if `render()` has not been called yet or if `destroy()` was called). This is safe — `lastSlotAssignments` is reset in `clearView`, so the incremental update branch only runs after a successful `render()` call.

---

## Implementation Order

Files are listed in the order they should be modified. Each step is independent of the others (no shared state between bugs), but ordering from deepest dependency to outer caller reduces risk of confusion.

### Step 1: `packages/runtime/src/renderer/renderer.ts`

Fixes Bug 2 (word display) and Bug 3 (drag-drop DOM update) in a single file.

Changes:
1. Add `private lastSlotAssignments: Record<string, string | null> = {};` field declaration (alongside `currentView`)
2. Add `private lastCollectedWordIds: string[] = [];` field declaration
3. Replace `collectWordsForCase` method body (primary `def.words` lookup + fallback scan + last-resort warning)
4. Replace `renderThinking` method body (add incremental update `else` branch after the `currentView` guard)
5. Update `clearView` method body (add two reset lines at end)

### Step 2: `packages/exporter/src/browser-export.ts`

Fixes Bug 1 (background images in exported HTML).

Changes:
1. Add `AssetManifest` and `AssetDefinition` to the `@gi-engine/core` import if not already present
2. Insert `inlineAssetsForBrowser` async helper function before `browserExport`
3. Change `browserExport` signature to `async function browserExport(...): Promise<BrowserExportResult>`
4. Add inlining step at the start of `browserExport` body
5. Replace `gameDefinition` references in serialization and size computation with `exportDef` / `inlinedManifest`

### Step 3: `packages/editor/src/components/export/ExportModal.tsx`

Fixes the caller of `browserExport` to await the now-async function.

Changes:
1. Line 54: add `await` before `exporterModule.browserExport(...)`

---

## Acceptance Criteria Cross-Reference

| AC | File | How satisfied |
|----|------|---------------|
| AC1.1 — background renders in standalone HTML | `browser-export.ts` | `inlineAssetsForBrowser` fetches and converts every image asset to base64; `resolveAssetSrc` in `scene-renderer.ts` returns `asset.inline`, which is now always set |
| AC1.2 — layer images also render | `browser-export.ts` | Same inlining path: layer images reference asset IDs, same manifest, same inline field |
| AC1.3 — failed fetch does not break export | `browser-export.ts` | `try/catch` per asset; `console.warn` on error; asset kept with original `src` |
| AC1.4 — already-inlined assets: no redundant fetch | `browser-export.ts` | `if (asset.inline)` guard at start of per-asset loop |
| AC2.1 — word bank shows display names | `renderer.ts` | `collectWordsForCase` primary path returns `Word` with `wordDef.display` for all IDs in `def.words` |
| AC2.2 — filled slots show display names | `renderer.ts` | `deductionRenderer.updateSlotContent` / `createSlot` both look up from `caseWords`; `caseWords` now always has entries |
| AC2.3 — empty slots show placeholder | `deduction-renderer.ts` (unchanged) | `updateSlotContent(slotId, null, ...)` restores `dataset.placeholder`; no change needed |
| AC2.4 — cross-case words resolved | `renderer.ts` | Primary path does not filter by scene or case; any ID in `def.words` is resolved |
| AC2.5 — missing `def.words` uses scene scan | `renderer.ts` | Fallback path triggers when `def.words?.[wordId]` is undefined |
| AC3.1 — slot shows word after drop | `renderer.ts` | `renderThinking` incremental branch calls `updateSlotContent` for changed slots |
| AC3.2 — word in bank marked assigned | `renderer.ts` | `renderThinking` incremental branch calls `updateWordBankItem` for all words |
| AC3.3 — re-drag from slot: source empty, target filled | `renderer.ts` + `drag-drop-manager.ts` (unchanged) | Manager dispatches `UNASSIGN_WORD` for source then `ASSIGN_WORD` for target; both trigger diffs |
| AC3.4 — drop outside slot unassigns | `drag-drop-manager.ts` (unchanged) | Manager dispatches `UNASSIGN_WORD`; diff detects `null` → calls `updateSlotContent(slotId, null, ...)` |
| AC3.5 — drop on own slot: no change | Both (unchanged logic) | State machine returns same assignments; diff computes zero changes; no DOM mutation |
| AC3.6 — validate evaluates current assignments | State machine (unchanged) | `VALIDATE_PUZZLE` reads `puzzleState.slotAssignments` which was updated by `ASSIGN_WORD`; no renderer involvement |

---

## Non-Goals (Confirmed No Changes Needed)

- `deduction-renderer.ts` — no changes. `updateSlotContent`, `updateWordBankItem`, `render`, `renderWordBank`, `createSlot` are all correct as-is.
- `drag-drop-manager.ts` — no changes. Event dispatch sequence is correct. The design doc mention of direct renderer calls is superseded by the renderer-side diff approach.
- `scene-renderer.ts` — no changes. `resolveAssetSrc()` already correctly prefers `asset.inline` over `asset.src`.
- `engine.ts` — no changes. The `Renderer` constructor, `dispatch` loop, and `DragDropManager` wiring are all correct.
- `packages/core/src/models/types.ts` — no changes. All types used (`Word`, `WordDefinition`, `AssetDefinition`, `AssetManifest`, `PuzzleState`, `ThinkingSubState`) are correct.
