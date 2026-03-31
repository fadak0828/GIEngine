# Golden Idol Interactive Words — Implementation Plan

**Date:** 2026-03-31
**Scope:** 4 changes across core types, state machine, runtime renderers, CSS, and editor components
**Estimated complexity:** HIGH (cross-package type changes with cascading updates)

---

## File Map

### Files to MODIFY

| # | File | Changes |
|---|------|---------|
| 1 | `packages/runtime/src/styles/main.css` | Add ~200 lines of CSS for puzzle bar, puzzle overlay, inner hotspots, collectible words, toasts |
| 2 | `packages/core/src/models/types.ts` | Add `CollectibleWord`, modify `ExamineAction`, `ExamineImageAction`, `ExploringSubState`, `GameEvent`, `SideEffect` |
| 3 | `packages/core/src/state/state-machine.ts` | Remove auto-collection, add `COLLECT_WORD_IN_POPUP` handler, change `INNER_HOTSPOT_CLICK` for word_reveal |
| 4 | `packages/runtime/src/renderer/popup-renderer.ts` | Add collectible word rendering in text popups, inline feedback for image popup word_reveal |
| 5 | `packages/runtime/src/renderer/renderer.ts` | Pass collectibleWords + collectedWordIds to popup, handle `word_collected_in_popup` effect |
| 6 | `packages/editor/src/components/properties/HotspotProperties.tsx` | Replace WordDropdown with CollectibleWordsEditor for examine, add InnerHotspotEditor for examine_image |
| 7 | `packages/core/tests/state-machine-examine-words.test.ts` | Update tests for new collectibleWords flow (remove wordIds-based auto-collect tests) |

### Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 8 | `packages/editor/src/components/properties/SubPuzzleEditor.tsx` | Editor UI for managing sub-puzzles on a case |
| 9 | `packages/editor/src/components/properties/CollectibleWordsEditor.tsx` | Editor for `{wordId, textMatch}` pairs on examine actions |
| 10 | `packages/editor/src/components/properties/InnerHotspotEditor.tsx` | Nested hotspot editor for examine_image inner hotspots |
| 11 | `packages/core/tests/state-machine-collectible-words.test.ts` | Tests for COLLECT_WORD_IN_POPUP and interactive word collection |

---

## Task 1: CSS for Puzzle Bar, Overlay, Inner Hotspots, and Collectible Words

**File:** `packages/runtime/src/styles/main.css`
**Acceptance:** Puzzle bar visible at bottom of game container; overlay slides in; inner hotspots pulse; collectible words are styled.

- [ ] **1.1** Add puzzle bar styles at end of file (before responsive breakpoints section):

```css
/* --- Puzzle Bar --- */
.gi-puzzle-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(10, 8, 5, 0.85);
  backdrop-filter: blur(6px);
  border-top: 1px solid var(--gi-border);
  z-index: 16;
}

.gi-puzzle-tab {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  font-family: var(--gi-font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--gi-text);
  background: var(--gi-surface);
  border: 1px solid var(--gi-border);
  border-radius: var(--gi-radius);
  cursor: pointer;
  transition: all var(--gi-transition-fast);
  text-transform: uppercase;
}

.gi-puzzle-tab:hover {
  background: var(--gi-surface-hover);
  border-color: var(--gi-border-light);
  color: var(--gi-text-bright);
}

.gi-puzzle-tab:focus-visible {
  outline: 2px solid var(--gi-accent);
  outline-offset: 2px;
}

.gi-puzzle-tab-icon {
  font-size: 1rem;
  line-height: 1;
}

.gi-puzzle-tab-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.gi-puzzle-tab--solved {
  border-color: var(--gi-correct);
  color: #7cd694;
  opacity: 0.75;
}
```

- [ ] **1.2** Add puzzle overlay styles:

```css
/* --- Puzzle Overlay --- */
.gi-puzzle-overlay {
  position: absolute;
  inset: 0;
  background: var(--gi-overlay);
  z-index: 55;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: gi-fade-in 0.25s ease;
  padding: 1.5rem;
  overflow-y: auto;
}

.gi-puzzle-overlay-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 36px;
  height: 36px;
  border: 1px solid var(--gi-border);
  background: var(--gi-surface);
  color: var(--gi-text);
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all var(--gi-transition-fast);
  z-index: 1;
}

.gi-puzzle-overlay-close:hover {
  background: var(--gi-surface-hover);
  color: var(--gi-text-bright);
}

.gi-puzzle-overlay-content {
  width: 100%;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
}
```

