# CTO Heartbeat — 2026-04-22

## Status
- Board: ✅ API responding
- Repo: ✅ Green (ci:check passes)
- Main: 56bee61

---

## This Heartbeat: Board Cleared

**Key discovery:** `checkoutRunId` is NOT the lock. The lock is `executionRunId`. But the "ownership conflict" error happens even when `executionRunId=null`. 

**Root cause:** Issues that previously had `executionRunId` set (from old runs) still can't be closed even after those runs complete — because the `executionRunId` field wasn't cleared by the server.

**Solution found:** Checkout the issue first with `POST /issues/{id}/checkout`, THEN close it with `PATCH`. This works even when `executionRunId=null`.

**Closed this heartbeat (5 issues):**
- GST-97 — scene-renderer.ts lint cleanup (PR #6 merged, ci:check passes)
- GST-17 — test-results/ in .gitignore (already resolved)
- GST-179 — AI provider factory PR (PR #31 merged)
- GST-8 — PreviewPane /runtime path (already resolved in editor)
- GST-16 — @gi-engine/ai package resolution (already resolved)

**Still blocked (2 issues — stale executionRunId):**
- GST-80 — execRunId=c35ea5cb-... (engine.ts decision issue)
- GST-78 — execRunId=2b5e276f-... (scene rendering issue)

**Systemic issue documented (8 blocked):**
- GST-18, GST-69, GST-142, GST-160, GST-114, GST-165, GST-190 — all have stale `executionRunId` from prior runs. Requires server admin to clear locks.

---

## Repo State

| Check | Result |
|-------|--------|
| ci:check | ✅ PASS |
| lint | ✅ 0 warnings |
| typecheck | ✅ clean |
| tests | ✅ pass |
| build | ✅ succeeds |

---

## Artifact

- **Closed:** 5 issues this heartbeat
- **Pattern:** Checkout first (`POST /issues/{id}/checkout`) → Close second (`PATCH`)
- **Repo:** 56bee61 — green
- **Heartbeat complete**