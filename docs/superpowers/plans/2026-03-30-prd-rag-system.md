# PRD RAG System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight keyword-based RAG system that indexes GIEngine's docs/code/git history into a static JSON file and exposes it via Claude Code skill commands (`/prd`, `/prd progress`, `/prd remaining`).

**Architecture:** A TypeScript indexer script scans `docs/**/*.md`, `packages/*/src/**`, and git log to produce `docs/project-index.json`. A query engine script reads that index and formats markdown output. A Claude Code skill wraps both scripts into `/prd` subcommands.

**Tech Stack:** TypeScript 5.7, Node.js built-ins (`node:fs`, `node:path`, `node:child_process`), tsx (script runner), vitest (unit tests).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add tsx devDependency + prd:index / prd:query scripts |
| `scripts/vitest.config.ts` | Create | Vitest config for scripts/ unit tests |
| `scripts/types.ts` | Create | Shared TypeScript interfaces (ProjectIndex, Requirement, etc.) |
| `scripts/prd-indexer.ts` | Create | Pipeline: parse docs → scan code → parse git → infer status → save index |
| `scripts/prd-query.ts` | Create | Read index → format summary/progress/remaining as markdown |
| `scripts/__tests__/parser.test.ts` | Create | Unit tests for requirement parsing and status inference |
| `scripts/__tests__/formatter.test.ts` | Create | Unit tests for markdown formatters |
| `docs/project-index.json` | Generated | Output of indexer (git-committable) |
| `.claude/skills/prd/SKILL.md` | Create | Claude Code skill definition for /prd subcommands |

---

## Task 1: Setup — tsx + npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add tsx and update scripts in package.json**

```json
{
  "name": "gi-engine",
  "version": "0.1.0",
  "private": true,
  "description": "Golden Idol style detective/deduction game engine",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces --if-present",
    "lint": "eslint packages/*/src/**/*.ts",
    "typecheck": "tsc --build",
    "prd:index": "npx tsx scripts/prd-indexer.ts",
    "prd:query": "npx tsx scripts/prd-query.ts",
    "prd:test": "npx vitest run --config scripts/vitest.config.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.1.0",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Install tsx**

```bash
npm install
```

Expected: `tsx` installed in `node_modules/.bin/tsx`.

- [ ] **Step 3: Create scripts directory and vitest config**

Create `scripts/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify setup**

```bash
npx tsx --version
```

Expected: prints tsx version like `4.x.x`

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/vitest.config.ts
git commit -m "chore: add tsx runner and prd script setup"
```

---

## Task 2: Define shared TypeScript types

**Files:**
- Create: `scripts/types.ts`

- [ ] **Step 1: Write `scripts/types.ts`**

```typescript
export type RequirementStatus = 'done' | 'in-progress' | 'not-started';
export type RequirementPriority = 'high' | 'medium' | 'low';
export type StatusSource = 'auto' | 'manual';

export interface Requirement {
  id: string;
  title: string;
  source: string;       // relative path from project root, e.g. "docs/specs/gi-engine.md"
  section: string;      // heading text the requirement appeared under
  priority: RequirementPriority;
  status: RequirementStatus;
  statusSource: StatusSource;
  evidence: string[];   // strings describing why this status was inferred
  tags: string[];
}

export interface PackageStats {
  path: string;
  files: number;
  lines: number;
  testFiles: number;
  exports: string[];    // collected export names for keyword matching
  lastModified: string; // ISO date string YYYY-MM-DD
}

export interface Commit {
  hash: string;
  message: string;
  date: string;         // ISO date string YYYY-MM-DD
  files: string[];      // paths of files changed in this commit
}

export interface GitSummary {
  totalCommits: number;
  recentCommits: Commit[];
  activeFiles: string[]; // files changed in last 7 days
}

export interface Override {
  status: RequirementStatus;
  note?: string;
}