- [ ] **1.3** Add sub-puzzle layout styles:

```css
/* --- Sub-Puzzle --- */
.gi-sub-puzzle {
  background: var(--gi-parchment);
  border: 1px solid var(--gi-border);
  border-radius: var(--gi-radius-lg);
  padding: 1.5rem;
  box-shadow: 0 8px 32px var(--gi-shadow);
}

.gi-sub-puzzle-header h3 {
  font-family: var(--gi-font-body);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--gi-text-bright);
  margin: 0 0 1rem;
  text-align: center;
}

.gi-sub-puzzle-controls {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1.25rem;
}

/* --- Character ID Grid --- */
.gi-character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.gi-character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--gi-surface);
  border: 1px solid var(--gi-border);
  border-radius: var(--gi-radius-lg);
}

.gi-character-portrait {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--gi-bg-alt);
  border: 2px solid var(--gi-border);
}

.gi-character-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* --- Timeline --- */
.gi-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.gi-timeline-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--gi-border);
}

.gi-timeline-label {
  font-family: var(--gi-font-ui);
  font-size: 0.85rem;
  color: var(--gi-text-dim);
  min-width: 100px;
  flex-shrink: 0;
}

/* --- Relationship --- */
.gi-relationship {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.gi-relationship-edge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.gi-relationship-node {
  font-family: var(--gi-font-body);
  font-size: 0.95rem;
  color: var(--gi-text-bright);
  padding: 0.25rem 0.5rem;
  background: var(--gi-surface);
  border: 1px solid var(--gi-border);
  border-radius: var(--gi-radius);
  white-space: nowrap;
}

.gi-relationship-arrow {
  color: var(--gi-text-dim);
  font-size: 1.1rem;
}
```

- [ ] **1.4** Add inner hotspot pulse animation:

```css
/* --- Inner Hotspots --- */
.gi-inner-hotspot {
  background: rgba(232, 200, 116, 0.08);
  border: 2px solid rgba(232, 200, 116, 0.3);
  border-radius: var(--gi-radius);
  animation: gi-inner-hotspot-pulse 2s ease-in-out infinite;
  transition: all var(--gi-transition-fast);
}

.gi-inner-hotspot:hover,
.gi-inner-hotspot:focus-visible {
  background: rgba(232, 200, 116, 0.2);
  border-color: rgba(232, 200, 116, 0.6);
  animation: none;
}

@keyframes gi-inner-hotspot-pulse {
  0%, 100% { border-color: rgba(232, 200, 116, 0.15); box-shadow: 0 0 0 0 rgba(232, 200, 116, 0); }
  50% { border-color: rgba(232, 200, 116, 0.45); box-shadow: 0 0 10px 2px rgba(232, 200, 116, 0.15); }
}
```

- [ ] **1.5** Add collectible word styles and toast variants:

```css
/* --- Collectible Words in Popups --- */
.gi-collectible-word {
  display: inline;
  padding: 0.1rem 0.15rem;
  margin: 0 0.05rem;
  font-family: inherit;
  font-size: inherit;
  color: var(--gi-text-accent);
  background: rgba(196, 148, 58, 0.1);
  border: none;
  border-bottom: 2px dashed var(--gi-accent);
  cursor: pointer;
  transition: all var(--gi-transition-fast);
  font-weight: 600;
}

.gi-collectible-word:hover {
  background: rgba(196, 148, 58, 0.2);
  border-bottom-style: solid;
}

.gi-collectible-word--collected {
  color: var(--gi-correct);
  border-bottom-color: var(--gi-correct);
  border-bottom-style: solid;
  background: var(--gi-correct-bg);
  cursor: default;
  pointer-events: none;
}

/* --- Toast Variants --- */
.gi-toast--word {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(196, 148, 58, 0.92);
}

.gi-toast--exit {
  animation: gi-toast-out 0.3s ease forwards;
}

.gi-toast-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.gi-toast-text {
  white-space: nowrap;
}
```

- [ ] **1.6** Verify: Open the game in a browser, confirm puzzle bar renders at bottom, overlay opens on tab click, inner hotspots pulse. (Visual check only — CSS is passive.)

**Commit message:** `feat(runtime): add CSS for puzzle bar, overlay, inner hotspots, and collectible words`

---

## Task 2: Core Type Changes for CollectibleWords

**File:** `packages/core/src/models/types.ts`
**Acceptance:** TypeScript compiles; all downstream packages see the new types.

