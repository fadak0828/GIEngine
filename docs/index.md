# GIEngine Documentation Index

Welcome to the GIEngine documentation. This page serves as a navigation guide to all documentation in this project.

## Directory Overview

| Directory | Purpose |
|-----------|---------|
| [`analysis/`](./analysis) | Project analysis and health checks |
| [`company/`](./company) | Internal company and team documentation |
| [`designs/`](./designs) | Feature design documents and proposals |
| [`guide/`](./guide) | User-facing how-to guides and tutorials |
| [`plans/`](./plans) | Project roadmap and improvement plans |
| [`qa/`](./qa) | Quality assurance test reports |
| [`reviews/`](./reviews) | Code and design review documents |
| [`specs/`](./specs) | Technical specifications and requirements |
| [`superpowers/`](./superpowers) | Feature-specific plans and specs (subdivided) |

---

## Key Documents

### Getting Started
- [Quick Start Guide](./guide/quick-start.md) — Get up and running with GIEngine
- [Editor Basics](./guide/editor-basics.md) — Learn the basic editor workflow
- [Keyboard Shortcuts](./guide/keyboard-shortcuts.md) — Speed up your workflow

### Architecture & Design
- [GI Engine Design](./specs/2026-03-29-gi-engine.md) — Core engine architecture
- [GI Editor Design](./specs/2026-03-29-gi-editor.md) — Editor architecture
- [Content & Export Design](./specs/2026-03-30-content-and-export.md) — Export pipeline

### Project Status
- [Project Improvement Roadmap](./plans/2026-03-31-project-improvement-roadmap.md) — Current project direction
- [2026-03-31 Project Analysis](./analysis/2026-03-31-project-analysis.md) — Latest project health assessment

### Superpowers (Feature Deep-Dives)
- [Golden Idol UX Improvements](./superpowers/plans/2026-03-30-golden-idol-ux-improvements.md)
- [Golden Idol Interactive Words](./superpowers/plans/2026-03-31-golden-idol-interactive-words.md)
- [RAG System PRD](./superpowers/plans/2026-03-30-prd-rag-system.md)

---

## Naming Conventions

Use the format `YYYY-MM-DD-descriptive-title.md` for all documentation files.

| Type | Location | Example |
|------|----------|---------|
| Analysis | `docs/analysis/` | `2026-03-31-project-analysis.md` |
| Design | `docs/designs/` | `2026-03-30-runtime-render-fixes.md` |
| Spec | `docs/specs/` | `2026-04-01-phase3a-inner-hotspot-visual-editor-spec.md` |
| QA Report | `docs/qa/` | `2026-03-30-runtime-fix-and-export-qa-report.md` |
| Review | `docs/reviews/` | `2026-03-29-gi-engine-review.md` |
| Guide | `docs/guide/` | `quick-start.md`, `editor-basics.md` |
| Plan | `docs/plans/` or `docs/superpowers/plans/` | `2026-03-31-golden-idol-parity-plan.md` |
| Company | `docs/company/` | `COMPANY_GUIDELINES.md` |

### When to Use Each Directory

- **`analysis/`** — Post-mortems, health checks, project analysis
- **`designs/`** — Feature design documents written during development planning
- **`specs/`** — Technical specifications and requirements (canonical source of truth for features)
- **`guide/`** — User-facing documentation (how-to, tutorials, reference)
- **`qa/`** — Test plans and QA reports
- **`reviews/`** — Code and design review artifacts
- **`plans/`** — Roadmap and project planning documents
- **`superpowers/`** — Deep-dive plans/specs for specific features (split into `plans/` and `specs/` subdirs)
- **`company/`** — Internal company documentation, agent configs, personnel

---

## Quick Links

- [Main README](../README.md)
- [Design Document](../DESIGN.md)
- [Agent Guidelines](../AGENTS.md)
- [CLAUDE.md](../CLAUDE.md)
