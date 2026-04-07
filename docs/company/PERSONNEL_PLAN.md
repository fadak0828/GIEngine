# GIEngine Personnel Plan & Role Guidelines

**Effective Date:** 2026-04-05  
**Document Owner:** CEO  
**Status:** Active

---

## Part 1: Role Definitions

### CEO (Chief Executive Officer)

**Current Agent:** Paperclip-managed (Agent ID: `01d0d470-1d32-4aa0-a015-51d6bf9a3c4c`)

**Responsibilities:**
- Strategic direction and roadmap prioritization
- Company-wide policy and guideline maintenance
- Hiring and personnel planning
- Cross-project coordination
- Issue triage and assignment
- Final approval on architectural decisions

**Current Focus (FAD-7):**
- Project analysis and company design
- Creating operational guidelines
- Recruitment planning for Phase 2+ work

**Authority:** Can assign issues to any agent, can create/delete issues, can modify project scope.

---

### CTO (Chief Technology Officer)

**Status:** Recruitment needed  
**Priority:** P1 — Immediate

**Responsibilities:**
- Technical architecture and code quality
- `packages/core` and `packages/ai` ownership
- State machine and editor store refactoring (Phase 2)
- AI provider abstraction design
- Build system and CI/CD maintenance
- Mentor other agents on technical decisions

**Qualifications:**
- Strong TypeScript/React experience
- Understanding of state machine patterns
- Experience with monorepo architecture
- Can review PRs and provide technical guidance

**Immediate Tasks (Week 1):**
1. Fix root `npm run build` blockers:
   - Add build script to `@gi-engine/ai` or exclude it from root build
   - Fix editor test fixtures for `subPuzzleId` type sync
2. Execute Phase 1 of the improvement roadmap (repo stabilization)
3. Begin Phase 2 planning (store/state-machine split)

---

### Senior Developer (x2)

**Status:** Recruitment needed  
**Priority:** P2 — Short-term (within 2 weeks)

**Responsibilities:**
- Feature development across all packages
- Editor UI enhancements
- Runtime bug fixes and performance
- Export system improvements
- Writing tests for all changes

**Qualifications:**
- TypeScript proficiency
- React experience (for editor work)
- Understanding of game development concepts
- Test-driven development mindset

**Target Profile:**
- Agent with `editor` or `runtime` package experience preferred
- Must follow commit conventions and run `ci:check` before each commit

---

### QA Engineer

**Status:** Recruitment needed  
**Priority:** P3 — Medium-term (within 1 month)

**Responsibilities:**
- E2E test coverage expansion
- Playwright test maintenance
- Pre-release validation
- Bug report triaging
- Documentation QA

**Qualifications:**
- Playwright experience
- Understanding of game authoring workflows
- Can create reproducible bug reports with clear steps

---

## Part 2: Phase-Based Hiring Plan

### Phase 1: Immediate (Week 1)

**Goal:** Stabilize the build and establish baseline operations.

**Hiring Need:** 1x CTO (senior, can start immediately)

**CTO Immediate Deliverables:**
1. Fix `@gi-engine/ai` build script or exclude from root build
2. Fix editor test fixtures for `subPuzzleId`
3. Verify `npm run ci:check` passes cleanly
4. Draft `packages/ai` build/test contract

**Rationale:** The repo is currently in a state where `npm run build` fails. This blocks all other work. A senior technical lead is required to unblock the team.

---

### Phase 2: Short-term (Weeks 2-4)

**Goal:** Accelerate feature delivery and reduce architectural pressure.

**Hiring Need:** 2x Senior Developers

**Work Focus:**
- Phase 2 of roadmap: Split editor store into domain slices
- Phase 3 of roadmap: Improve authoring workflow (save/load, validation)
- Runtime smoke tests for exported HTML

**Developer Role Split:**
| Developer | Primary Focus | Secondary |
|-----------|---------------|-----------|
| Developer A | Editor store refactoring | Editor UI features |
| Developer B | Runtime & exporter | E2E test expansion |

**Rationale:** The existing codebase has two oversized files (`editor-store.ts` at 817 lines, `state-machine.ts` at 828 lines) that are becoming bottlenecks. Two focused developers can make rapid progress on splitting these while maintaining quality.

---

### Phase 3: Medium-term (Month 2)

**Goal:** Hardening and product maturity.

**Hiring Need:** 1x QA Engineer

**Work Focus:**
- Phase 4: Runtime/export reliability (smoke tests)
- Phase 5: AI package hardening
- Phase 6: Documentation discoverability
- General bug fixing and polish

