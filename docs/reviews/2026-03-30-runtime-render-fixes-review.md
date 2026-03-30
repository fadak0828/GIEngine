# Code Review — runtime-render-fixes

**Date**: 2026-03-30
**Reviewer**: Reviewer Agent (Claude Sonnet 4.6)
**Branch**: feature/gi-engine-core
**Design**: docs/designs/2026-03-30-runtime-render-fixes.md
**QA Report**: docs/qa/2026-03-30-runtime-render-fixes-qa-report.md

---

## Files Reviewed

- `packages/exporter/src/browser-export.ts`
- `packages/runtime/src/renderer/renderer.ts`
- `packages/editor/src/components/export/ExportModal.tsx`

Supporting files read for context:
- `packages/runtime/src/renderer/deduction-renderer.ts`
- `packages/core/src/models/types.ts`

---

## What Was Done Well

- All three bugs are addressed with surgical, self-contained changes that do not perturb unrelated code paths.
- The FileReader wrapping pattern is idiomatic: `onload`/`onerror` callbacks are attached before `readAsDataURL` is called, so no race condition is possible.
- The three-tier word lookup in `collectWordsForCase` is a clean improvement over the previous scene-only scan; each tier uses `continue` so tiers are mutually exclusive per word ID.
- The `lastSlotAssignments` diff correctly normalizes `null` and `undefined` via `?? null` on both sides of the comparison, so un-assigning a slot (setting it to `null` in state) is detected and `updateSlotContent(slotId, null, caseWords)` is called.
- `clearView` resets `lastSlotAssignments` and `lastCollectedWordIds` unconditionally, ensuring the first-visit branch re-mounts cleanly after navigation away and back.
- `ExportModal.tsx` correctly awaits the now-async `browserExport` call, and the surrounding `async handleExport` function already had a `try/catch` that feeds the error UI.
- TypeScript compilation passes with 0 errors across all changed packages per the QA report.
- 17 new tests were added covering all three bug fixes, with 265 total tests passing.

---

## Issues Found

### Critical (Fixed by Reviewer)

#### C1 — `inlineAssetsForBrowser` fetches assets serially (Performance)

**File**: `packages/exporter/src/browser-export.ts`

**Original code**: The function used a `for...of` loop with `await` inside, meaning each fetch-and-encode operation waited for the previous one to complete before starting.

```ts
for (const [id, asset] of Object.entries(manifest.items)) {
  // ...
  const response = await fetch(url);   // serial — next asset waits here
  // ...
}
```

A game with 20 background images at 200ms round-trip each would take 4 seconds to export in sequence. With `Promise.all` the same 20 fetches complete in roughly the time of the slowest single fetch.

**Fix applied**: Extracted the per-asset logic into a private `inlineOne` helper and replaced the loop with `Promise.all` over `Object.entries(manifest.items).map(...)`. Because `inlineOne` never throws (errors are caught internally and return the original asset), `Promise.all` cannot reject from an individual asset failure. All existing edge-case guards (`asset.inline`, `!asset.src`, `data:` prefix, catch block) are preserved unchanged.

**Revised function in `packages/exporter/src/browser-export.ts`** (lines 38–91 after fix):

```ts
async function inlineAssetsForBrowser(
  manifest: AssetManifest,
  baseUrl: string
): Promise<AssetManifest> {
  async function inlineOne(id: string, asset: AssetDefinition): Promise<[string, AssetDefinition]> {
    if (asset.inline) return [id, asset];
    if (!asset.src) return [id, asset];
    if (asset.src.startsWith('data:')) return [id, asset];
    try {
      // ... fetch, arrayBuffer, FileReader ...
      return [id, { ...asset, inline: dataUrl, size: buffer.byteLength }];
    } catch (err) {
      console.warn(...);
      return [id, asset];
    }
  }
  // Fetch all assets in parallel
  const entries = await Promise.all(
    Object.entries(manifest.items).map(([id, asset]) => inlineOne(id, asset))
  );
  return { items: Object.fromEntries(entries) };
}
```

---

### Important (Should Fix — Not Applied, Requires Design Decision)

#### I1 — `inlineAssetsForBrowser` fetches from arbitrary external domains

**File**: `packages/exporter/src/browser-export.ts`, line 54 (original line 62)

```ts
const url = new URL(asset.src, baseUrl).href;
const response = await fetch(url);
```

`new URL(absoluteUrl, baseUrl)` ignores `baseUrl` when `absoluteUrl` is already an absolute URL. If a `GameDefinition` contains an asset with `src: "https://external.cdn.com/image.png"`, the export function will `fetch()` from that domain. A malicious or misconfigured game definition could cause the editor to make cross-origin requests to arbitrary URLs at export time.

**Recommendation**: Add an allowlist check before fetching. At minimum, assert the resolved URL shares the same origin as `baseUrl`:

```ts
const resolved = new URL(asset.src, baseUrl);
const base = new URL(baseUrl);
if (resolved.origin !== base.origin) {
  console.warn(`[browserExport] Skipping cross-origin asset "${id}" (${resolved.href})`);
  inlinedItems[id] = asset;  // keep original src; do not fetch
  continue;
}
```

