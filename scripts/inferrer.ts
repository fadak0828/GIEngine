import type { Requirement, RequirementStatus, Commit } from './types.js';

export interface InferResult {
  status: RequirementStatus;
  evidence: string[];
}

/**
 * Infer requirement status from code exports and recent commits. Pure function.
 *
 * @param req           - The requirement to evaluate
 * @param allExports    - All export names collected from source files
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
