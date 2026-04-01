# Phase B-2 Editor UX Improvements Plan

Date: 2026-04-01  
Owner: UI/UX Designer  
Related issue: [FADAA-70](/FADAA/issues/FADAA-70)

## Goal

Turn the current editor UX audit into an implementation-ready plan focused on:

- layout and navigation clarity,
- keyboard productivity,
- Quick Create quality,
- Word Manager usability,
- accessibility readiness.

## Workstream A: Layout Improvements

### A1. Flexible panel behavior

- Add panel collapse toggles for left and right sidebars.
- Persist user panel widths/collapse state in UI store.
- Add one-click "focus mode" for canvas/puzzle work.

Acceptance criteria:

- User can hide/show each side panel without losing context.
- Returning to editor restores last panel layout state.
- Focus mode can be toggled without leaving current selection.

### A2. Properties panel information architecture

- Keep current section collapse model and standardize it across Scene/Case/Hotspot panels.
- Introduce sticky section headers inside long property forms.
- Surface "jump to section" mini index for long forms.

Acceptance criteria:

- Long property forms require less scroll hunting.
- Section order and naming remain consistent across entity types.

## Workstream B: Keyboard Shortcuts Expansion

### B1. Baseline consistency fix

- Implement `Ctrl/Cmd+N` to match toolbar label.

### B2. Productivity shortcut set

Proposed mappings:

- `Ctrl/Cmd+1` `Ctrl/Cmd+2` `Ctrl/Cmd+3` `Ctrl/Cmd+4`: switch primary center tabs.
- `Alt+Left` / `Alt+Right`: previous/next scene in selected case.
- `F2`: rename selected tree node.
- `Delete`: delete selected hotspot/layer/asset with confirmation.
- `?` or `Ctrl/Cmd+/`: open shortcut help overlay.

Acceptance criteria:

- All shortcuts are documented in one in-app cheat sheet.
- Shortcuts do not fire when text input/textarea has focus (unless intended).
- E2E tests cover baseline command behavior.

## Workstream C: Quick Create UX Checklist

### C1. Input quality and confidence

- Add prompt quality hints ("include victim, location, motive signal").
- Add starter templates grouped by genre.
- Add explicit locale selector when needed.

### C2. Generation transparency

- Keep progress bar; add phase labels with expected durations.
- Add retry path that preserves previous sentence/options.
- Add "edit before apply" checkpoint summary card.

### C3. Safe apply flow

- Before apply, show impact summary:
  - new case title,
  - number of scenes/words/sub-puzzles,
  - assets to be generated or reused.

Acceptance criteria:

- Users can recover from failed generation without retyping core prompt.
- Users can understand generated scope before committing to editor state.

## Workstream D: Word Manager UX Improvements

### D1. Faster filtering and review

- Add sortable columns (word, category, usage count).
- Add "connected only / unconnected only" quick filter.
- Add one-click jump from usage chip to target scene/hotspot.

### D2. Bulk operations and safety

- Improve bulk delete dialog with impact preview:
  - words selected,
  - hotspot references that will be affected.
- Add "replace category" and "append tag" batch actions.

### D3. Density and readability

- Keep compact row mode, add optional comfortable mode toggle.
- Align status chips and badges to consistent tokenized colors.

Acceptance criteria:

- Common vocabulary maintenance tasks can be completed without leaving panel.
- Reference impact is visible before destructive operations.

## Workstream E: Accessibility Priority Plan (a11y)

### P0 (must-fix before release)

- Keyboard-only operation for all primary workflows.
- Visible focus rings on all interactive elements.
- ARIA labels/roles for custom controls (tab bars, chips, custom dropdowns).

### P1 (next release)

- Contrast audit across all token and state combinations.
- Error and success message regions announced to screen readers.
- Reduced motion support for non-essential animations.

### P2 (quality hardening)

- Landmarks and heading structure normalization.
- Shortcuts remapping support and preference persistence.
- Assistive text for advanced editor modes (scene tools, AI actions).

Acceptance criteria:

- Key flows pass manual keyboard and screen reader smoke tests.
- Accessibility checklist is integrated into QA handoff.

## Delivery Sequence

1. Workstream B1+B2 baseline (`Ctrl+N`, shortcut overlay, tab switching).
2. Workstream A1 layout controls and persistence.
3. Workstream D1 Word Manager jump/filter improvements.
4. Workstream C Quick Create confidence and recoverability improvements.
5. Workstream E P0 accessibility pass, then P1 hardening.

## QA Handoff Checklist

- Verify all new shortcuts on Windows and macOS.
- Validate no shortcut conflict inside text fields.
- Confirm panel layout persistence after reload.
- Validate Word Manager jump links open the correct scene/hotspot.
- Run keyboard-only traversal for toolbar, tabs, tree, canvas, properties, and modals.
