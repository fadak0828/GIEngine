# GIEngine Improvement Roadmap

**Date:** 2026-03-31  
**Author:** CEO  
**Status:** partially-implemented  
**Last Updated:** 2026-04-08 by CTO

---

## Implementation Status (as of 2026-04-08)

| Phase | Status | Notes |
|-------|--------|-------|
| P1: Repo Contract | 🟡 Partial | ci:check works, build order fixed, AI package still excluded from root build |
| P2: Architecture Pressure | 🟡 Partial | editor-store.ts split into 9 slices (done); engine.ts 554 lines (threshold 600 — not yet exceeded) |
| P3: Authoring Workflow | 🟡 Partial | Word system done; save/load, validation feedback remaining |
| P4: Runtime/Export | 🟢 Done | PreviewPane inlines runtime IIFE; export smoke tests not automated |
| P5: AI Hardening | 🔴 Pending | No build contract or provider abstraction |
| P6: Docs Discoverability | 🟢 Done | docs/index.md created; naming convention established |

### Merged PRs

| PR | Phase | Key Changes |
|----|-------|-------------|
| PR #2 | P1 | test-results/ gitignore; root build order fix |
| PR #3 | P1+P4 | Topological build order; PreviewPane /runtime inline; docs/index.md |
| PR #4 | P1 | fix(exporter): @ts-ignore → @ts-expect-error for Vite ?raw imports |
| PR #5 | P2 | feat(runtime): hotspot hover effect via mouseenter/mouseleave |

### Remaining Blockers

- **Board governance conflict**: Merged PRs stuck in board `in_progress` due to quality gate requiring ci:check evidence. DONE CHECKLIST exempts doc-only changes but board enforcement is inconsistent. See GST-63.
- **AI package**: Excluded from root build; no `build` script. Would need either a real build or explicit exclusion.

---

## Goal

Strengthen GIEngine so the repository is easy to ship, easier to extend, and less dependent on a small number of oversized integration files.

This roadmap is intentionally biased toward compounding work: release hygiene, architecture pressure relief, and product reliability before broad feature expansion.

---

## Phase 1: Stabilize the Repo Contract

**Target:** 1 to 2 days  
**Outcome:** a clean checkout can pass the standard engineering loop.

### Work

- Fix the current root build blockers.
  - Update editor test fixtures for the required `subPuzzleId`.
  - Add a real `build` script for `@gi-engine/ai`, or explicitly exclude it from root build until it is buildable.
- Expand lint coverage beyond `packages/*/src/**/*.ts`.
  - Include `tsx`, tests, and root/scripts TypeScript files.
- Add one canonical validation command for contributors and CI.
  - Example: `npm run ci:check` -> lint + typecheck + test + build.
- Add a short root onboarding/readme document.
  - What the packages are
  - How to run the editor
  - How to export a sample game
  - How to run the full validation loop

### Success Criteria

- `npm test`, `npm run typecheck`, and `npm run build` all pass from the root.
- Lint coverage includes the editor UI code, not just `.ts` files.
- A new contributor can understand the repo entry points in under 10 minutes.

---

## Phase 2: Reduce Architecture Pressure

**Target:** 3 to 5 days  
**Outcome:** feature work stops piling into two or three oversized files.

### Work

- Split `editor-store.ts` into domain-oriented slices.
  - project lifecycle
  - selection/ui state
  - scene editing
  - puzzle editing
  - assets/words
- Extract core state-machine handlers by concern.
  - exploration flow
  - puzzle flow
  - hotspot action execution
  - save-state updates
- Define simple file-size or responsibility thresholds.
  - Not as bureaucracy.
  - As a forcing function against silent monolith growth.
- Add focused tests for each extracted slice/module as part of the split.

### Success Criteria

- No single editor state file or state-machine file remains the default place for unrelated feature additions.
- Reviews can isolate gameplay changes from editor-only changes.
- Regression debugging becomes faster because behavior is more localized.

---

## Phase 3: Harden the Authoring Workflow

**Target:** 3 to 5 days  
**Outcome:** the editor becomes safer and faster for real content creation.

### Work

- Improve project persistence and safety.
  - explicit save/load/open flows
  - unsaved-change warnings
  - recent-project support if the product direction allows it
- Strengthen asset workflows.
  - better asset metadata visibility
  - missing asset surfacing
  - clearer authoring-time validation
- Tighten validation feedback inside the editor.
  - surface broken references before export
  - highlight incomplete puzzle definitions earlier
- Consolidate and polish current in-flight editor UX work instead of starting parallel UI experiments.

### Success Criteria

- Authors can detect invalid project state before export.
- Data-loss risk during editing is materially reduced.
- Editor workflows feel predictable instead of feature-by-feature.

---

## Phase 4: Protect the Runtime and Export Promise

**Target:** 2 to 4 days  
**Outcome:** standalone export becomes a tested product claim, not just an implementation detail.

### Work

- Add smoke tests around sample-game export.
  - export sample game
  - open generated HTML in a browser harness
  - verify first screen loads and core interactions mount
- Remove or reduce exporter fallback ambiguity where practical.
  - make runtime artifact expectations explicit
  - distinguish expected placeholder behavior from accidental fallback
- Add bundle-budget reporting gates for exported games and runtime assets.
- Verify runtime behavior under realistic browser/device assumptions, not only unit tests.

### Success Criteria

- Exported sample content is automatically validated.
- Runtime/export regressions are caught before manual QA.
- The single-file distribution claim is demonstrably reliable.

---

## Phase 5: Turn AI Into a Product Layer

**Target:** 2 to 3 days  
**Outcome:** AI support becomes maintainable and easier to evolve.

### Work

- Add a proper build/test contract for `packages/ai`.
- Introduce a provider abstraction at the package boundary.
  - keep Gemini as the first provider
  - avoid hard-wiring the product to one vendor surface
- Review secret handling and runtime assumptions.
  - define when browser-local keys are acceptable
  - define when a server-side path is required
- Add usage limits/failure handling expectations for authoring flows.

### Success Criteria

- AI package participates cleanly in repo validation.
- Future provider changes do not require touching editor feature code everywhere.
- Failure states are explicit instead of implicit.

---

## Phase 6: Improve Documentation Discoverability

**Target:** 1 day  
**Outcome:** the growing documentation set becomes easier to navigate.

### Work

- Add a docs index page that explains:
  - specs
  - designs
  - reviews
  - QA reports
  - plans
- Add a lightweight convention for naming and where new docs belong.
- Link the most important current-state docs from the root readme.

### Success Criteria

- Contributors can find the latest plan/spec/review without repo archaeology.
- New docs land in the right place by default.

---

## Priority Ranking

| Priority | Theme | Why it comes first |
|----------|-------|--------------------|
| P1 | Repo contract | Broken build paths slow every other investment |
| P2 | Architecture pressure | Large integration files will tax every new feature |
| P3 | Authoring workflow | This is the product surface users feel most directly |
| P4 | Runtime/export reliability | Core differentiator must be testable |
| P5 | AI hardening | Valuable, but should sit on a stable repo base |
| P6 | Docs discoverability | High leverage, lower urgency than build and architecture |

---

## Recommended Immediate Actions

If only one short cycle is available, do these first:

1. Restore clean root build behavior.
2. Add a single repo-wide CI validation command.
3. Split the editor store along ownership boundaries.
4. Add sample export smoke validation.

That sequence creates the most leverage for the next month of work.

---

## Bottom Line

The right move is not "add more features faster." The right move is to make the current product shape reliable enough that new features remain cheap to add.
