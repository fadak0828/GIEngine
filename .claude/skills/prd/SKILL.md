---
name: prd
description: |
  PRD and project status queries for GIEngine.
  Shows requirements, progress, and remaining work from docs/project-index.json.
allowed-tools:
  - Bash
---

# /prd — PRD & Project Status

Query the GIEngine project index for PRD, progress, and remaining tasks.

## Usage

- `/prd` — full PRD summary (all requirements table)
- `/prd progress` — progress dashboard (completion %, packages, git activity)
- `/prd remaining` — remaining work (in-progress and not-started items)
- `/prd rebuild` — rebuild the index from scratch
- `/prd override <REQ-ID> <status> [note]` — manually set a requirement's status

## Workflow

Parse the user's subcommand from `$ARGUMENTS` (empty = summary, "progress", "remaining", "rebuild", or "override ..."), then run the appropriate bash command below.

### summary (default, no args or unrecognized)

```bash
cd D:/claude_ws/GIEngine && npm run prd:query -- summary 2>/dev/null
```

### progress

```bash
cd D:/claude_ws/GIEngine && npm run prd:query -- progress 2>/dev/null
```

### remaining

```bash
cd D:/claude_ws/GIEngine && npm run prd:query -- remaining 2>/dev/null
```

### rebuild

```bash
cd D:/claude_ws/GIEngine && npm run prd:index 2>&1
```

### override

Parse `$ARGUMENTS` as: `override <REQ-ID> <status> [note]`

1. Read `docs/project-index.json`
2. Add or update `overrides[REQ-ID]` with `{ status, note }`
3. Write the file back using the Edit tool
4. Print: "Override saved: REQ-ID → status"
5. Run `npm run prd:index` to rebuild with the override applied

## Error handling

If `docs/project-index.json` does not exist, the query engine will auto-rebuild it.
If the rebuild fails (no git, no docs), report the error and suggest running from the project root.
