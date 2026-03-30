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
