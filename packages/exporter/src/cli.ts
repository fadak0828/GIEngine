#!/usr/bin/env node

import { bundle } from './bundler.js';

interface CliArgs {
  input: string;
  output: string;
  mode: 'development' | 'production';
  analyze: boolean;
  assetDir?: string;
}

function printUsage(): void {
  console.log(`
Usage: gi-export --input <game.json> --output <output.html> [options]

Options:
  --input, -i      Path to game.json (required)
  --output, -o     Path to output HTML file (required)
  --mode, -m       Build mode: "development" or "production" (default: production)
  --asset-dir      Base directory for resolving asset paths (default: dirname of input)
  --analyze        Print bundle size analysis
  --help, -h       Show this help message
`);
}

function parseArgs(argv: string[]): CliArgs | null {
  const args = argv.slice(2);

  let input = '';
  let output = '';
  let mode: 'development' | 'production' = 'production';
  let analyze = false;
  let assetDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--input':
      case '-i':
        input = args[++i] ?? '';
        break;
      case '--output':
      case '-o':
        output = args[++i] ?? '';
        break;
      case '--mode':
      case '-m': {
        const val = args[++i];
        if (val === 'development' || val === 'production') {
          mode = val;
        } else {
          console.error(`Invalid mode: "${val}". Use "development" or "production".`);
          return null;
        }
        break;
      }
      case '--asset-dir':
        assetDir = args[++i] ?? '';
        break;
      case '--analyze':
        analyze = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        return null;
    }
  }

  if (!input) {
    console.error('Error: --input is required.');
    printUsage();
    return null;
  }

  if (!output) {
    console.error('Error: --output is required.');
    printUsage();
    return null;
  }

  return { input, output, mode, analyze, assetDir };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args) {
    process.exit(1);
  }

  try {
    console.log(`[gi-export] Bundling ${args.input} → ${args.output} (${args.mode})`);

    const result = await bundle({
      input: args.input,
      output: args.output,
      mode: args.mode,
      analyze: args.analyze,
      assetDir: args.assetDir,
    });

    const sizeKB = (result.totalSize / 1024).toFixed(1);
    console.log(`[gi-export] Done! Output: ${result.outputPath} (${sizeKB} KB)`);
  } catch (err) {
    console.error('[gi-export] Bundle failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
