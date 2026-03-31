# GIEngine Project Analysis

**Date:** 2026-03-31  
**Author:** CEO  
**Status:** current-state review

---

## Executive Summary

GIEngine already has the shape of a real product, not a prototype pile. The repository is organized around a sensible package split, the core gameplay logic is heavily tested, and the exporter/runtime path supports the right end-state: shipping a standalone investigation game as a single HTML file.

The main weakness is not product direction. It is operational consistency. The codebase currently passes `npm test` and `npm run typecheck`, but `npm run build` does not complete from a clean root invocation. Complexity is also concentrating into a few large files in the core state machine and the editor store, which will slow future feature work unless that pressure is reduced now.

---

## What Exists Today

### Package Structure

- `packages/core`
  - Shared domain model, state machine, validation, i18n, and save-state primitives.
- `packages/editor`
  - React 19 + Zustand authoring tool for scenes, words, hotspots, puzzles, and exports.
- `packages/runtime`
  - Browser runtime that renders scenes, handles input, audio, drag/drop, and save flow.
- `packages/exporter`
  - Single-file HTML bundling path with asset inlining and bundle-size reporting.
- `packages/ai`
  - Gemini-based text/image generation helpers for authoring workflows.

### Product Direction

- The repo has a clear product thesis: a Golden Idol-style editor plus runtime, with standalone export as a core differentiator.
- A design system exists in `DESIGN.md`, which is a positive sign that the editor is being treated as a real product surface.
- Documentation already covers specs, designs, reviews, QA, and feature plans, which means the team is not shipping blindly.

---

## Verified Repository Signals

### Green

- `npm test`
  - Passed across all configured workspaces.
  - 289 tests passed total:
    - core: 90
    - editor: 140
    - exporter: 52
    - runtime: 7
- `npm run typecheck`
  - Passed at the root.

### Red

- `npm run build`
  - Does not currently complete from the root.
  - Confirmed failures:
    - `@gi-engine/editor` test typings are out of sync with the current `SelectionState` shape after `subPuzzleId` became required.
    - `@gi-engine/ai` has no `build` script, but the root workspace build expects one.

### Important Context

- The worktree is active and already contains ongoing editor/core/runtime changes.
- That is normal for current feature work, but it increases the need for a stable repo-wide validation path.

---

## Strengths

### 1. The package boundaries are mostly correct

The separation between core rules, editor tooling, runtime rendering, exporter logic, and AI helpers is the right long-term architecture. It creates a clean place for shared types and reduces the chance that editor concerns leak directly into the runtime.

### 2. Core gameplay logic is already defended by tests

The highest-risk product surface is the deduction/state logic. That area has the strongest automated coverage, which is the right allocation of testing effort at this stage.

### 3. The exporter is aligned with the product thesis

Single-file export is not a side feature here. It is one of the product's sharpest edges. The current exporter already validates structure, inlines assets, and emits standalone HTML, which is a strong foundation.

### 4. The editor has a coherent UX direction

The design system gives the project a recognizable identity and a set of constraints. That matters because editor products rot quickly when visual decisions are made ad hoc.

---

## Risks and Friction

### 1. Release hygiene is weaker than feature velocity

The biggest immediate problem is that the root build is not trustworthy yet. A repo that tests green but fails the normal build command will create avoidable friction every time work crosses package boundaries.

### 2. Complexity is concentrating into a few files

Current hotspots:

- `packages/core/src/state/state-machine.ts`: 828 lines
- `packages/editor/src/store/editor-store.ts`: 817 lines
- `packages/runtime/src/engine.ts`: 425 lines

These files are not automatically bad, but they are becoming the default integration points for new work. That usually leads to slower feature delivery, harder reviews, and regression risk.

### 3. Workspace scripts are inconsistent

- `test` exists and works across workspaces.
- `build` is inconsistent because not every workspace participates cleanly.
- `lint` only targets `packages/*/src/**/*.ts`.

That means the current lint path misses:

- `.tsx` files
- tests
- scripts
- non-`src` TypeScript files

### 4. The AI package is strategically useful but operationally thin

`packages/ai` is currently a thin vendor-specific wrapper around Gemini. That is fine for proving value, but not yet strong enough for a durable product layer. Specific concerns:

- no build script
- no dedicated tests
- tight provider coupling
- browser-local secret handling as the primary path

### 5. Documentation is rich but fragmented

There is already a lot of documentation, but the structure is spread across `specs`, `designs`, `reviews`, `qa`, and `superpowers`. Without a clear top-level map, onboarding and navigation costs will rise as the doc set grows.

---

## Strategic Reading

GIEngine is in a good position if the next cycle focuses on operational hardening rather than only adding features.

The product thesis is viable.

The architecture is viable.

The team is documenting and testing enough to scale.

But the repo is at the point where reliability work will compound. If that work is deferred, every additional feature will cost more to integrate than it should.

---

## Recommended Priority Order

1. Make root-level build/test/lint trustworthy on a clean checkout.
2. Break the editor store and state-machine growth into smaller ownership units.
3. Harden export/runtime validation with smoke checks for the standalone HTML promise.
4. Turn the AI package from an experiment wrapper into a product-grade integration boundary.
5. Add a top-level documentation map so new contributors can orient quickly.

---

## Bottom Line

GIEngine is not missing vision. It is missing the next layer of engineering discipline that turns a promising toolchain into a durable product platform.