**Rationale:** By month 2, the core architecture will be more stable. A QA engineer can then focus on ensuring the export promise holds, expanding test coverage, and catching regressions before they reach users.

---

## Part 3: Per-Role Detailed Guidelines

### CEO Guidelines

1. **Decision Authority:** Final approval on roadmap priorities and architectural decisions.
2. **Work Style:** Strategic, delegating execution to CTO and developers.
3. **Communication:** Uses Paperclip issues as the single source of truth.
4. **Limits:** Does not commit code directly except for policy documents.
5. **Review Cadence:** Reviews team progress daily; provides feedback within 24 hours of a request.

**Operating Rules:**
- Never closes an issue without verifying completion criteria.
- Escalates blockers to the appropriate agent within 4 hours of discovery.
- Updates the roadmap document monthly.

---

### CTO Guidelines

1. **Technical Ownership:** Owns `packages/core` and `packages/ai`.
2. **Code Review:** Reviews all PRs touching architecture or core business logic.
3. **Build Responsibility:** Ensures `npm run ci:check` passes at all times.
4. **Mentorship:** Provides technical guidance to developers on request.

**Operating Rules:**
- Must run `npm run ci:check` before merging any change.
- File size violations (>500 lines) require immediate refactoring plan.
- Breaking changes to shared types must be announced in the relevant issue.
- Reviews developer PRs within 4 hours of submission during business hours.

**Architectural Constraints:**
- No new code may be added to `editor-store.ts` or `state-machine.ts` without a justification comment and an associated refactoring ticket.
- All new packages must have a build script and at least one test.
- AI provider changes must be abstracted behind a provider interface.

---

### Developer Guidelines

1. **Task Assignment:** Picks up issues from the backlog; self-assigns via Paperclip.
2. **Branch Workflow:** Creates feature branches; PRs go to `main`.
3. **Testing:** All changes must include tests. No tests = no merge.
4. **Commit Hygiene:** Follows Conventional Commits format; includes Co-Author line.

**Operating Rules:**
- Before starting any task, read `AGENTS.md` and `DESIGN.md`.
- Before committing, run `npm run ci:check` locally.
- If `ci:check` fails, do not push — fix first.
- If blocked for >1 hour, post a comment on the issue.
- End of session: commit all work and push, even if incomplete.

**Code Standards:**
- No hardcoded strings outside i18n files.
- No inline styles — use CSS classes following the design system.
- All async operations must handle errors explicitly.
- No `any` types without a justification comment.

---

### QA Engineer Guidelines

1. **Test Coverage:** Expands E2E coverage for all user-facing features.
2. **Bug Reports:** Creates clear, reproducible bug reports in Paperclip.
3. **Validation:** Runs smoke tests before releases.

**Operating Rules:**
- All bug reports must include: steps to reproduce, expected vs actual behavior, environment.
- Tests must be stable (no flaky tests in the suite).
- QA sign-off is required before any release.

**Testing Priorities:**
1. Editor: Project creation, scene editing, hotspot placement, word collection, puzzle definition
2. Runtime: Scene navigation, word collection, puzzle solving
3. Export: Standalone HTML validation, asset loading, save/load functionality

---

## Part 4: Recruitment Tracker

**Last synced with Paperclip:** 2026-04-06

| Role | Status | Priority | Target Start | Progress |
|------|--------|----------|--------------|----------|
| CTO | **FILLED** | P1 | Week 1 | Agent `48f27022` (opencode_local, minimax/MiniMax-M2.7) |
| Staff Engineer | **FILLED** | P2 | Week 1 | Agent `afa1ec56` |
| Release Engineer | **FILLED** | P2 | Week 1 | Agent `31fcb041` |
| QA Engineer | **FILLED** | P3 | Week 1 | Agent `23ed2e64` |

**Total Open Positions:** 0
**Total Filled:** 4 (plus CEO `01d0d470`)

> Note: The plan originally anticipated two Senior Developer slots. The current org chart
> consolidates that scope into Staff Engineer + Release Engineer, with QA hired earlier
> than the original Month 2 target. Revisit the split once actual issue throughput data
> is available (see Hermes weekly retro output).

---

## Part 5: Immediate Next Actions

After CEO completes FAD-7 (this issue):

1. **CEO** creates hiring issue for CTO in Paperclip.
2. **CTO (when hired)** fixes Phase 1 repo blockers.
3. **CEO + CTO** plan Phase 2 tasks together.
4. **CEO** recruits 2 Senior Developers in parallel with Phase 2 work.

---

*This plan is a living document. Update annually or when strategic priorities shift significantly.*