An allowlist of permitted external origins (e.g. a CDN hostname the studio controls) would be a stronger solution. The appropriate allowlist is a product decision.

---

### Suggestions (Nice to Have)

#### S1 — `extractWordsFromAction` uses `action: any`

**File**: `packages/runtime/src/renderer/renderer.ts`, line 531

```ts
private extractWordsFromAction(
  action: any,          // <-- unsafe
  def: GameDefinition,
  caseId: string,
  wordMap: Map<string, Word>
): void {
```

`HotspotAction` is a discriminated union defined in `types.ts`. The parameter should be typed `action: HotspotAction` (already imported at line 1 via the `@gi-engine/core` import block, though `HotspotAction` is not in the current import list). Using `any` disables TypeScript's exhaustiveness checks on the `action.type` switch and the access to `action.wordIds`, `action.actions`, and `action.innerHotspots`.

**Recommendation**: Add `HotspotAction` to the import from `@gi-engine/core` and replace `action: any` with `action: HotspotAction`. The existing conditional checks (`action.type === 'word_reveal'`, etc.) already match the union variants and will compile cleanly once typed.

#### S2 — Fallback scene scan in Tier 2 rebuilds `wordMap` on every miss

**File**: `packages/runtime/src/renderer/renderer.ts`, lines 502–515

The current Tier 2 implementation reconstructs `wordMap` from scratch for each word ID that falls through Tier 1. For a case with M words missing from `def.words` and N total hotspots, this is O(M × N). For the typical case (all words in `def.words`), this path is never entered and there is no performance issue. For legacy game formats without `def.words`, performance degrades quadratically.

**Recommendation**: Hoist the scene scan outside the per-word loop so it runs at most once, then consult the map for each unresolved word:

```ts
// Build the fallback map once (lazily) outside the per-word loop
let fallbackMap: Map<string, Word> | null = null;

for (const wordId of caseState.collectedWordIds) {
  const wordDef = def.words?.[wordId];
  if (wordDef) { /* Tier 1 ... */ continue; }

  // Tier 2: build the map once on first miss
  if (!fallbackMap) {
    fallbackMap = new Map<string, Word>();
    const caseData = findCase(def, caseId);
    if (caseData) {
      for (const scene of caseData.scenes) {
        for (const hotspot of scene.hotspots) {
          this.extractWordsFromAction(hotspot.action, def, caseId, fallbackMap);
        }
      }
    }
  }
  const found = fallbackMap.get(wordId);
  if (found) { results.push(found); continue; }

  /* Tier 3 warning ... */
}
```

This is a small refactor with no behavioral change for the current test suite, but it eliminates the redundant scene scans for the legacy path.

#### S3 — `def.assets` guard in `browserExport`

**File**: `packages/exporter/src/browser-export.ts`, line 102

`GameDefinition.assets` is typed as required (`assets: AssetManifest` with no `?`). However, game definitions loaded from external sources or partial fixtures could be missing this field at runtime. A defensive guard would prevent a cryptic `Cannot read properties of undefined` at the `Object.entries(manifest.items)` call:

```ts
const inlinedManifest = await inlineAssetsForBrowser(
  gameDefinition.assets ?? { items: {} },
  baseUrl
);
```

---

## Plan Alignment

| Design Requirement | Implementation | Status |
|--------------------|----------------|--------|
| `FileReader` event-based (no race condition) | `onload`/`onerror` set before `readAsDataURL`; wrapped in Promise | Aligned |
| `GameDefinition` not mutated during export | Shallow spread `{ ...gameDefinition, assets: inlinedManifest }` | Aligned |
| Three-tier word lookup | Implemented as designed; each tier uses `continue` | Aligned |
| Fallback for missing `def.words` | Tier 2 scene scan preserved | Aligned |
| `lastSlotAssignments` diff for incremental DOM update | Implemented; `clearView` resets snapshot | Aligned |
| `updateWordBankItem` called on every incremental update | Called for all `caseWords` in incremental branch | Aligned |
| `showing_result` sub-state unaffected | Remains at bottom of method, outside mount/update branch | Aligned |
| `browserExport` made async, caller awaited | Both done correctly | Aligned |
| Serial asset fetching | **DEVIATION**: design specified no parallelism requirement; implementation was serial; **fixed to parallel by reviewer** | Fixed |

The only deviation from the design is that the design document did not address parallelism for `inlineAssetsForBrowser`. The sequential implementation was a correctness-preserving but performance-suboptimal choice. The fix applied by this reviewer preserves all correctness invariants while eliminating the serial bottleneck.

---

## Summary

| Category | Count |
|----------|-------|
| Critical (fixed) | 1 |
| Important (should fix) | 1 |
| Suggestions | 3 |

The three bug fixes are functionally correct, type-safe (with the exception of the `action: any` parameter noted in S1), and well-tested. One critical performance issue (serial asset fetching) has been fixed directly. One important security issue (unconstrained cross-origin fetch) requires a product decision on an allowlist before this feature is used with untrusted game definitions.

---

## VERDICT: APPROVED WITH FIXES APPLIED

The implementation is approved. One critical fix (parallel asset fetching) was applied directly by the reviewer. Issue I1 (cross-origin fetch allowlist) is flagged as important and should be addressed before the export feature is exposed to untrusted game content.