- [ ] **2.1** Add `CollectibleWord` type after the `WordCategory` type:

```typescript
export interface CollectibleWord {
  wordId: string;
  textMatch: LocalizedText;
}
```

- [ ] **2.2** Modify `ExamineAction` — remove `wordIds`, add `collectibleWords`:

```typescript
export interface ExamineAction {
  type: 'examine';
  content: LocalizedText;
  title?: LocalizedText;
  highlightedWords?: string[];
  collectibleWords?: CollectibleWord[];
}
```

- [ ] **2.3** Modify `ExamineImageAction` — remove `wordIds` (innerHotspots with word_reveal handle collection):

```typescript
export interface ExamineImageAction {
  type: 'examine_image';
  image: AssetRef;
  caption?: LocalizedText;
  innerHotspots?: Hotspot[];
}
```

- [ ] **2.4** Modify `ExploringSubState` `examining_text` variant — add `collectibleWords`:

```typescript
| { type: 'examining_text'; content: LocalizedText; title?: LocalizedText; highlightedWords?: string[]; collectibleWords?: CollectibleWord[] }
```

- [ ] **2.5** Add `COLLECT_WORD_IN_POPUP` to `GameEvent` union:

```typescript
| { type: 'COLLECT_WORD_IN_POPUP'; wordId: string }
```

- [ ] **2.6** Add `word_collected_in_popup` to `SideEffect` union:

```typescript
| { type: 'word_collected_in_popup'; wordId: string }
```

- [ ] **2.7** Verify: `cd packages/core && npx tsc --noEmit` compiles cleanly (expect downstream errors in other packages until they are updated).

**Commit message:** `feat(core): add CollectibleWord type, replace wordIds with collectibleWords on examine actions`

---

## Task 3: State Machine Changes

**File:** `packages/core/src/state/state-machine.ts`
**Acceptance:** `transition()` no longer auto-collects words on examine/examine_image; `COLLECT_WORD_IN_POPUP` collects without changing sub-state; `INNER_HOTSPOT_CLICK` with word_reveal stays in examining_image.

- [ ] **3.1** Modify `handleHotspotAction` case `'examine'` — remove auto-collection block. Pass `collectibleWords` to sub-state:

```typescript
case 'examine': {
  return {
    nextState: {
      ...state,
      sub: {
        type: 'examining_text',
        content: action.content,
        title: action.title,
        highlightedWords: action.highlightedWords,
        collectibleWords: action.collectibleWords,
      },
    },
    effects: [],
  };
}
```

- [ ] **3.2** Modify `handleHotspotAction` case `'examine_image'` — remove auto-collection block:

```typescript
case 'examine_image': {
  return {
    nextState: {
      ...state,
      sub: {
        type: 'examining_image',
        image: action.image,
        caption: action.caption,
        innerHotspots: action.innerHotspots,
      },
    },
    effects: [],
  };
}
```

- [ ] **3.3** Add `COLLECT_WORD_IN_POPUP` handler in `handleExploring`, after `COLLECT_WORD`:

```typescript
case 'COLLECT_WORD_IN_POPUP': {
  // Only valid while in examining_text or examining_image sub-states
  if (state.sub.type !== 'examining_text' && state.sub.type !== 'examining_image') {
    return noTransition(state);
  }
  if (caseState.collectedWordIds.includes(event.wordId)) {
    // Already collected — return effect only for UI feedback, no save change
    return {
      nextState: state,
      effects: [{ type: 'word_collected_in_popup', wordId: event.wordId }],
    };
  }

  const updatedCaseState: CaseState = {
    ...caseState,
    collectedWordIds: [...caseState.collectedWordIds, event.wordId],
  };

  return {
    nextState: state,  // Sub-state does NOT change — popup stays open
    saveState: {
      caseStates: {
        ...save.caseStates,
        [state.caseId]: updatedCaseState,
      },
    },
    effects: [
      { type: 'word_collected_in_popup', wordId: event.wordId } as SideEffect,
      { type: 'save_game' },
    ],
  };
}
```

- [ ] **3.4** Modify `INNER_HOTSPOT_CLICK` handler — when the inner hotspot action is `word_reveal`, collect the word but stay in `examining_image`:

Replace the current `INNER_HOTSPOT_CLICK` handler with:

