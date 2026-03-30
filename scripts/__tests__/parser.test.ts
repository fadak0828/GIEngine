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