export interface ProjectIndex {
  version: string;
  generatedAt: string;  // ISO datetime
  lastCommit: string;   // short hash
  requirements: Requirement[];
  packages: Record<string, PackageStats>;
  gitSummary: GitSummary;
  overrides: Record<string, Override>; // keyed by requirement id
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/types.ts
git commit -m "feat(prd): add shared TypeScript types for project index"
```

---

## Task 3: Requirement parser with tests

**Files:**
- Create: `scripts/__tests__/parser.test.ts`
- Create: `scripts/parser.ts`

The parser extracts `Requirement[]` from a single markdown file's content. It is a pure function — no filesystem access — so it is easy to unit test.

- [ ] **Step 1: Write failing tests in `scripts/__tests__/parser.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { parseRequirements } from '../parser.js';

describe('parseRequirements', () => {
  it('extracts checklist items as requirements', () => {
    const md = `## Core Features\n- [ ] 게임 구조 구현\n- [x] 저장 시스템\n`;
    const reqs = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs).toHaveLength(2);
    expect(reqs[0].title).toBe('게임 구조 구현');
    expect(reqs[0].section).toBe('Core Features');
    expect(reqs[0].source).toBe('docs/specs/test.md');
    expect(reqs[0].id).toMatch(/^REQ-/);
  });

  it('assigns high priority for "core" keyword in heading', () => {
    const md = `## Core Data Model\n- [ ] 게임 타입 정의\n`;
    const reqs = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs[0].priority).toBe('high');
  });

