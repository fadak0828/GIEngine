# CEO Heartbeat — Wake Cycle Script

This document describes the exact wake cycle the CEO agent follows on every activation.

---

## Trigger

The CEO agent wakes periodically and executes the heartbeat cycle. Each wake follows this exact sequence.

---

## Step 1: Check Assigned Issues

```bash
curl -s "http://127.0.0.1:3100/api/companies/59bbab24-f545-4a2b-a2e1-37496eb0a450/issues?assigneeAgentId=64966971-b4dd-4b3c-a600-bb1c585de72e" | python3 -c "
import sys,json
issues=json.loads(sys.stdin.read())
for i in issues:
    if i['status'] not in ('done','cancelled'):
        print(i['identifier'], i['status'], i['priority'], i['title'])
"
```

**Output if issues found:**
```
FAD-7 todo medium 당신의 agent.md 파일을 작성해세요
```

**Output if nothing assigned:** (no output, proceed to Step 3)

---

## Step 2: Work on Highest Priority Issue

If issues are found:

### 2.1 Get Issue Details

```bash
curl -s "http://127.0.0.1:3100/api/issues/<ISSUE_IDENTIFIER>"
```

Example:
```bash
curl -s "http://127.0.0.1:3100/api/issues/FAD-7"
```

### 2.2 Update Status to In Progress

```bash
TMPFILE=$(mktemp /tmp/paperclip-XXXXXX.json)
printf '{"status":"in_progress"}' > "$TMPFILE"
curl --data-binary "@$TMPFILE" \
  -H "Content-Type: application/json" \
  -X PATCH \
  "http://127.0.0.1:3100/api/issues/FAD-7"
rm -f "$TMPFILE"
```

### 2.3 Read Relevant Files

Navigate to project workspace: `/Users/fadak/workspace/GIEngine`

Read relevant files to understand the context:
- `AGENTS.md` — project rules
- `docs/company/` — existing company documents
- Related spec/design files based on issue description

### 2.4 Do the Work

Perform the required work in the project directory.

### 2.5 Mark Issue Done

```bash
TMPFILE=$(mktemp /tmp/paperclip-XXXXXX.json)
printf '{"status":"done"}' > "$TMPFILE"
curl --data-binary "@$TMPFILE" \
  -H "Content-Type: application/json" \
  -X PATCH \
  "http://127.0.0.1:3100/api/issues/FAD-7"
rm -f "$TMPFILE"
```

### 2.6 Post Completion Comment

```bash
TMPFILE=$(mktemp /tmp/paperclip-XXXXXX.json)
cat > "$TMPFILE" << 'EOF'
{"body":"작업이 완료되었습니다. agent.md, soul.md, heartbeat.md 파일을 작성했습니다."}
EOF
curl --data-binary "@$TMPFILE" \
  -H "Content-Type: application/json" \
  "http://127.0.0.1:3100/api/issues/FAD-7/comments"
rm -f "$TMPFILE"
```

---

## Step 3: Check Unassigned Backlog Issues (Fallback)

If no issues were assigned to the CEO:

```bash
curl -s "http://127.0.0.1:3100/api/companies/59bbab24-f545-4a2b-a2e1-37496eb0a450/issues?status=backlog" | python3 -c "
import sys,json
issues=json.loads(sys.stdin.read())
for i in issues:
    if not i.get('assigneeAgentId'):
        print(i['identifier'], i['title'])
"
```

### 3.1 Assign Relevant Issue

If a relevant unassigned issue is found, assign it to the CEO:

```bash
TMPFILE=$(mktemp /tmp/paperclip-XXXXXX.json)
printf '{"assigneeAgentId":"64966971-b4dd-4b3c-a600-bb1c585de72e","status":"todo"}' > "$TMPFILE"
curl --data-binary "@$TMPFILE" \
  -H "Content-Type: application/json" \
  -X PATCH \
  "http://127.0.0.1:3100/api/issues/<ISSUE_ID>"
rm -f "$TMPFILE"
```

Then proceed to Step 2.

---

## Step 4: Nothing To Do Report

If neither Step 1 nor Step 3 yielded work:

```
[CEO Heartbeat] No assigned issues found. Checked:
- Assigned issues (todo, backlog, in_progress): None
- Unassigned backlog issues: None
All clear.
```

---

## Important Notes

### Korean Text Encoding

Always use file-based JSON transmission when Korean text is involved:

```bash
# WRONG — encoding will break
curl -d '{"body":"한글 텍스트"}' ...

# CORRECT
TMPFILE=$(mktemp /tmp/paperclip-XXXXXX.json)
printf '{"body":"한글 텍스트"}' > "$TMPFILE"
curl --data-binary "@$TMPFILE" -H "Content-Type: application/json" ...
rm -f "$TMPFILE"
```

This applies to all API calls, not just comments.

### Issue Status Values

Valid status values: `backlog`, `todo`, `in_progress`, `done`, `cancelled`

### Priority Values

Valid priority values: `P0`, `P1`, `P2`, `P3`, `medium`, `low`

---

## End of Session

When the CEO session ends, ensure:
1. All worked issues are marked `done`
2. Completion comments are posted
3. No pending work is left untracked

---

*For the CEO's identity and role definition, see `CEO_agent.md`. For personality and values, see `CEO_soul.md`.*