```typescript
case 'INNER_HOTSPOT_CLICK': {
  if (state.sub.type !== 'examining_image' || !state.sub.innerHotspots) {
    return noTransition(state);
  }
  const innerHotspot = state.sub.innerHotspots.find(h => h.id === event.hotspotId);
  if (!innerHotspot) return noTransition(state);

  // word_reveal inside examining_image: collect without dismissing popup
  if (innerHotspot.action.type === 'word_reveal') {
    const newWords = innerHotspot.action.wordIds.filter(
      id => !caseState.collectedWordIds.includes(id)
    );
    if (newWords.length === 0) {
      return {
        nextState: state,
        effects: innerHotspot.action.wordIds.map(wordId => ({
          type: 'word_collected_in_popup' as const,
          wordId,
        })),
      };
    }

    const updatedCaseState: CaseState = {
      ...caseState,
      collectedWordIds: [...caseState.collectedWordIds, ...newWords],
    };

    return {
      nextState: state,  // Stay in examining_image
      saveState: {
        caseStates: {
          ...save.caseStates,
          [state.caseId]: updatedCaseState,
        },
      },
      effects: [
        ...newWords.map(wordId => ({
          type: 'word_collected_in_popup' as const,
          wordId,
        })),
        { type: 'save_game' } as SideEffect,
      ],
    };
  }

  // Non-word_reveal inner hotspots: delegate to handleHotspotAction (may change sub-state)
  return handleHotspotAction(state, save, def, innerHotspot, caseState);
}
```

- [ ] **3.5** Update the `SideEffect` import/type reference to include `word_collected_in_popup` (already done in Task 2.6).

- [ ] **3.6** Verify: `cd packages/core && npx tsc --noEmit` passes.

**Commit message:** `feat(core): interactive word collection in popups, remove auto-collection from examine actions`

---

## Task 4: PopupRenderer Changes — Collectible Words

**File:** `packages/runtime/src/renderer/popup-renderer.ts`
**Acceptance:** Text popups render collectible words as clickable buttons; already-collected words are visually marked; image popup word_reveal shows inline feedback.

- [ ] **4.1** Add imports for `CollectibleWord` type:

```typescript
import type {
  LocalizedText,
  AssetRef,
  AssetManifest,
  GameEvent,
  Hotspot,
  CollectibleWord,
} from '@gi-engine/core';
```

- [ ] **4.2** Modify `showTextPopup` signature — add `collectibleWords`, `collectedWordIds`, `onWordCollect` parameters:

```typescript
showTextPopup(
  content: LocalizedText,
  title?: LocalizedText,
  highlightedWords?: string[],
  collectibleWords?: CollectibleWord[],
  collectedWordIds?: string[],
  onWordCollect?: (wordId: string) => void
): void {
```

- [ ] **4.3** In the body rendering section of `showTextPopup`, after the existing highlighted text logic, add collectible word rendering:

```typescript
// Body
const body = document.createElement('div');
body.className = 'gi-popup-body';

const text = this.i18n.resolveText(content);
if (collectibleWords && collectibleWords.length > 0 && onWordCollect) {
  body.innerHTML = this.renderCollectibleText(
    text,
    collectibleWords,
    collectedWordIds ?? [],
    highlightedWords
  );
  // Bind click handlers for collectible word buttons
  const buttons = body.querySelectorAll<HTMLButtonElement>('.gi-collectible-word');
  buttons.forEach(btn => {
    const wordId = btn.dataset.wordId;
    if (wordId && !btn.classList.contains('gi-collectible-word--collected')) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onWordCollect(wordId);
        // Immediately mark as collected visually
        btn.classList.add('gi-collectible-word--collected');
      });
    }
  });
} else if (highlightedWords && highlightedWords.length > 0) {
  body.innerHTML = this.highlightText(text, highlightedWords);
} else {
  body.textContent = text;
}
```

- [ ] **4.4** Add `renderCollectibleText` private method:

```typescript
private renderCollectibleText(
  text: string,
  collectibleWords: CollectibleWord[],
  collectedWordIds: string[],
  highlightedWords?: string[]
): string {
  // First escape HTML
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Apply highlighted words (cosmetic only, non-interactive)
  if (highlightedWords && highlightedWords.length > 0) {
    for (const word of highlightedWords) {
      // Skip words that are also collectible (collectible takes priority)
      const isCollectible = collectibleWords.some(
        cw => this.i18n.resolveText(cw.textMatch) === word
      );
      if (isCollectible) continue;

      const escapedWord = word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const regex = new RegExp(`(${this.escapeRegex(escapedWord)})`, 'gi');
      escaped = escaped.replace(regex, '<span class="gi-highlighted">$1</span>');
    }
  }

  // Replace collectible word text matches with interactive buttons
  for (const cw of collectibleWords) {
    const matchText = this.i18n.resolveText(cw.textMatch);
    const escapedMatch = matchText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const isCollected = collectedWordIds.includes(cw.wordId);
    const collectedClass = isCollected ? ' gi-collectible-word--collected' : '';
    const regex = new RegExp(`(${this.escapeRegex(escapedMatch)})`, 'gi');
    escaped = escaped.replace(
      regex,
      `<button class="gi-collectible-word${collectedClass}" data-word-id="${cw.wordId}">$1</button>`
    );
  }

  return escaped;
}
```

