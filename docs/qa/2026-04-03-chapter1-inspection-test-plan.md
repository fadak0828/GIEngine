# QA Test Plan — FADAA-163: Chapter 1 Inspection Scenarios vs Development Log Audit Trail

**Date**: 2026-04-03
**Issue**: [FADAA-163](/FADAA/issues/FADAA-163)
**Status**: Draft
**Priority**: P1
**Packages**: `@gi-engine/core`, `@gi-engine/runtime`, `@gi-engine/exporter`
**Test Environment**: Chrome 90+, Firefox 90+, Safari 15+, Edge 90+

---

## 1. Overview

### 1.1 Objective
Create a comprehensive test plan for Chapter 1 (Case 1: "The Manor's Secret") inspection scenarios and verify that the development log audit trail correctly captures all user interactions and system events.

### 1.2 Scope

| Category | Covered |
|----------|---------|
| Exploration Mode | Hotspot interactions, word collection, scene navigation, visit marking |
| Examination Mode | Text popup, image popup, composite actions |
| Transition/Animation | Scene transitions, mode switches, puzzle completion |
| Audit Trail | Development log captures all interactions |

### 1.3 Out of Scope
- E2E tests (handled separately)
- Performance testing
- Accessibility testing (covered in separate test plan)

---

## 2. Test Scenarios

### 2.1 Exploration Mode Tests

#### 2.1.1 Hotspot Interaction Tests

| Test ID | TC-EXP-001 |
|---------|------------|
| **Title** | Examine text hotspot displays popup |
| **Preconditions** | Player is on scene-living-room |
| **Steps** | 1. Click on hs-examine-letter hotspot |
| **Expected** | Popup displays with title "Letter" and Korean/English content |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.2, Action type `examine` |

| Test ID | TC-EXP-002 |
|---------|------------|
| **Title** | Word reveal hotspot adds word to word bank |
| **Preconditions** | Player is on scene-living-room, word-knife not collected |
| **Steps** | 1. Click on hs-word-knife hotspot |
| **Expected** | Word "knife"/"칼" appears in word bank with visual feedback |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.3, Action type `word_reveal` |

| Test ID | TC-EXP-003 |
|---------|------------|
| **Title** | Collected words are visually distinguished |
| **Preconditions** | word-knife was previously collected |
| **Steps** | 1. Revisit scene-living-room 2. Observe hs-word-knife hotspot |
| **Expected** | Hotspot shows collected state (underline/color change) |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 3.2.3, "이미 수집한 단어는 탐색 시 시각적으로 구분" |

| Test ID | TC-EXP-004 |
|---------|------------|
| **Title** | Conditional hotspot appears when layer visible |
| **Preconditions** | Player has NOT opened drawer |
| **Steps** | 1. Attempt to click hs-word-study-from-drawer |
| **Expected** | Hotspot not visible or not interactive |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.2, `VisibilityCondition` type `layer_visible` |

| Test ID | TC-EXP-005 |
|---------|------------|
| **Title** | Conditional hotspot visible after layer toggle |
| **Preconditions** | Drawer layer is hidden |
| **Steps** | 1. Click hs-drawer-toggle 2. Click hs-word-study-from-drawer |
| **Expected** | Layer-drawer-open becomes visible, then word-study is revealed |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.2, `toggle_layer` action + `layer_visible` condition |

#### 2.1.2 Navigation Tests

| Test ID | TC-EXP-010 |
|---------|------------|
| **Title** | Navigate to another scene |
| **Preconditions** | Player is on scene-living-room |
| **Steps** | 1. Click hs-navigate-study hotspot |
| **Expected** | Scene transitions to scene-study with slide_left animation |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.1, `navigate` action |

| Test ID | TC-EXP-011 |
|---------|------------|
| **Title** | Navigation back to previous scene |
| **Preconditions** | Player is on scene-study |
| **Steps** | 1. Click hs-navigate-living-room hotspot |
| **Expected** | Scene transitions back with slide_right animation |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.1, bidirectional navigation |

| Test ID | TC-EXP-012 |
|---------|------------|
| **Title** | Scene visit marking |
| **Preconditions** | Player visits scene-study for first time |
| **Steps** | 1. Navigate to scene-study |
| **Expected** | scene-study is marked as visited in SaveState |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 4.8, `visitedSceneIds` |

#### 2.1.3 Composite Action Tests

| Test ID | TC-EXP-020 |
|---------|------------|
| **Title** | Composite action executes sequentially |
| **Preconditions** | Player is on scene-living-room |
| **Steps** | 1. Click hs-word-secretary-kim hotspot (composite) |
| **Expected** | First word-secretary-kim is collected, then examine popup shows |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.2, `composite` action type |

---

### 2.2 Examination Mode Tests

#### 2.2.1 Text Popup Tests

