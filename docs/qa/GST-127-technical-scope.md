# GST-127 Technical Scope: Quick Create Input Quality and Generation Tracking

**Date:** 2026-04-10  
**Owner:** CTO (preliminary scoping)  
**Related:** Phase B-2 Workstream C (`docs/superpowers/plans/2026-04-01-phaseb2-editor-ux-improvements.md`)

---

## Overview

Improve Quick Create UX to help users write better prompts and understand generation progress. This covers:
- C1: Input quality and confidence (prompts, templates, locale)
- C2: Generation transparency (progress, phases, retry)
- C3: Safe apply flow (impact summary before commit)

---

## Technical Analysis

### Current State

Looking at the existing Quick Create implementation:

**Existing components:**
- `packages/editor/src/components/quick-create/` — QuickCreateModal, QuickCreateForm
- `packages/editor/src/store/quick-create-slice.ts` — state management
- AI generation via `@gi-engine/ai` package

**Gaps:**
- No prompt quality hints or templates
- No phase labels during generation
- No retry path that preserves previous input
- No impact summary before apply

---

## Implementation Approach

### C1: Input Quality and Confidence

#### 1. Prompt Quality Hints

**File:** `packages/editor/src/components/quick-create/QuickCreateForm.tsx`

Add contextual hints below the prompt textarea:
- "Include: victim, location, motive for better results"
- Dynamic hints based on selected type (scene, case, puzzle)

```tsx
const PROMPT_HINTS = {
  scene: "Include: victim, location, motive for better results",
  case: "Specify: number of scenes, difficulty, genre",
  puzzle: "Define: puzzle mechanics, word categories"
};
```

#### 2. Starter Templates

**File:** `packages/editor/src/components/quick-create/templates.ts`

```typescript
export interface QuickCreateTemplate {
  id: string;
  label: string;
  genre?: string;
  prompt: string;
}

export const SCENE_TEMPLATES: QuickCreateTemplate[] = [
  { id: 'crime-scene', label: 'Crime Scene', genre: 'detective', 
    prompt: 'A murder at a {location}. {victim} has been found {condition}.' },
  // ... more templates
];
```

#### 3. Locale Selector

Add explicit locale dropdown when multi-locale is enabled.

---

### C2: Generation Transparency

#### 1. Phase Labels

**File:** `packages/editor/src/components/quick-create/QuickCreateModal.tsx`

Current: Progress bar only
Improved: Phase labels with expected durations

```typescript
const GENERATION_PHASES = [
  { id: 'outline', label: 'Creating outline...', duration: '2-3s' },
  { id: 'scenes', label: 'Generating scenes...', duration: '5-10s' },
  { id: 'assets', label: 'Optimizing assets...', duration: '3-5s' },
];
```

#### 2. Retry Path

When generation fails:
- Preserve the previous prompt and options
- Show error message with specific reason
- "Try again" button re-runs with same input
- "Edit and retry" allows modifying without losing context

#### 3. Edit Before Apply

**File:** `packages/editor/src/components/quick-create/ReviewCard.tsx` (new)

Before applying generated content, show a summary card:
- New case/scene title
- Number of scenes/words/sub-puzzles
- Assets to be generated vs reused

---

### C3: Safe Apply Flow

Add an impact summary step:

```typescript
interface ImpactSummary {
  title: string;
  sceneCount: number;
  wordCount: number;
  puzzleCount: number;
  newAssets: AssetRef[];
  reusedAssets: AssetRef[];
}
```

---

## File Changes

### New Files
- `packages/editor/src/components/quick-create/templates.ts` — starter templates
- `packages/editor/src/components/quick-create/ReviewCard.tsx` — impact summary

### Modified Files
- `packages/editor/src/components/quick-create/QuickCreateForm.tsx` — add hints, templates
- `packages/editor/src/components/quick-create/QuickCreateModal.tsx` — phase labels, retry

---

## Implementation Order

1. **Step 1:** Add prompt quality hints to form
2. **Step 2:** Create templates.ts with starter templates
3. **Step 3:** Wire templates into QuickCreateForm
4. **Step 4:** Add phase labels to generation modal
5. **Step 5:** Implement retry path preserving previous input
6. **Step 6:** Create ReviewCard component
7. **Step 7:** Wire impact summary before apply

---

## Acceptance Criteria

- [ ] Prompt textarea shows contextual hints based on selected type
- [ ] Users can select from starter templates grouped by genre
- [ ] Generation progress shows phase labels (not just progress bar)
- [ ] Failed generation preserves input for retry
- [ ] Impact summary shows before applying generated content
- [ ] Locale selector appears when multi-locale is enabled