- [ ] **4.5** Add a public method `markWordCollected` for live updates without re-rendering:

```typescript
markWordCollected(wordId: string): void {
  if (!this.overlayEl) return;
  const btn = this.overlayEl.querySelector<HTMLElement>(
    `.gi-collectible-word[data-word-id="${wordId}"]`
  );
  if (btn) {
    btn.classList.add('gi-collectible-word--collected');
  }
}
```

- [ ] **4.6** Verify: `cd packages/runtime && npx tsc --noEmit` passes.

**Commit message:** `feat(runtime): render collectible words as interactive buttons in text popups`

---

## Task 5: Renderer Changes — Wire Up Interactive Collection

**File:** `packages/runtime/src/renderer/renderer.ts`
**Acceptance:** Clicking a collectible word in a text popup dispatches `COLLECT_WORD_IN_POPUP`, shows word toast without dismissing popup. Image popup inner hotspot word_reveal gives inline feedback.

- [ ] **5.1** In `renderExploring`, modify the `examining_text` case to pass collectible words data:

```typescript
case 'examining_text':
  this.popupRenderer.showTextPopup(
    state.sub.content,
    state.sub.title,
    state.sub.highlightedWords,
    state.sub.collectibleWords,
    caseState.collectedWordIds,
    (wordId: string) => {
      this.dispatch({ type: 'COLLECT_WORD_IN_POPUP', wordId });
    }
  );
  break;
```

- [ ] **5.2** Add effect handling for `word_collected_in_popup`. This is handled by the game engine loop that processes effects. In `Renderer`, add a public method `handleEffect`:

```typescript
handleWordCollectedInPopup(wordId: string, def: GameDefinition): void {
  // Mark the word as collected in the popup (live DOM update)
  this.popupRenderer.markWordCollected(wordId);

  // Show a small inline toast (doesn't dismiss popup)
  const wordDef = def.words?.[wordId];
  const wordName = wordDef ? this.i18n.resolveText(wordDef.display) : wordId;
  this.showWordToast(wordName);
}
```

- [ ] **5.3** In the `examining_image` inner hotspot callback, the dispatch already sends `INNER_HOTSPOT_CLICK`. No renderer change needed — the state machine (Task 3.4) now returns `word_collected_in_popup` effects for word_reveal inner hotspots, and the engine's effect processor will call `handleWordCollectedInPopup`.

- [ ] **5.4** Ensure the engine's effect processing loop (likely in the main game controller — check `packages/runtime/src/engine.ts` or similar) handles the new `word_collected_in_popup` effect type by calling `renderer.handleWordCollectedInPopup(effect.wordId, def)`.

- [ ] **5.5** Verify: `cd packages/runtime && npx tsc --noEmit` passes.

**Commit message:** `feat(runtime): wire up interactive word collection in popups with live feedback`

---

## Task 6: SubPuzzle Editor Component

**File:** `packages/editor/src/components/properties/SubPuzzleEditor.tsx` (NEW)
**Also:** `packages/editor/src/components/properties/SceneProperties.tsx` or `CaseProperties.tsx` (integrate)
**Acceptance:** Editor shows sub-puzzle list for a case; can add/edit/delete sub-puzzles; each type has appropriate property fields.

- [ ] **6.1** Create `SubPuzzleEditor.tsx`:

