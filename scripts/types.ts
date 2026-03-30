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
