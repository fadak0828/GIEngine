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
