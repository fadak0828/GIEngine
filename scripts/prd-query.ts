import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { formatSummary, formatProgress, formatRemaining } from './formatter.js';
import type { ProjectIndex } from './types.js';

const __dirname = typeof import.meta.dirname !== 'undefined'
  ? import.meta.dirname
  : dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const INDEX_PATH = resolve(ROOT, 'docs', 'project-index.json');

type QueryType = 'summary' | 'progress' | 'remaining';

function loadIndex(): ProjectIndex {
  if (!existsSync(INDEX_PATH)) {
    console.error('⚠️  docs/project-index.json not found. Running indexer first...');
    try {
      execSync('npm run prd:index', { cwd: ROOT, stdio: 'inherit' });
    } catch {
      console.error('❌ Failed to build index. Run: npm run prd:index');
      process.exit(1);
    }
  }
  try {
    return JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as ProjectIndex;
  } catch (err) {
    console.error(`❌ Failed to read docs/project-index.json: ${err}`);
    process.exit(1);
  }
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