  it('assigns low priority for "향후" keyword in heading', () => {
    const md = `## 향후 확장\n- [ ] 웹 대시보드\n`;
    const reqs = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs[0].priority).toBe('low');
  });

  it('assigns medium priority by default', () => {
    const md = `## General Features\n- [ ] 설정 저장\n`;
    const reqs = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs[0].priority).toBe('medium');
  });

  it('extracts numbered list items as requirements', () => {
    const md = `## Features\n1. 씬 에디터\n2. 퍼즐 에디터\n`;
    const reqs = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs).toHaveLength(2);
    expect(reqs[0].title).toBe('씬 에디터');
  });

  it('generates stable IDs for same content', () => {
    const md = `## Features\n- [ ] 씬 에디터\n`;
    const reqs1 = parseRequirements(md, 'docs/specs/test.md');
    const reqs2 = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs1[0].id).toBe(reqs2[0].id);
  });

  it('generates different IDs for different source files', () => {
    const md = `## Features\n- [ ] 씬 에디터\n`;
    const reqs1 = parseRequirements(md, 'docs/specs/a.md');
    const reqs2 = parseRequirements(md, 'docs/specs/b.md');
    expect(reqs1[0].id).not.toBe(reqs2[0].id);
  });

  it('extracts tags from file path and heading', () => {
    const md = `## Editor Features\n- [ ] 캔버스 드래그\n`;
    const reqs = parseRequirements(md, 'docs/specs/2026-gi-editor.md');
    expect(reqs[0].tags).toContain('editor');
  });

  it('ignores lines that are not requirements', () => {
    const md = `## Overview\n\nThis is a description paragraph.\n\n- [ ] Actual requirement\n`;
    const reqs = parseRequirements(md, 'docs/specs/test.md');
    expect(reqs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run prd:test
```

Expected: All 9 tests FAIL with `Cannot find module '../parser.js'`

- [ ] **Step 3: Implement `scripts/parser.ts`**

```typescript
import { createHash } from 'node:crypto';
import type { Requirement, RequirementPriority } from './types.js';

/** Extract requirement items from a single markdown file's text content. Pure function. */
export function parseRequirements(content: string, sourceFile: string): Requirement[] {
  const requirements: Requirement[] = [];
  const lines = content.split('\n');

  let currentSection = '';
  let sectionIndex = 0;
  let itemIndexInSection = 0;

  for (const line of lines) {
    // Track current heading
    const headingMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
      sectionIndex++;
      itemIndexInSection = 0;
      continue;
    }

    // Checklist item: "- [ ] title" or "- [x] title"
    const checklistMatch = line.match(/^-\s+\[[ xX]\]\s+(.+)/);
    if (checklistMatch) {
      const title = checklistMatch[1].trim();
      itemIndexInSection++;
      requirements.push(makeRequirement(title, sourceFile, currentSection, sectionIndex, itemIndexInSection));
      continue;
    }

    // Numbered list item: "1. title" or "2. title"
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      const title = numberedMatch[1].trim();
      itemIndexInSection++;
      requirements.push(makeRequirement(title, sourceFile, currentSection, sectionIndex, itemIndexInSection));
      continue;
    }
  }

  return requirements;
}

function makeRequirement(
  title: string,
  sourceFile: string,
  section: string,
  sectionIndex: number,
  itemIndex: number,
): Requirement {
  const id = generateId(sourceFile, sectionIndex, itemIndex);
  const priority = inferPriority(section);
  const tags = extractTags(sourceFile, section);

  return {
    id,
    title,
    source: sourceFile,
    section,
    priority,
    status: 'not-started',
    statusSource: 'auto',
    evidence: [],
    tags,
  };
}

/** Deterministic ID from source file + section position. Stable across rebuilds. */
function generateId(sourceFile: string, sectionIndex: number, itemIndex: number): string {
  const raw = `${sourceFile}:${sectionIndex}:${itemIndex}`;
  const hash = createHash('sha1').update(raw).digest('hex').slice(0, 6);
  return `REQ-${hash}`;
}

function inferPriority(section: string): RequirementPriority {
  const lower = section.toLowerCase();
  const HIGH_KEYWORDS = ['core', 'critical', '필수', '핵심'];
  const LOW_KEYWORDS  = ['optional', 'nice-to-have', '향후', '추후', 'future'];

  if (HIGH_KEYWORDS.some(k => lower.includes(k))) return 'high';
  if (LOW_KEYWORDS.some(k => lower.includes(k))) return 'low';
  return 'medium';
}

function extractTags(sourceFile: string, section: string): string[] {
  const tags = new Set<string>();

  // Tags from file path words (strip dates and common words)
  const fileName = sourceFile.split('/').pop() ?? '';
  const pathWords = fileName.replace(/\.[^.]+$/, '').split(/[-_\d]+/).filter(w => w.length > 2);
  for (const word of pathWords) tags.add(word.toLowerCase());

  // Tags from section heading words
  const sectionWords = section.split(/\s+/).filter(w => w.length > 3);
  for (const word of sectionWords) tags.add(word.toLowerCase().replace(/[^a-z가-힣]/g, ''));

  return [...tags].filter(Boolean);
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm run prd:test
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/parser.ts scripts/__tests__/parser.test.ts
git commit -m "feat(prd): add requirement parser with unit tests"
```

---

## Task 4: Status inferrer with tests

**Files:**
- Create: `scripts/__tests__/inferrer.test.ts`
- Create: `scripts/inferrer.ts`

Pure function: given a requirement + code exports + recent commit messages, returns `{ status, evidence }`.

- [ ] **Step 1: Write failing tests in `scripts/__tests__/inferrer.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { inferStatus } from '../inferrer.js';
import type { Requirement, Commit } from '../types.js';

function makeReq(title: string, tags: string[] = []): Requirement {
  return {
    id: 'REQ-abc123',
    title,
    source: 'docs/specs/test.md',
    section: 'Features',
    priority: 'medium',
    status: 'not-started',
    statusSource: 'auto',
    evidence: [],
    tags,
  };
}

describe('inferStatus', () => {
  it('returns done when matching export exists and test file exists', () => {
    const req = makeReq('state machine', ['state', 'machine']);
    const result = inferStatus(req, ['stateMachine', 'StateManager'], true, []);
    expect(result.status).toBe('done');
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('returns done when matching export exists without test file', () => {
    const req = makeReq('state machine', ['state']);
    const result = inferStatus(req, ['stateMachine'], false, []);
    expect(result.status).toBe('done');
  });

  it('returns in-progress when recent commit message matches', () => {
    const req = makeReq('AI background generation', ['ai', 'background']);
    const commits: Commit[] = [
      { hash: 'abc', message: 'feat: improve AI background generation', date: '2026-03-30', files: [] },
    ];
    const result = inferStatus(req, [], false, commits);
    expect(result.status).toBe('in-progress');
  });

  it('returns not-started when no code or commit matches', () => {
    const req = makeReq('multiplayer lobby', ['multiplayer']);
    const result = inferStatus(req, ['stateMachine', 'GameEngine'], false, []);
    expect(result.status).toBe('not-started');
    expect(result.evidence).toHaveLength(0);
  });

  it('evidence mentions matching export name', () => {
    const req = makeReq('save manager', ['save']);
    const result = inferStatus(req, ['saveManager', 'SaveManager'], false, []);
    expect(result.evidence.some(e => e.includes('saveManager') || e.includes('SaveManager'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run prd:test
```

Expected: FAIL with `Cannot find module '../inferrer.js'`

- [ ] **Step 3: Implement `scripts/inferrer.ts`**

```typescript
import type { Requirement, RequirementStatus, Commit } from './types.js';

export interface InferResult {
  status: RequirementStatus;
  evidence: string[];
}

/**
 * Infer requirement status from code exports and recent commits. Pure function.
 *
 * @param req           - The requirement to evaluate
 * @param allExports    - All export names collected from packages/*/src/**
 * @param hasTestFile   - Whether any test file name matched this requirement's keywords
 * @param recentCommits - Recent git commits (last 20)
 */
export function inferStatus(
  req: Requirement,
  allExports: string[],
  hasTestFile: boolean,
  recentCommits: Commit[],
): InferResult {
  const keywords = buildKeywords(req);
  const evidence: string[] = [];

  // Check code exports for keyword match
  const matchingExports = allExports.filter(exp =>
    keywords.some(kw => exp.toLowerCase().includes(kw))
  );
  if (matchingExports.length > 0) {
    evidence.push(`코드에서 관련 export 발견: ${matchingExports.slice(0, 3).join(', ')}`);
    if (hasTestFile) {
      evidence.push('관련 테스트 파일 존재');
      return { status: 'done', evidence };
    }
    return { status: 'done', evidence };
  }

  // Check recent commit messages for keyword match
  const matchingCommits = recentCommits.filter(c =>
    keywords.some(kw => c.message.toLowerCase().includes(kw))
  );
  if (matchingCommits.length > 0) {
    const latest = matchingCommits[0];
    evidence.push(`최근 커밋에서 관련 작업 발견: ${latest.hash} "${latest.message}"`);
    return { status: 'in-progress', evidence };
  }

  return { status: 'not-started', evidence: [] };
}

/** Build a list of lowercase keywords from requirement title and tags. */
function buildKeywords(req: Requirement): string[] {
  const words = new Set<string>();

  // From tags
  for (const tag of req.tags) {
    if (tag.length > 2) words.add(tag.toLowerCase());
  }

  // From title words (split on spaces and common separators)
  const titleWords = req.title
    .toLowerCase()
    .split(/[\s\-_,()[\]]+/)
    .filter(w => w.length > 2);
  for (const w of titleWords) words.add(w);

  return [...words];
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm run prd:test
```

Expected: All 5 inferrer tests PASS (14 total passing).

- [ ] **Step 5: Commit**

```bash
git add scripts/inferrer.ts scripts/__tests__/inferrer.test.ts
git commit -m "feat(prd): add status inferrer with unit tests"
```

---

## Task 5: Markdown formatters with tests

**Files:**
- Create: `scripts/__tests__/formatter.test.ts`
- Create: `scripts/formatter.ts`

Pure functions: `formatSummary`, `formatProgress`, `formatRemaining` each take a `ProjectIndex` and return a markdown string.

- [ ] **Step 1: Write failing tests in `scripts/__tests__/formatter.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { formatSummary, formatProgress, formatRemaining } from '../formatter.js';
import type { ProjectIndex, Requirement } from '../types.js';

function makeIndex(overrides: Partial<ProjectIndex> = {}): ProjectIndex {
  const base: ProjectIndex = {
    version: '1.0.0',
    generatedAt: '2026-03-30T12:00:00Z',
    lastCommit: 'abc1234',
    requirements: [],
    packages: {
      core: { path: 'packages/core', files: 10, lines: 1000, testFiles: 3, exports: [], lastModified: '2026-03-30' },
    },
    gitSummary: {
      totalCommits: 5,
      recentCommits: [{ hash: 'abc1234', message: 'feat: initial', date: '2026-03-30', files: [] }],
      activeFiles: [],
    },
    overrides: {},
  };
  return { ...base, ...overrides };
}

function makeReq(status: Requirement['status'], title = 'Test requirement'): Requirement {
  return {
    id: 'REQ-abc123',
    title,
    source: 'docs/specs/test.md',
    section: 'Features',
    priority: 'medium',
    status,
    statusSource: 'auto',
    evidence: ['관련 export 발견: testFn'],
    tags: ['test'],
  };
}

describe('formatSummary', () => {
  it('includes project title', () => {
    const out = formatSummary(makeIndex());
    expect(out).toContain('PRD 요약');
  });

  it('shows total requirement count', () => {
    const index = makeIndex({ requirements: [makeReq('done'), makeReq('not-started')] });
    const out = formatSummary(index);
    expect(out).toContain('2');
  });

  it('renders a requirements table row for each requirement', () => {
    const index = makeIndex({ requirements: [makeReq('done', '씬 에디터')] });
    const out = formatSummary(index);
    expect(out).toContain('씬 에디터');
    expect(out).toContain('done');
  });
});

describe('formatProgress', () => {
  it('calculates completion percentage', () => {
    const reqs = [makeReq('done'), makeReq('done'), makeReq('not-started')];
    const index = makeIndex({ requirements: reqs });
    const out = formatProgress(index);
    expect(out).toContain('67%');
  });

  it('shows 100% when all done', () => {
    const index = makeIndex({ requirements: [makeReq('done')] });
    const out = formatProgress(index);
    expect(out).toContain('100%');
  });

  it('includes package table', () => {
    const out = formatProgress(makeIndex());
    expect(out).toContain('core');
    expect(out).toContain('1,000');
  });

  it('includes recent commits', () => {
    const out = formatProgress(makeIndex());
    expect(out).toContain('abc1234');
    expect(out).toContain('feat: initial');
  });
});

describe('formatRemaining', () => {
  it('lists in-progress requirements first', () => {
    const reqs = [makeReq('not-started', 'B'), makeReq('in-progress', 'A')];
    const index = makeIndex({ requirements: reqs });
    const out = formatRemaining(index);
    const posA = out.indexOf('A');
    const posB = out.indexOf('B');
    expect(posA).toBeLessThan(posB);
  });

  it('excludes done requirements', () => {
    const index = makeIndex({ requirements: [makeReq('done', '완료된 작업')] });
    const out = formatRemaining(index);
    expect(out).not.toContain('완료된 작업');
  });

  it('shows empty message when all done', () => {
    const index = makeIndex({ requirements: [makeReq('done')] });
    const out = formatRemaining(index);
    expect(out).toContain('남은 작업 없음');
  });

  it('includes evidence for in-progress items', () => {
    const index = makeIndex({ requirements: [makeReq('in-progress', '씬 에디터')] });
    const out = formatRemaining(index);
    expect(out).toContain('관련 export 발견: testFn');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run prd:test
```

Expected: FAIL with `Cannot find module '../formatter.js'`

- [ ] **Step 3: Implement `scripts/formatter.ts`**

```typescript
import type { ProjectIndex, Requirement } from './types.js';

const STATUS_EMOJI: Record<Requirement['status'], string> = {
  'done': '✅',
  'in-progress': '🔄',
  'not-started': '⬜',
};

export function formatSummary(index: ProjectIndex): string {
  const total = index.requirements.length;
  const lines: string[] = [];

  lines.push(`# GIEngine PRD 요약`);
  lines.push('');
  lines.push(`**생성일**: ${index.generatedAt.split('T')[0]} | **마지막 커밋**: ${index.lastCommit} | **총 요구사항**: ${total}개`);
  lines.push('');
  lines.push('## 요구사항 목록');
  lines.push('');
  lines.push('| ID | 제목 | 우선순위 | 상태 | 소스 |');
  lines.push('|----|------|----------|------|------|');

  for (const req of index.requirements) {
    const source = req.source.split('/').pop() ?? req.source;
    const statusMark = `${STATUS_EMOJI[req.status]} ${req.status}`;
    lines.push(`| ${req.id} | ${req.title} | ${req.priority} | ${statusMark} | ${source} |`);
  }

  return lines.join('\n');
}

export function formatProgress(index: ProjectIndex): string {
  const reqs = index.requirements;
  const total = reqs.length;
  const done = reqs.filter(r => r.status === 'done').length;
  const inProgress = reqs.filter(r => r.status === 'in-progress').length;
  const notStarted = reqs.filter(r => r.status === 'not-started').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const lines: string[] = [];
  lines.push('# 진행 현황');
  lines.push('');
  lines.push(`## 전체: ${pct}% (${done}/${total} 완료)`);
  lines.push(`- ✅ done: ${done}`);
  lines.push(`- 🔄 in-progress: ${inProgress}`);
  lines.push(`- ⬜ not-started: ${notStarted}`);
  lines.push('');
  lines.push('## 패키지별 현황');
  lines.push('');
  lines.push('| 패키지 | 파일 | 라인 | 테스트 | 최근 수정 |');
  lines.push('|--------|------|------|--------|-----------|');

  for (const [name, pkg] of Object.entries(index.packages)) {
    lines.push(`| ${name} | ${pkg.files} | ${pkg.lines.toLocaleString()} | ${pkg.testFiles} | ${pkg.lastModified} |`);
  }

  lines.push('');
  lines.push('## 최근 git 활동');
  for (const commit of index.gitSummary.recentCommits.slice(0, 5)) {
    lines.push(`- ${commit.hash} ${commit.message}`);
  }

  return lines.join('\n');
}

export function formatRemaining(index: ProjectIndex): string {
  const inProgress = index.requirements.filter(r => r.status === 'in-progress');
  const notStarted = index.requirements.filter(r => r.status === 'not-started');

  if (inProgress.length === 0 && notStarted.length === 0) {
    return '# 남은 작업\n\n남은 작업 없음 🎉';
  }

  const lines: string[] = [];
  lines.push('# 남은 작업');
  lines.push('');

  if (inProgress.length > 0) {
    lines.push(`## 🔄 in-progress (${inProgress.length}개)`);
    lines.push('');
    inProgress.forEach((req, i) => {
      lines.push(`${i + 1}. **${req.id}**: ${req.title}`);
      if (req.evidence.length > 0) {
        for (const ev of req.evidence) lines.push(`   - 근거: ${ev}`);
      }
      lines.push('');
    });
  }

  if (notStarted.length > 0) {
    lines.push(`## ⬜ not-started (${notStarted.length}개)`);
    lines.push('');
    notStarted.forEach((req, i) => {
      lines.push(`${inProgress.length + i + 1}. **${req.id}**: ${req.title}`);
      lines.push(`   - 소스: ${req.source}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm run prd:test
```

Expected: All formatter tests PASS (25+ total passing).

- [ ] **Step 5: Commit**

```bash
git add scripts/formatter.ts scripts/__tests__/formatter.test.ts
git commit -m "feat(prd): add markdown formatters with unit tests"
```

---

## Task 6: Implement prd-indexer.ts

**Files:**
- Create: `scripts/prd-indexer.ts`

This is the main script. It wires together the pure functions from `parser.ts` and `inferrer.ts`, adds filesystem scanning and git execution, and writes `docs/project-index.json`.

- [ ] **Step 1: Create `scripts/prd-indexer.ts`**

```typescript
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { parseRequirements } from './parser.js';
import { inferStatus } from './inferrer.js';
import type { ProjectIndex, PackageStats, GitSummary, Commit, Requirement, Override } from './types.js';

const ROOT = resolve(import.meta.dirname, '..');

// ── 1. Collect all markdown files under docs/ ────────────────────────────────

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function extractRequirements(): Requirement[] {
  const docsDir = join(ROOT, 'docs');
  const files = collectMarkdownFiles(docsDir);
  const allReqs: Requirement[] = [];

  for (const absPath of files) {
    const relPath = relative(ROOT, absPath).replace(/\\/g, '/');
    const content = readFileSync(absPath, 'utf8');
    const reqs = parseRequirements(content, relPath);
    allReqs.push(...reqs);
  }

  // Deduplicate by id (same id = same source position, keep last)
  const seen = new Map<string, Requirement>();
  for (const r of allReqs) seen.set(r.id, r);
  return [...seen.values()];
}

// ── 2. Scan packages ──────────────────────────────────────────────────────────

function countLines(filePath: string): number {
  try {
    return readFileSync(filePath, 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function scanPackages(): Record<string, PackageStats> {
  const packagesDir = join(ROOT, 'packages');
  const result: Record<string, PackageStats> = {};
  if (!existsSync(packagesDir)) return result;

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(packagesDir, entry.name);
    const srcDir = join(pkgPath, 'src');
    const files = collectSourceFiles(srcDir);

    let totalLines = 0;
    let testFiles = 0;
    const exports: string[] = [];

    for (const file of files) {
      totalLines += countLines(file);
      if (/\.(test|spec)\.(ts|tsx)$/.test(file)) testFiles++;

      // Collect export names via regex
      const content = readFileSync(file, 'utf8');
      const exportMatches = content.matchAll(/export\s+(?:type\s+|interface\s+|function\s+|const\s+|class\s+)(\w+)/g);
      for (const m of exportMatches) exports.push(m[1]);
    }

    // Last modified: most recent mtime among source files
    let lastMtime = 0;
    for (const file of files) {
      const mtime = statSync(file).mtimeMs;
      if (mtime > lastMtime) lastMtime = mtime;
    }
    const lastModified = lastMtime > 0
      ? new Date(lastMtime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    result[entry.name] = {
      path: `packages/${entry.name}`,
      files: files.length,
      lines: totalLines,
      testFiles,
      exports,
      lastModified,
    };
  }

  return result;
}

// ── 3. Parse git history ──────────────────────────────────────────────────────

function runGit(args: string): string {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

function analyzeGit(): GitSummary {
  const logLines = runGit('log --oneline -20').trim().split('\n').filter(Boolean);
  const totalCommitsStr = runGit('rev-list --count HEAD').trim();
  const totalCommits = parseInt(totalCommitsStr, 10) || logLines.length;

  const recentCommits: Commit[] = [];
  for (const line of logLines) {
    const [hash, ...msgParts] = line.trim().split(' ');
    const message = msgParts.join(' ');
    // Get date for this commit
    const dateStr = runGit(`log -1 --format=%as ${hash}`).trim();
    // Get files changed in this commit
    const filesStr = runGit(`diff-tree --no-commit-id -r --name-only ${hash}`).trim();
    const files = filesStr.split('\n').filter(Boolean).map(f => f.replace(/\\/g, '/'));
    recentCommits.push({ hash, message, date: dateStr, files });
  }

  // Active files: changed in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString().split('T')[0];
  const activeFilesStr = runGit(`log --since="${since}" --name-only --format="" `).trim();
  const activeFiles = [...new Set(
    activeFilesStr.split('\n').filter(Boolean).map(f => f.replace(/\\/g, '/'))
  )];

  return { totalCommits, recentCommits, activeFiles };
}

// ── 4. Infer status for all requirements ─────────────────────────────────────

function applyStatusInference(
  requirements: Requirement[],
  packages: Record<string, PackageStats>,
  gitSummary: GitSummary,
  overrides: Record<string, Override>,
): Requirement[] {
  // Collect all export names across all packages
  const allExports = Object.values(packages).flatMap(p => p.exports);
  // Collect test file names for matching
  const testFileNames = Object.values(packages)
    .flatMap(p => [])  // We don't have individual test paths here, handled via testFiles count
    .join(' ');

  return requirements.map(req => {
    // Check override first
    const override = overrides[req.id];
    if (override) {
      return { ...req, status: override.status, statusSource: 'manual' as const, evidence: override.note ? [override.note] : [] };
    }

    const result = inferStatus(req, allExports, false, gitSummary.recentCommits);
    return { ...req, status: result.status, statusSource: 'auto' as const, evidence: result.evidence };
  });
}

// ── 5. Save index (preserving overrides) ─────────────────────────────────────

function loadExistingOverrides(): Record<string, Override> {
  const indexPath = join(ROOT, 'docs', 'project-index.json');
  if (!existsSync(indexPath)) return {};
  try {
    const existing = JSON.parse(readFileSync(indexPath, 'utf8')) as ProjectIndex;
    return existing.overrides ?? {};
  } catch {
    return {};
  }
}

function getLastCommitHash(): string {
  return runGit('rev-parse --short HEAD').trim() || 'unknown';
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log('📖 Scanning docs for requirements...');
  const rawRequirements = extractRequirements();
  console.log(`   Found ${rawRequirements.length} requirements`);

  console.log('📦 Scanning packages...');
  const packages = scanPackages();
  console.log(`   Scanned ${Object.keys(packages).length} packages`);

  console.log('🔀 Analyzing git history...');
  const gitSummary = analyzeGit();
  console.log(`   ${gitSummary.totalCommits} total commits, ${gitSummary.recentCommits.length} recent`);

  console.log('🔍 Loading existing overrides...');
  const overrides = loadExistingOverrides();
  console.log(`   ${Object.keys(overrides).length} overrides`);

  console.log('🧠 Inferring requirement status...');
  const requirements = applyStatusInference(rawRequirements, packages, gitSummary, overrides);
  const done = requirements.filter(r => r.status === 'done').length;
  const inProg = requirements.filter(r => r.status === 'in-progress').length;
  console.log(`   done: ${done}, in-progress: ${inProg}, not-started: ${requirements.length - done - inProg}`);

  const index: ProjectIndex = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    lastCommit: getLastCommitHash(),
    requirements,
    packages,
    gitSummary,
    overrides,
  };

  const outPath = join(ROOT, 'docs', 'project-index.json');
  writeFileSync(outPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`✅ Index written to docs/project-index.json (${requirements.length} requirements)`);
}

main();
```

- [ ] **Step 2: Run the indexer**

```bash
npm run prd:index
```

Expected output (approximate):
```
📖 Scanning docs for requirements...
   Found N requirements
📦 Scanning packages...
   Scanned 5 packages
🔀 Analyzing git history...
   6 total commits, 6 recent
🔍 Loading existing overrides...
   0 overrides
🧠 Inferring requirement status...
   done: X, in-progress: Y, not-started: Z
✅ Index written to docs/project-index.json (N requirements)
```

- [ ] **Step 3: Verify the output file exists and is valid JSON**

```bash
node -e "const idx = JSON.parse(require('fs').readFileSync('docs/project-index.json','utf8')); console.log('requirements:', idx.requirements.length, '| packages:', Object.keys(idx.packages).join(', '))"
```

Expected: prints counts of requirements and lists the 5 packages.

- [ ] **Step 4: Commit**

```bash
git add scripts/prd-indexer.ts docs/project-index.json
git commit -m "feat(prd): implement indexer — scans docs/code/git into project-index.json"
```

---

## Task 7: Implement prd-query.ts

**Files:**
- Create: `scripts/prd-query.ts`

Reads `docs/project-index.json` and runs one of three formatters based on the CLI argument.

- [ ] **Step 1: Create `scripts/prd-query.ts`**

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { formatSummary, formatProgress, formatRemaining } from './formatter.js';
import type { ProjectIndex } from './types.js';

const ROOT = resolve(import.meta.dirname, '..');
const INDEX_PATH = resolve(ROOT, 'docs', 'project-index.json');

type QueryType = 'summary' | 'progress' | 'remaining';

function loadIndex(): ProjectIndex {
  if (!existsSync(INDEX_PATH)) {
    console.error('⚠️  docs/project-index.json not found. Running indexer first...');
    execSync('npm run prd:index', { cwd: ROOT, stdio: 'inherit' });
  }
  return JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as ProjectIndex;
}

function parseQueryType(arg: string | undefined): QueryType {
  if (arg === 'progress') return 'progress';
  if (arg === 'remaining') return 'remaining';
  return 'summary';
}

function main() {
  const queryType = parseQueryType(process.argv[2]);
  const index = loadIndex();

  let output: string;
  switch (queryType) {
    case 'progress':
      output = formatProgress(index);
      break;
    case 'remaining':
      output = formatRemaining(index);
      break;
    default:
      output = formatSummary(index);
  }

  console.log(output);
}

main();
```

- [ ] **Step 2: Test all three query types**

```bash
npm run prd:query -- summary
```

Expected: markdown table of all requirements.

```bash
npm run prd:query -- progress
```

Expected: progress dashboard with package table and git activity.

```bash
npm run prd:query -- remaining
```

Expected: list of in-progress and not-started requirements.

- [ ] **Step 3: Commit**

```bash
git add scripts/prd-query.ts
git commit -m "feat(prd): implement query engine (summary/progress/remaining)"
```

---

## Task 8: Create Claude Code skill

**Files:**
- Create: `.claude/skills/prd/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/prd/SKILL.md`**

```markdown
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

1. Parse the user's subcommand from `$ARGUMENTS` (empty = summary, "progress", "remaining", "rebuild", or "override ...").
2. Run the appropriate bash command below.
3. Output the result directly.

### summary (default)

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
3. Write the file back
4. Print: "Override saved: REQ-ID → status"

Use the Edit tool to update docs/project-index.json directly.
Then run `npm run prd:index` to rebuild with the override applied.

## Error handling

If `docs/project-index.json` does not exist, the query engine will auto-rebuild it.
If the rebuild fails (no git, no docs), report the error and suggest running from the project root.
```

- [ ] **Step 2: Verify the skill file is valid**

```bash
ls .claude/skills/prd/SKILL.md
```

Expected: file exists.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/prd/SKILL.md
git commit -m "feat(prd): add Claude Code skill for /prd subcommands"
```

---

## Task 9: Run all tests + final integration check

- [ ] **Step 1: Run all unit tests**

```bash
npm run prd:test
```

Expected: all tests pass with 0 failures.

- [ ] **Step 2: Rebuild the index**

```bash
npm run prd:index
```

Expected: no errors, `docs/project-index.json` updated.

- [ ] **Step 3: Verify all three query outputs**

```bash
npm run prd:query -- summary | head -20
npm run prd:query -- progress
npm run prd:query -- remaining
```

Expected: each command outputs valid markdown with no errors.

- [ ] **Step 4: Verify index has no empty requirements array**

```bash
node -e "const i = JSON.parse(require('fs').readFileSync('docs/project-index.json','utf8')); console.log('reqs:', i.requirements.length, 'packages:', Object.keys(i.packages).length)"
```

Expected: `reqs: N` (>0), `packages: 5`.

- [ ] **Step 5: Final commit**

```bash
git add docs/project-index.json
git commit -m "chore(prd): update project-index.json after full integration test"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All 4 goals covered — requirement extraction (Tasks 3,6), status inference (Task 4), skill interface (Task 8), manual override (Task 8 override section)
- [x] **No TBD/TODO**: All steps contain actual code
- [x] **Type consistency**: `Requirement`, `ProjectIndex`, `Commit`, `Override` all defined in `types.ts` Task 2 and used consistently in Tasks 3-7
- [x] **Function names consistent**: `parseRequirements` (parser.ts), `inferStatus` (inferrer.ts), `formatSummary/formatProgress/formatRemaining` (formatter.ts) — same names in tests and implementations
- [x] **import.meta.dirname**: requires `"moduleResolution": "bundler"` (already in tsconfig.base.json) and tsx, which handles it correctly
