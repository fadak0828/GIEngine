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