```tsx
import React from 'react';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import type { Case, SubPuzzle } from '@gi-engine/core';

interface SubPuzzleEditorProps {
  caseData: Case;
}

export function SubPuzzleEditor({ caseData }: SubPuzzleEditorProps): React.ReactElement {
  const { addSubPuzzle, updateSubPuzzle, deleteSubPuzzle } = useEditorStore();
  const caseId = caseData.id;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 12 }}>
      <div style={sectionHeader}>
        서브 퍼즐 ({caseData.puzzles.sub.length})
      </div>

      {caseData.puzzles.sub.map(sub => (
        <SubPuzzleItem
          key={sub.id}
          puzzle={sub}
          caseId={caseId}
          onUpdate={(patch) => updateSubPuzzle(caseId, sub.id, patch)}
          onDelete={() => deleteSubPuzzle(caseId, sub.id)}
        />
      ))}

      {/* Add button with type selector */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        {(['character_id', 'timeline', 'relationship', 'scenario'] as const).map(type => (
          <button
            key={type}
            onClick={() => addSubPuzzle(caseId, type)}
            style={addBtnStyle}
          >
            + {typeLabels[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Implementation details:
- `SubPuzzleItem` renders a collapsible card per sub-puzzle with title editor and type-specific fields
- For `character_id`: list of character slots (portrait asset ID, nameSlotId, answerId)
- For `timeline`: list of timeline slots (label, slotId, answerId)
- For `relationship`: list of nodes + edges
- For `scenario`: template editor (reuse pattern from main puzzle template editor if available, otherwise text segments + slots)
- Each sub-puzzle has a delete button with confirmation

- [ ] **6.2** Add `SubPuzzleEditor` to `CaseProperties.tsx`:

```tsx
import { SubPuzzleEditor } from './SubPuzzleEditor';

// Inside CaseProperties return, after the existing content:
<SubPuzzleEditor caseData={caseData} />
```

- [ ] **6.3** Verify: Editor builds cleanly, sub-puzzle list renders for a case, can add/delete sub-puzzles.

**Commit message:** `feat(editor): add SubPuzzleEditor for managing case sub-puzzles`

---

## Task 7: CollectibleWords Editor

**File:** `packages/editor/src/components/properties/CollectibleWordsEditor.tsx` (NEW)
**Also:** `packages/editor/src/components/properties/HotspotProperties.tsx` (modify)
**Acceptance:** For examine actions, authors can define `{wordId, textMatch}` pairs instead of bare wordIds.

- [ ] **7.1** Create `CollectibleWordsEditor.tsx`:

```tsx
import React from 'react';
import { WordDropdown } from '@/components/words/WordDropdown';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import type { CollectibleWord, LocalizedText } from '@gi-engine/core';

interface CollectibleWordsEditorProps {
  caseId: string;
  collectibleWords: CollectibleWord[];
  onChange: (words: CollectibleWord[]) => void;
}

export function CollectibleWordsEditor({
  caseId,
  collectibleWords,
  onChange,
}: CollectibleWordsEditorProps): React.ReactElement {
  const addWord = () => {
    onChange([...collectibleWords, { wordId: '', textMatch: { ko: '', en: '' } }]);
  };

  const updateWord = (index: number, patch: Partial<CollectibleWord>) => {
    const updated = collectibleWords.map((w, i) =>
      i === index ? { ...w, ...patch } : w
    );
    onChange(updated);
  };

  const removeWord = (index: number) => {
    onChange(collectibleWords.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={labelStyle}>수집 가능한 단어</div>
      {collectibleWords.map((cw, i) => (
        <div key={i} style={itemStyle}>
          <WordDropdown
            caseId={caseId}
            wordIds={cw.wordId ? [cw.wordId] : []}
            onChange={ids => updateWord(i, { wordId: ids[0] ?? '' })}
            label="단어"
            singleSelect
          />
          <LocalizedTextInput
            label="텍스트 매치"
            value={cw.textMatch}
            onChange={v => updateWord(i, { textMatch: v })}
          />
          <button onClick={() => removeWord(i)} style={removeBtnStyle}>×</button>
        </div>
      ))}
      <button onClick={addWord} style={addBtnStyle}>+ 단어 추가</button>
    </div>
  );
}
```

Note: `WordDropdown` currently supports multi-select via `wordIds: string[]`. The `singleSelect` prop may need to be added or the component can be used by passing a single-element array and extracting `ids[0]`.

- [ ] **7.2** Modify `HotspotProperties.tsx` `ActionEditor` for `examine` action — replace `WordDropdown` with `CollectibleWordsEditor`:

```tsx
case 'examine':
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <LocalizedTextInput label="내용" value={action.content} onChange={v => onChange({ ...action, content: v })} multiline />
      <LocalizedTextInput label="제목 (선택)" value={action.title ?? { ko: '', en: '' }} onChange={v => onChange({ ...action, title: v })} />
      <CollectibleWordsEditor
        caseId={caseId}
        collectibleWords={action.collectibleWords ?? []}
        onChange={collectibleWords => onChange({ ...action, collectibleWords })}
      />
    </div>
  );
