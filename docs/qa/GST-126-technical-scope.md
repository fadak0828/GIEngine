# GST-126 Technical Scope: Word Manager Filter and Jump Improvements

**Date:** 2026-04-10  
**Owner:** CTO (preliminary scoping)  
**Related:** Phase B-2 Workstream D (`docs/superpowers/plans/2026-04-01-phaseb2-editor-ux-improvements.md`)

---

## Overview

Improve Word Manager usability for faster filtering, review, and bulk operations. This covers:
- D1: Faster filtering and review (sorting, filters, jump)
- D2: Bulk operations and safety (delete preview, batch actions)
- D3: Density and readability (view modes, consistent styling)

---

## Technical Analysis

### Current State

**Existing components:**
- `packages/editor/src/components/words/WordManagerPanel.tsx` — main panel
- `packages/editor/src/components/words/WordRow.tsx` — individual word row
- `packages/editor/src/components/words/WordVocabularyPanel.tsx` — vocabulary UI
- `packages/editor/src/store/` — word-related state slices

**Existing functionality:**
- Word list display
- Basic word CRUD
- Category assignment

**Gaps:**
- No column sorting
- No "connected only / unconnected only" filter
- No jump from word to usage location
- Limited bulk operations
- No density/view mode toggle

---

## Implementation Approach

### D1: Faster Filtering and Review

#### 1. Sortable Columns

**File:** `packages/editor/src/components/words/WordManagerPanel.tsx`

Add column headers that can be clicked to sort:

```typescript
type SortColumn = 'word' | 'category' | 'usageCount' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface WordManagerState {
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}
```

#### 2. Quick Filters

Add filter chips/buttons:

```tsx
const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'connected', label: 'Connected' },
  { id: 'unconnected', label: 'Unconnected' },
];
```

#### 3. Jump to Usage

When clicking a word's usage chip, navigate to:
1. The scene containing the hotspot
2. The specific hotspot that uses the word

```typescript
function jumpToUsage(wordId: string): void {
  // Find hotspot referencing this word
  // Navigate to scene and select hotspot
  useEditorStore.getState().selectScene(sceneId);
  useEditorStore.getState().selectHotspot(hotspotId);
}
```

---

### D2: Bulk Operations and Safety

#### 1. Multi-Select

Add checkbox column to WordRow:

```tsx
interface WordRowProps {
  word: Word;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}
```

#### 2. Bulk Delete with Impact Preview

**File:** `packages/editor/src/components/words/BulkDeleteDialog.tsx` (new)

Before bulk delete, show:
- Number of words selected
- Which hotspots/scenes reference these words
- Impact analysis

```typescript
interface BulkDeleteImpact {
  wordsSelected: number;
  affectedHotspots: Array<{ sceneId: string; hotspotId: string }>;
  affectedWords: string[];
}
```

#### 3. Batch Category Actions

Add "Replace category" and "Append category" for selected words.

---

### D3: Density and Readability

#### 1. View Mode Toggle

```tsx
type ViewMode = 'compact' | 'comfortable';

interface WordManagerViewProps {
  viewMode: ViewMode;
}
```

#### 2. Consistent Status Chips

Standardize colors using design tokens:

```typescript
const CATEGORY_COLORS = {
 人物: '#3b82f6',  // blue
  地点: '#22c55e', // green
  物品: '#f59e0b', // amber
  线索: '#8b5cf6', // violet
};
```

---

## File Changes

### New Files
- `packages/editor/src/components/words/BulkDeleteDialog.tsx` — bulk delete confirmation

### Modified Files
- `packages/editor/src/components/words/WordManagerPanel.tsx` — sorting, filters, view toggle
- `packages/editor/src/components/words/WordRow.tsx` — checkbox, usage chip click handler
- `packages/editor/src/components/words/word-category-constants.ts` — category colors/labels

---

## Implementation Order

1. **Step 1:** Add sortable column headers to WordManagerPanel
2. **Step 2:** Add quick filter chips (All/Connected/Unconnected)
3. **Step 3:** Make usage chips clickable, implement jumpToUsage
4. **Step 4:** Add checkbox column to WordRow
5. **Step 5:** Create BulkDeleteDialog with impact preview
6. **Step 6:** Add batch category actions
7. **Step 7:** Add view mode toggle (compact/comfortable)
8. **Step 8:** Standardize category chip colors

---

## Acceptance Criteria

- [ ] Word list is sortable by word name, category, usage count
- [ ] Quick filters show All/Connected/Unconnected words
- [ ] Clicking usage chip navigates to the hotspot that uses the word
- [ ] Bulk delete shows impact preview before confirming
- [ ] Batch category replace/append works on selected words
- [ ] View mode toggle switches between compact and comfortable views
- [ ] Category chips use consistent tokenized colors
