# Phase B-2 Editor UX Audit

Date: 2026-04-01  
Owner: UI/UX Designer  
Source issue: [FADAA-70](/FADAA/issues/FADAA-70)

## Summary

The editor already has a strong foundation (clear 3-column information architecture, fast direct manipulation on canvas, and robust AI-assisted flows), but there are clear UX quality gaps:

- Keyboard support is partial and inconsistent with visible UI labels.
- Visual language is mostly Warm Industrial, but several surfaces bypass design tokens.
- Drag-and-drop works in key areas, but interaction feedback and cross-panel workflows are still limited.
- The right properties panel is dense and can overload users during content-heavy tasks.

## Scope and Method

- Reviewed current implementation in `packages/editor/src/components` and `packages/editor/src/store`.
- Verified keyboard behavior in `packages/editor/src/App.tsx`.
- Reviewed scene and layer drag interactions in `SceneCanvas`, `useCanvasDrag`, and `LayerPanel`.
- Checked design-token alignment against `DESIGN.md`.
- Reviewed existing editor E2E coverage in `e2e/editor`.

## UX Audit Findings

## 1) Overall UI and Navigation Flow

What works well:

- Clear top-level hierarchy: left tree, center work area, right contextual properties.
- Main tab model is explicit and stateful (`scene`, `assets`, `words`, `puzzle`, `subPuzzle`, `validation`).
- Context-aware properties rendering reduces accidental edits in unrelated panels.
- AI actions are discoverable from the primary toolbar.

Gaps:

- Left tree has no search/filter and no quick-jump for large projects.
- No command palette or global jump pattern for deep editor navigation.
- Properties panel becomes long for scene-heavy and puzzle-heavy tasks, forcing frequent scrolling and context loss.
- Preview visibility defaults to hidden and has low discoverability for first-time users.
- Error prevention for destructive actions is inconsistent (some `confirm`, some immediate actions).

## 2) Warm Industrial Design-System Adherence

Strong alignment:

- Core color tokens and spacing tokens are defined and used in `globals.css`.
- Typeface strategy follows `DESIGN.md` (DM Sans / Instrument Serif / JetBrains Mono).
- Most primary/secondary surfaces map correctly to panel/card/background tokens.

Drift from design system:

- Multiple hard-coded color values remain in component styles (for example bright red/orange and blue-violet accents), which weakens palette consistency.
- `WelcomeScreen` uses utility classes with direct gray/amber values instead of shared tokens.
- Heavy inline style usage makes token governance harder and increases visual drift risk.

## 3) Keyboard Shortcut Status and Improvement Points

Current implemented shortcuts:

- `Ctrl/Cmd+S`: save project.
- `Ctrl/Cmd+Z`: undo.
- `Ctrl/Cmd+Y` and `Ctrl/Cmd+Shift+Z`: redo.
- Enter/Escape handling exists in several inline editors and chat input areas.

Current gaps:

- Toolbar label suggests `Ctrl+N`, but global handler does not implement it.
- No shortcut set for panel switching (`scene`, `assets`, `words`, `puzzle`, etc.).
- No shortcut for next/previous scene navigation.
- No shortcut help overlay (cheat sheet).
- Keyboard traversal inside some custom dropdown/list interactions remains limited.

## 4) Drag-and-Drop Interaction Audit

What works now:

- Hotspot move/resize on canvas is stable and uses pointer capture.
- Layer reordering exists and updates z-order correctly.
- Asset drag-drop upload is implemented and practical.

Improvement points:

- No unified drag language across modules (different visual cues and affordances).
- Layer DnD could use stronger insertion feedback and keyboard equivalent reordering.
- No drag from asset manager into scene/layer targets (high-value direct workflow missing).
- Project tree reordering is not available (acts/cases/scenes only editable by other controls).

## Priority Risks

- High: keyboard/UI mismatch (`Ctrl+N` shown but not wired) reduces trust and learnability.
- High: accessibility and keyboard navigation coverage is still below production expectations.
- Medium: visual token drift from hard-coded colors will increase over time without guardrails.
- Medium: right-panel density slows expert workflows on complex cases.
- Medium: DnD is useful but fragmented; users must remember different interaction rules.

## Recommended Direction

Use the companion proposal as the implementation baseline:  
`docs/superpowers/plans/2026-04-01-phaseb2-editor-ux-improvements.md`