```

- [ ] **7.3** For `examine_image` action — remove the `WordDropdown` (no more `wordIds`). The inner hotspots handle word collection for images:

```tsx
case 'examine_image':
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field label="이미지 에셋 ID">
        <input type="text" value={action.image} onChange={e => onChange({ ...action, image: e.target.value })} style={{ width: '100%' }} />
      </Field>
      <LocalizedTextInput label="캡션 (선택)" value={action.caption ?? { ko: '', en: '' }} onChange={v => onChange({ ...action, caption: v })} />
      <InnerHotspotEditor
        caseId={caseId}
        innerHotspots={action.innerHotspots ?? []}
        onChange={innerHotspots => onChange({ ...action, innerHotspots })}
      />
    </div>
  );
```

- [ ] **7.4** Verify: Editor builds cleanly, examine action shows collectible words editor.

**Commit message:** `feat(editor): CollectibleWordsEditor for interactive word collection in examine actions`

---

## Task 8: InnerHotspot Editor

**File:** `packages/editor/src/components/properties/InnerHotspotEditor.tsx` (NEW)
**Also:** `packages/editor/src/components/properties/HotspotProperties.tsx` (already wired in Task 7.3)
**Acceptance:** For examine_image actions, authors can add/edit/delete inner hotspots with area, action type, and action properties.

- [ ] **8.1** Create `InnerHotspotEditor.tsx`:

```tsx
import React from 'react';
import type { Hotspot, HotspotAction, HotspotArea, LocalizedText } from '@gi-engine/core';

interface InnerHotspotEditorProps {
  caseId: string;
  innerHotspots: Hotspot[];
  onChange: (hotspots: Hotspot[]) => void;
}