| Test ID | TC-EXM-001 |
|---------|------------|
| **Title** | Text popup displays with correct locale |
| **Preconditions** | Game locale is set to 'ko' |
| **Steps** | 1. Click examine hotspot 2. Observe popup |
| **Expected** | Popup displays Korean text content |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 8, i18n LocalizedText |

| Test ID | TC-EXM-002 |
|---------|------------|
| **Title** | Text popup closes on backdrop click |
| **Preconditions** | Text popup is open |
| **Steps** | 1. Click outside popup (backdrop) |
| **Expected** | Popup closes, return to exploring state |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 6.3.1, overlay behavior |

| Test ID | TC-EXM-003 |
|---------|------------|
| **Title** | Highlighted words in examine text are clickable |
| **Preconditions** | Examine popup has highlightedWords defined |
| **Steps** | 1. Open examine popup 2. Click on highlighted word |
| **Expected** | Word is collected and added to word bank |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.2, `highlightedWords` property |

#### 2.2.2 Layer Toggle Tests

| Test ID | TC-EXM-010 |
|---------|------------|
| **Title** | Layer becomes visible on toggle |
| **Preconditions** | layer-drawer-open is hidden |
| **Steps** | 1. Click hs-drawer-toggle 2. Observe scene |
| **Expected** | layer-drawer-open becomes visible (drawer opens) |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.2, `toggle_layer` action |

| Test ID | TC-EXM-011 |
|---------|------------|
| **Title** | Layer hides on second toggle |
| **Preconditions** | layer-drawer-open is currently visible |
| **Steps** | 1. Click hs-drawer-toggle again |
| **Expected** | layer-drawer-open becomes hidden (drawer closes) |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 3.2.2, toggle behavior |

---

### 2.3 Transition/Animation Tests

#### 2.3.1 Scene Transition Tests

| Test ID | TC-TRS-001 |
|---------|------------|
| **Title** | Scene transition with slide_left animation |
| **Preconditions** | Player is on scene-living-room |
| **Steps** | 1. Navigate to scene-study |
| **Expected** | Transition animation is slide_left, duration < 300ms |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 9.1, "장면 전환 < 300ms" |

| Test ID | TC-TRS-002 |
|---------|------------|
| **Title** | Scene transition with slide_right animation |
| **Preconditions** | Player is on scene-study |
| **Steps** | 1. Navigate to scene-living-room |
| **Expected** | Transition animation is slide_right |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 3.2.1, "transition" property |

#### 2.3.2 Mode Transition Tests

| Test ID | TC-TRS-010 |
|---------|------------|
| **Title** | Transition from exploring to thinking mode |
| **Preconditions** | Player is exploring case-1 |
| **Steps** | 1. Click puzzle button/access puzzle |
| **Expected** | UI transitions to thinking mode with puzzle displayed |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 5.1, state machine `open_puzzle` event |

| Test ID | TC-TRS-011 |
|---------|------------|
| **Title** | Transition from thinking to exploring mode |
| **Preconditions** | Player is in thinking mode |
| **Steps** | 1. Click back/close puzzle |
| **Expected** | Returns to exploring mode at same scene |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 5.1, state machine `close_puzzle` event |

#### 2.3.3 Puzzle Completion Animation

| Test ID | TC-TRS-020 |
|---------|------------|
| **Title** | Puzzle completion triggers completion screen |
| **Preconditions** | All puzzle slots are correctly filled |
| **Steps** | 1. Submit puzzle 2. Observe |
| **Expected** | Green feedback on all slots, completion animation plays |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.3.3, "모든 슬롯이 초록이면 퍼즐 완료" |

---

### 2.4 Audit Trail / Development Log Tests

#### 2.4.1 Interaction Logging

| Test ID | TC-AUD-001 |
|---------|------------|
| **Title** | Hotspot click is logged |
| **Preconditions** | Debug mode enabled |
| **Steps** | 1. Click any hotspot 2. Check development log |
| **Expected** | Log entry: { event: 'HOTSPOT_CLICK', hotspotId, sceneId, timestamp } |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 6, debug mode requirements |

| Test ID | TC-AUD-002 |
|---------|------------|
| **Title** | Word collection is logged |
| **Preconditions** | Debug mode enabled |
| **Steps** | 1. Click word reveal hotspot 2. Check development log |
| **Expected** | Log entry: { event: 'WORD_COLLECTED', wordId, caseId, timestamp } |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 6, debug mode requirements |

| Test ID | TC-AUD-003 |
|---------|------------|
| **Title** | Scene navigation is logged |
| **Preconditions** | Debug mode enabled |
| **Steps** | 1. Navigate between scenes 2. Check development log |
| **Expected** | Log entry: { event: 'NAVIGATE_SCENE', fromSceneId, toSceneId, timestamp } |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 6, debug mode requirements |

