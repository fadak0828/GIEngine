# Fadak Company Guidelines — GIEngine Division

**Effective Date:** 2026-04-05  
**Document Owner:** CEO  
**Status:** Active

---

## 1. Purpose

This document defines the shared operating principles and standards for all agents working on the GIEngine project. It establishes expectations for code quality, communication, task management, and collaboration.

---

## 2. Company Mission

Fadak's GIEngine division builds and operates GIEngine — a Golden Idol-style detective/deduction game engine. Our mission is to make investigative puzzle game creation accessible through a professional editor, reliable runtime, and seamless standalone export.

---

## 3. Core Values

1. **Quality Over Velocity** — A passing build is non-negotiable before any session ends.
2. **Operational Transparency** — All significant work is documented, reviewed, and tracked in Paperclip.
3. **Architectural Discipline** — Complexity must be distributed; no single file becomes the dumping ground for unrelated features.
4. **User-Facing Reliability** — The standalone HTML export promise must hold under automated validation.
5. **Incremental Delivery** — Large features ship as small, verifiable increments with tests.

---

## 4. Shared Standards

### 4.1 Validation Before Commit

All agents must run the following before committing any change:

```bash
npm run ci:check   # lint + typecheck + test + build
```

If `ci:check` does not pass, the change does not ship.

### 4.2 Commit Conventions

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

types: feat | fix | refactor | test | docs | chore | style
scope: core | editor | runtime | exporter | ai | docs
```

Every commit must include the Co-Author line:

```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

### 4.3 Issue Lifecycle

1. **Backlog** — Unassigned, not yet started.
2. **Todo** — Assigned to an agent, ready to work.
3. **In Progress** — Agent is actively working.
4. **Done** — Completed and verified.
5. **Cancelled** — No longer relevant.

Agents update issue status in Paperclip within 10 minutes of starting or completing work.

### 4.4 Session Closure

Before ending any session, an agent must:
- Commit all work in progress.
- Push to `origin/main`.
- Update the issue status in Paperclip.
- If blocked, post a comment on the issue explaining the blocker.

---

## 5. Package Ownership

| Package | Owner | Responsibility |
|---------|-------|----------------|
| `packages/core` | CTO | Domain model, state machine, validation, i18n |
| `packages/editor` | All agents | React authoring tool, UX decisions |
| `packages/runtime` | All agents | Browser runtime, scene rendering |
| `packages/exporter` | All agents | HTML bundling, asset inlining |
| `packages/ai` | CTO | Provider abstraction, Gemini integration |
| `docs` | All agents | Specs, designs, reviews, QA |

---

## 6. Architecture Rules

### 6.1 File Size Limits

| File Type | Soft Limit | Hard Limit |
|-----------|-----------|-------------|
| TypeScript/TSX source | 300 lines | 500 lines |
| State machine files | — | 600 lines |
| Editor store | — | 600 lines |

When a file approaches the soft limit, it must be scheduled for refactoring in the next cycle.

### 6.2 Store and State Changes

When modifying shared state types:
1. Update the type definition.
2. Update all `defaultUI`, `defaultSelection`, and similar default objects.
3. Update test fixtures in `packages/editor/tests/test-helpers.ts`.
4. Run `npm run ci:check` before committing.

### 6.3 Test Conventions

- Tests for `packages/<pkg>` live in `packages/<pkg>/tests/`.
- Editor tests use the shared `resetStore()` from `packages/editor/tests/test-helpers.ts`.
- Unit tests use Vitest; E2E tests use Playwright.

---

## 7. Code Review Expectations

All significant changes should receive a review comment in Paperclip before merging. Reviewers check for:
- Correctness (does the code do what it claims?)
- Completeness (are edge cases handled?)
- Test coverage (do tests verify the change?)
- Design system compliance (does UI work respect `DESIGN.md`?)

---

## 8. Documentation Conventions

| Type | Location | When to Create |
|------|----------|----------------|
| Spec | `docs/specs/` | Before starting any feature |
| Design | `docs/designs/` | When UI/UX decisions are made |
| Review | `docs/reviews/` | After completing a spec implementation |
| QA Report | `docs/qa/` | After running QA on a feature |
| Plan | `docs/plans/` | For roadmap and project planning |
| Analysis | `docs/analysis/` | For project-level assessments |

All documentation files use the naming format: `YYYY-MM-DD-title.md`

---

## 9. Communication Protocol

- Primary channel: Paperclip issues and comments.
- All task work is tracked in Paperclip; informal chat is not authoritative.
- Blockers must be reported immediately on the relevant issue.
- Weekly status is provided by updating the issue priority and adding a progress comment.

---

## 10. Enforcement

- CEO is responsible for monitoring adherence to these guidelines.
- Violations are addressed by assigning corrective tasks in Paperclip.
- Repeated violations trigger a process review and guideline update.

---

## 11. Change Process

Changes to these guidelines require:
1. A draft PR or issue proposing the change.
2. CEO approval.
3. Update to this document with the change date.

---

*This document is the operating agreement for all GIEngine agents. By following these standards, we maintain a codebase that is easy to ship, extend, and trust.*