export function InnerHotspotEditor({
  caseId,
  innerHotspots,
  onChange,
}: InnerHotspotEditorProps): React.ReactElement {
  // Each inner hotspot has: id, area (rect %), action, cursor, ariaLabel
  // Support action types: word_reveal, examine, navigate, toggle_layer

  const addHotspot = () => {
    const id = `inner_hs_${Date.now()}`;
    const newHs: Hotspot = {
      id,
      area: { type: 'rect', x: 10, y: 10, width: 20, height: 20 },
      action: { type: 'word_reveal', wordIds: [] },
      cursor: 'pointer',
      ariaLabel: { ko: '', en: '' },
    };
    onChange([...innerHotspots, newHs]);
  };

  const updateHotspot = (index: number, patch: Partial<Hotspot>) => {
    const updated = innerHotspots.map((h, i) =>
      i === index ? { ...h, ...patch } : h
    );
    onChange(updated);
  };

  const removeHotspot = (index: number) => {
    onChange(innerHotspots.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={labelStyle}>내부 핫스팟 ({innerHotspots.length})</div>
      {innerHotspots.map((hs, i) => (
        <InnerHotspotItem
          key={hs.id}
          hotspot={hs}
          caseId={caseId}
          onUpdate={patch => updateHotspot(i, patch)}
          onDelete={() => removeHotspot(i)}
        />
      ))}
      <button onClick={addHotspot} style={addBtnStyle}>+ 내부 핫스팟 추가</button>
    </div>
  );
}
```

Implementation details for `InnerHotspotItem`:
- Collapsible card showing hotspot ID and action type
- Area editor: x%, y%, width%, height% (percentage-based, relative to image)
- Action type selector (word_reveal, examine, navigate, toggle_layer)
- Action-specific property editor (reuse the `ActionEditor` pattern from `HotspotProperties.tsx`, but without the `scene` prop since inner hotspots don't have scene context for layer/navigate selection — use text inputs for IDs instead)
- AriaLabel localized text input
- Delete button

- [ ] **8.2** Ensure all action types are supported in inner hotspot action editor:
  - `word_reveal`: WordDropdown for wordIds, optional feedback text
  - `examine`: content text, title (opens a nested text popup — recursive)
  - `navigate`: targetSceneId text input, transition selector
  - `toggle_layer`: layerId text input, visibility selector

- [ ] **8.3** Verify: Editor builds cleanly, examine_image action shows inner hotspot list, can add/remove inner hotspots.

**Commit message:** `feat(editor): InnerHotspotEditor for managing inner hotspots in examine_image actions`

---

## Task 9: Tests

### 9a: Update existing test file

**File:** `packages/core/tests/state-machine-examine-words.test.ts`
**Acceptance:** Tests updated to use `collectibleWords` instead of `wordIds`; existing tests pass.

- [ ] **9a.1** Update test game definition: change `wordIds: ['word-a', 'word-b']` on examine hotspot to `collectibleWords: [{ wordId: 'word-a', textMatch: { ko: '단어A', en: 'WordA' } }, { wordId: 'word-b', textMatch: { ko: '단어B', en: 'WordB' } }]`

- [ ] **9a.2** Update test game definition: remove `wordIds` from `examine_image` hotspot.

- [ ] **9a.3** Update assertions: examine action should no longer auto-collect words. The sub-state should include `collectibleWords` array.

- [ ] **9a.4** Remove/update tests that assert words are auto-collected on HOTSPOT_CLICK for examine actions.

### 9b: New test file for interactive collection

**File:** `packages/core/tests/state-machine-collectible-words.test.ts` (NEW)

- [ ] **9b.1** Test: `COLLECT_WORD_IN_POPUP` while in `examining_text` sub-state adds word to collectedWordIds, does NOT change sub-state, returns `word_collected_in_popup` effect.

- [ ] **9b.2** Test: `COLLECT_WORD_IN_POPUP` for already-collected word returns effect but no save change.

- [ ] **9b.3** Test: `COLLECT_WORD_IN_POPUP` while in `idle` sub-state is ignored (noTransition).

- [ ] **9b.4** Test: `INNER_HOTSPOT_CLICK` with `word_reveal` action while in `examining_image` collects words, stays in `examining_image`, returns `word_collected_in_popup` effects.

- [ ] **9b.5** Test: `INNER_HOTSPOT_CLICK` with `word_reveal` for already-collected words returns effects but no save change, stays in `examining_image`.

- [ ] **9b.6** Test: `INNER_HOTSPOT_CLICK` with non-`word_reveal` action (e.g., `examine`) changes sub-state away from `examining_image` (delegates to handleHotspotAction).

- [ ] **9b.7** Run: `cd packages/core && npx vitest run` — all tests pass.

**Commit message:** `test(core): add tests for interactive word collection in popups`

---

## Task 10: Build Validation

- [ ] **10.1** Run full TypeScript check: `npx tsc --noEmit -p packages/core/tsconfig.json`
- [ ] **10.2** Run full TypeScript check: `npx tsc --noEmit -p packages/runtime/tsconfig.json`
- [ ] **10.3** Run full TypeScript check: `npx tsc --noEmit -p packages/editor/tsconfig.json`
- [ ] **10.4** Run all tests: `npx vitest run`
- [ ] **10.5** Verify no regressions in existing state-machine tests: `npx vitest run packages/core/tests/`
- [ ] **10.6** Manual smoke test: Load a game with examine hotspots. Click hotspot, verify text popup shows clickable words. Click word, verify it highlights as collected and toast appears. Close popup, reopen — verify word shows as already collected.

**Commit message:** `chore: verify build and test pass for interactive word collection`

---

## Dependency Order

```
Task 1 (CSS)            ──────────────────────────────────────> independent, do first
Task 2 (types)          ──> Task 3 (state machine) ──> Task 4 (popup renderer) ──> Task 5 (renderer)
Task 2 (types)          ──> Task 7 (CollectibleWordsEditor) ──> Task 8 (InnerHotspotEditor)
                            Task 6 (SubPuzzleEditor) ─────────> independent of 2-5
Task 9 (tests)          ──> depends on Tasks 2, 3
Task 10 (validation)    ──> depends on all above
```

Parallelizable groups:
- **Group A** (no dependencies): Task 1, Task 6
- **Group B** (depends on Task 2): Tasks 3, 7 can start simultaneously
- **Group C** (depends on Task 3): Tasks 4, 5, 8, 9
- **Final**: Task 10

---

## Migration Note

Existing game definitions that use `wordIds` on `ExamineAction` or `ExamineImageAction` will need a data migration. The executor should:
1. Search all `.json` game definition files for `"wordIds"` inside examine/examine_image actions
2. Convert each `wordIds: ["word-a"]` to `collectibleWords: [{ wordId: "word-a", textMatch: { ko: "word-a", en: "word-a" } }]` (textMatch will need manual curation by game authors)
3. For `examine_image` actions, remove `wordIds` entirely (words collected via inner hotspots)
4. Consider adding a backward-compat shim in the state machine that reads legacy `wordIds` and treats them as auto-collected (optional, for gradual migration)
