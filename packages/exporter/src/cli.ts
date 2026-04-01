#!/usr/bin/env node

import { bundle } from './bundler.js';
import { publishToItch } from './itch-publisher.js';

interface CliArgs {
  input: string;
  output: string;
  mode: 'development' | 'production';
  analyze: boolean;
  assetDir?: string;
  publishItch?: { pageId: string; apiKey?: string; dryRun?: boolean };
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
  --publish-itch   Publish to itch.io after bundling (requires --itch-page)
  --itch-page      itch.io page ID in "username/game-slug" format
  --itch-key       itch.io API key (or set ITCHIO_API_KEY env var)
  --itch-dry-run   Validate but do not actually push
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
  let publishItchPage: string | undefined;
  let itchApiKey: string | undefined;
  let itchDryRun = false;

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
      case '--publish-itch':
        // Flag only — requires --itch-page
        break;
      case '--itch-page':
        publishItchPage = args[++i] ?? '';
        break;
      case '--itch-key':
        itchApiKey = args[++i] ?? '';
        break;
      case '--itch-dry-run':
        itchDryRun = true;
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

  // Resolve API key from env if not provided via flag
  const resolvedApiKey = itchApiKey ?? process.env.ITCHIO_API_KEY;

  const publishItch =
    publishItchPage
      ? { pageId: publishItchPage, apiKey: resolvedApiKey, dryRun: itchDryRun }
      : undefined;

  return { input, output, mode, analyze, assetDir, publishItch };
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

    // itch.io publish step
    if (args.publishItch) {
      const { pageId, apiKey, dryRun } = args.publishItch;

      if (!pageId) {
        console.error('[gi-export] --itch-page is required for itch.io publishing.');
        process.exit(1);
      }

      console.log(`[gi-export] Preparing itch.io publish → ${pageId}`);

      // Load game definition for metadata
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const rawJson = await fs.readFile(args.input, 'utf-8');
      const gameDef = JSON.parse(rawJson);

      const publishResult = await publishToItch({
        htmlPath: result.outputPath,
        pageId,
        apiKey: apiKey ?? '',
        dryRun,
      }, gameDef);

      if (publishResult.success) {
        console.log(`[gi-export] ✅ itch.io 发布成功!`);
        console.log(`    Page: ${publishResult.pageUrl}`);
        console.log(`    Embed: ${publishResult.embedCode.slice(0, 80)}...`);
      } else {
        console.error(`[gi-export] ⚠️ itch.io 发布失败: ${publishResult.error}`);
        if (publishResult.pushCommand) {
          console.error(`    手动推送命令: ${publishResult.pushCommand}`);
        }
        if (!publishResult.success) process.exit(1);
      }
    }
  } catch (err) {
    console.error('[gi-export] Bundle failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