| Test ID | TC-AUD-004 |
|---------|------------|
| **Title** | Puzzle validation is logged |
| **Preconditions** | Debug mode enabled |
| **Steps** | 1. Open puzzle 2. Submit answers 3. Check development log |
| **Expected** | Log entry: { event: 'VALIDATE_PUZZLE', puzzleId, slotAssignments, result, timestamp } |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 6, debug mode requirements |

#### 2.4.2 State Change Logging

| Test ID | TC-AUD-010 |
|---------|------------|
| **Title** | Game state transitions are logged |
| **Preconditions** | Debug mode enabled |
| **Steps** | 1. Perform actions that change game state 2. Check development log |
| **Expected** | Log entries for each state change: { event: 'STATE_CHANGE', fromState, toState, trigger, timestamp } |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 5, state machine events |

| Test ID | TC-AUD-011 |
|---------|------------|
| **Title** | Save/load operations are logged |
| **Preconditions** | Debug mode enabled, auto-save interval reached |
| **Steps** | 1. Wait for auto-save 2. Check development log |
| **Expected** | Log entry: { event: 'AUTO_SAVE', saveState snapshot, timestamp } |
| **Priority** | P2 |
| **Traceability** | GIEngine Spec 4.8, SaveState management |

---

### 2.5 Word Bank Tests

| Test ID | TC-WRD-001 |
|---------|------------|
| **Title** | Collected words appear in word bank |
| **Preconditions** | Player collected word-knife |
| **Steps** | 1. Open word bank panel |
| **Expected** | word-knife is displayed with Korean/English text |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.2.3, word bank management |

| Test ID | TC-WRD-002 |
|---------|------------|
| **Title** | Word categories are displayed |
| **Preconditions** | Words have categories defined |
| **Steps** | 1. Open word bank panel 2. Observe categories |
| **Expected** | Words are grouped or labeled by category (person, place, object, etc.) |
| **Priority** | P1 |
| **Traceability** | GIEngine Spec 4.5, WordCategory types |

| Test ID | TC-WRD-003 |
|---------|------------|
| **Title** | Word bank persists across scenes |
| **Preconditions** | Player collected words in scene-living-room |
| **Steps** | 1. Navigate to scene-study 2. Open word bank |
| **Expected** | Previously collected words are still present |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 4.8, SaveState `collectedWordIds` |

---

### 2.6 Save/Load Tests

| Test ID | TC-SAV-001 |
|---------|------------|
| **Title** | Game progress auto-saves |
| **Preconditions** | Player made progress (collected words, visited scenes) |
| **Steps** | 1. Wait for autoSaveInterval 2. Check localStorage |
| **Expected** | SaveState is persisted with current progress |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 4.8, 3.4.2, auto-save |

| Test ID | TC-SAV-002 |
|---------|------------|
| **Title** | Game restores on page reload |
| **Preconditions** | Game has saved progress |
| **Steps** | 1. Reload page 2. Observe game state |
| **Expected** | Game restores to previous position, word bank, scene |
| **Priority** | P0 |
| **Traceability** | GIEngine Spec 3.4.2, "새로고침 시 복원" |

---

## 3. Test Execution Matrix

| Priority | Test Count | Required for Sign-off |
|----------|------------|----------------------|
| P0 | 15 | Yes |
| P1 | 14 | Yes |
| P2 | 2 | No |

**Minimum Pass Rate**: All P0 and P1 tests must pass for feature sign-off.

---

## 4. Test Environment Setup

### 4.1 Prerequisites
- Node.js 18+
- npm workspaces
- Chrome 90+, Firefox 90+, Safari 15+, Edge 90+

### 4.2 Test Commands
```bash
# Type check
npm run typecheck

# Unit tests
npm run test --workspace=@gi-engine/core
npm run test --workspace=@gi-engine/runtime

# Build
npm run build

# E2E tests (separate)
npm run test:e2e
```

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scene transition animation timing | Medium | Low | Verify < 300ms requirement with performance tests |
| LocalStorage quota exceeded | Low | Medium | Test with minimal storage, verify graceful handling |
| Multi-language fallback issues | Medium | High | Test all text with missing translations |

---

## 6. Appendix

### 6.1 Related Documents
- [GI Engine Specification](/docs/specs/2026-03-29-gi-engine.md)
- [Runtime Render Fixes QA Report](/docs/qa/2026-03-30-runtime-render-fixes-qa-report.md)

### 6.2 Glossary
- **Hotspot**: Interactive area in a scene
- **Word Bank**: Collection of gathered words for puzzle solving
- **Slot**: Blank in puzzle template where words are placed
- **Validation**: Process of checking puzzle answers

---

**Test Plan Created**: 2026-04-03
**Last Updated**: 2026-04-03
**Author**: QA Engineer