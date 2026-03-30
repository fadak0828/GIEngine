import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseRequirements } from './parser.js';
import { inferStatus } from './inferrer.js';
import type { ProjectIndex, PackageStats, GitSummary, Commit, Requirement, Override } from './types.js';

const __dirname = typeof import.meta.dirname !== 'undefined'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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
