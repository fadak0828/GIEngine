/**
 * itch.io Publishing Integration
 *
 * Provides utilities for publishing GIEngine games to itch.io via Butler,
 * generating embeddable widgets, and managing itch.io page metadata.
 *
 * Note: Full Butler push requires a Node.js environment with the `butler` CLI
 * installed. The browser-based editor flow generates the necessary artifacts
 * (HTML export + metadata) and shows the Butler push command for the user.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GameDefinition } from '@gi-engine/core';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ItchCredentials {
  /** itch.io API key (from https://itch.io/user/settings/api-keys) */
  apiKey: string;
  /** Username on itch.io */
  username: string;
}

export interface ItchPageOptions {
  /** The game/user page URL, e.g. "username/my-game" */
  pageId: string;
  /** Human-readable title (shown in publish summary) */
  title: string;
  /** Short description (used in itch.txt metadata) */
  shortDescription: string;
  /** Whether to publish as HTML5 web game (default: true) */
  htmlGame?: boolean;
  /** Cover image path (optional — will be embedded in itch.txt if provided) */
  coverImage?: string;
}

export interface ItchPublishOptions {
  /** Path to the exported HTML file */
  htmlPath: string;
  /** itch.io page ID (username/game-slug) */
  pageId: string;
  /** itch.io API key */
  apiKey: string;
  /** Version label (e.g. "v1.0.0" or "2026-04-01") */
  versionLabel?: string;
  /** Directory for staging files (default: temp directory) */
  stagingDir?: string;
  /** Dry run — only validate credentials and prepare files */
  dryRun?: boolean;
}

export interface ItchPublishResult {
  success: boolean;
  pageId: string;
  pageUrl: string;
  /** The directory that was (or would be) pushed */
  stagingDir: string;
  /** Suggested butler push command if dryRun */
  pushCommand?: string;
  /** Embed code for iframe insertion */
  embedCode: string;
  error?: string;
}

export interface ItchMetadataResult {
  /** Generated itch.txt content */
  itchTxt: string;
  /** Default HTML embed snippet */
  embedSnippet: string;
  /** Example Butler push command */
  butlerPushCommand: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ITCH_API_BASE = 'https://itch.io';
const ITCH_WIDGET_HEIGHT = '540';
const ITCH_WIDGET_WIDTH = '960';

// ─── Metadata Generation ─────────────────────────────────────────────────────

/**
 * Generates itch.txt metadata content for a GIEngine game.
 * itch.txt is the standard metadata format used by Butler.
 */
export function generateItchMetadata(
  gameDef: GameDefinition,
  htmlFileName: string,
  options?: { coverImage?: string; tags?: string[] }
): ItchMetadataResult {
  const title = gameDef.title.ko ?? gameDef.title.en ?? 'GIEngine Game';
  const description = gameDef.description?.ko ?? gameDef.description?.en ?? title;

  // Build itch.txt format
  const lines: string[] = [
    `title: ${title}`,
    `itchseite: html`,
  ];

  if (options?.coverImage) {
    lines.push(`cover: ${options.coverImage}`);
  }

  if (options?.tags && options.tags.length > 0) {
    lines.push(`tags: ${options.tags.join(', ')}`);
  }

  // Add GIEngine attribution
  lines.push('');
  lines.push(`## GIEngine Game`);
  lines.push(`Created with [GIEngine](https://github.com/paperclip-ai/GIEngine) — investigação interativa em Koreano.`);

  const itchTxt = lines.join('\n');

  const embedSnippet = `<iframe
  src="https://YOUR-USERNAME.itch.io/YOUR-GAME-SLUG/${htmlFileName}"
  width="${ITCH_WIDGET_WIDTH}"
  height="${ITCH_WIDGET_HEIGHT}"
  frameborder="0"
  allowfullscreen>
</iframe>`;

  const butlerPushCommand = `butler push ./build username/game-slug --latest`;

  return {
    itchTxt,
    embedSnippet,
    butlerPushCommand,
  };
}

// ─── Credential Validation ────────────────────────────────────────────────────

/**
 * Validates itch.io API credentials by attempting to fetch user info.
 * Returns the authenticated username on success.
 */
export async function validateCredentials(
  credentials: ItchCredentials
): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    const response = await fetch(`${ITCH_API_BASE}/api/1/me`, {
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: 'API 키가 유효하지 않습니다. itch.io 설정에서 새 API 키를 발급받아 주세요.' };
      }
      return { valid: false, error: `itch.io API 오류: HTTP ${response.status}` };
    }

    const data = (await response.json()) as { username?: string };
    return { valid: true, username: data.username ?? credentials.username };
  } catch (err) {
    return {
      valid: false,
      error: `네트워크 오류: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Staging Directory ────────────────────────────────────────────────────────

/**
 * Creates a staging directory with the exported HTML and itch.txt metadata.
 * Returns the path to the staging directory.
 */
export async function stageForItch(
  htmlPath: string,
  gameDef: GameDefinition,
  options?: {
    stagingDir?: string;
    coverImage?: string;
    tags?: string[];
  }
): Promise<string> {
  const htmlFileName = path.basename(htmlPath);
  const stagingDir = options?.stagingDir ?? path.join(path.dirname(htmlPath), `.itch-staging-${Date.now()}`);

  await fs.mkdir(stagingDir, { recursive: true });

  // Copy the HTML file
  const destHtml = path.join(stagingDir, htmlFileName);
  await fs.copyFile(htmlPath, destHtml);

  // Generate and write itch.txt
  const { itchTxt } = generateItchMetadata(gameDef, htmlFileName, {
    coverImage: options?.coverImage,
    tags: options?.tags,
  });
  await fs.writeFile(path.join(stagingDir, 'itch.txt'), itchTxt, 'utf-8');

  // Copy cover image if specified and exists
  if (options?.coverImage) {
    try {
      await fs.copyFile(options.coverImage, path.join(stagingDir, path.basename(options.coverImage)));
    } catch {
      // Non-fatal — Butler will warn
    }
  }

  return stagingDir;
}

// ─── Butler Check ─────────────────────────────────────────────────────────────

/**
 * Checks if Butler CLI is installed and accessible.
 * Returns version string if found, null if not installed.
 */
export async function checkButler(): Promise<{ installed: boolean; version?: string; path?: string }> {
  const { execSync } = await import('node:child_process');
  const candidates = ['butler', 'butler.exe'];

  for (const cmd of candidates) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf-8', timeout: 5000 }).trim();
      return { installed: true, version, path: cmd };
    } catch {
      // Try next candidate
    }
  }

  return { installed: false };
}

// ─── Main Publish Function ────────────────────────────────────────────────────

/**
 * Full itch.io publish flow:
 * 1. Validate credentials
 * 2. Stage files (HTML + itch.txt)
 * 3. Push via Butler (if not dryRun)
 *
 * Returns a result with page URL and embed code.
 */
export async function publishToItch(
  options: ItchPublishOptions,
  gameDef: GameDefinition
): Promise<ItchPublishResult> {
  const { htmlPath, pageId, versionLabel = new Date().toISOString().slice(0, 10) } = options;
  const htmlFileName = path.basename(htmlPath);

  // 1. Validate inputs
  if (!pageId || !pageId.includes('/')) {
    return {
      success: false,
      pageId,
      pageUrl: `https://itch.io/${pageId}`,
      stagingDir: '',
      embedCode: '',
      error: 'pageId는 "username/game-slug" 형식이어야 합니다.',
    };
  }

  try {
    await fs.access(htmlPath);
  } catch {
    return {
      success: false,
      pageId,
      pageUrl: `https://itch.io/${pageId}`,
      stagingDir: '',
      embedCode: '',
      error: `HTML 파일을 찾을 수 없습니다: ${htmlPath}`,
    };
  }

  // 2. Stage the files
  const stagingDir = await stageForItch(htmlPath, gameDef, {
    stagingDir: options.stagingDir,
  });

  const pageUrl = `https://itch.io/${pageId}`;

  // 3. Push via Butler if not dryRun
  if (!options.dryRun) {
    const butlerCheck = await checkButler();
    if (!butlerCheck.installed) {
      return {
        success: false,
        pageId,
        pageUrl,
        stagingDir,
        embedCode: generateEmbedCode(pageId, htmlFileName),
        pushCommand: `butler push "${stagingDir}" ${pageId}`,
        error: 'Butler CLI가 설치되어 있지 않습니다. https://itch.io/butler 에서 설치해 주세요.',
      };
    }

    const { execSync } = await import('node:child_process');
    try {
      const cmd = `butler push "${stagingDir}" ${pageId}`;
      execSync(cmd, { encoding: 'utf-8', stdio: 'pipe', timeout: 120_000 });
    } catch (err) {
      const stderr = err instanceof Error && 'stderr' in err ? (err as Error & { stderr?: string }).stderr : '';
      return {
        success: false,
        pageId,
        pageUrl,
        stagingDir,
        embedCode: generateEmbedCode(pageId, htmlFileName),
        pushCommand: `butler push "${stagingDir}" ${pageId}`,
        error: `Butler 푸시 실패: ${stderr || (err instanceof Error ? err.message : String(err))}`,
      };
    }
  }

  return {
    success: true,
    pageId,
    pageUrl,
    stagingDir,
    embedCode: generateEmbedCode(pageId, htmlFileName),
    pushCommand: `butler push "${stagingDir}" ${pageId}`,
  };
}

// ─── Embed Code Generator ──────────────────────────────────────────────────────

/**
 * Generates a complete iframe embed code for an itch.io game page.
 */
export function generateEmbedCode(pageId: string, htmlFileName: string): string {
  const cleanId = pageId.replace(/\s+/g, '-').toLowerCase();
  const src = `https://${cleanId}.itch.io/${htmlFileName}`;
  return [
    `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;">`,
    `  <iframe`,
    `    src="${src}"`,
    `    width="${ITCH_WIDGET_WIDTH}"`,
    `    height="${ITCH_WIDGET_HEIGHT}"`,
    `    frameborder="0"`,
    `    allowfullscreen`,
    `    style="position:absolute;top:0;left:0;width:100%;height:100%;"`,
    `  ></iframe>`,
    `</div>`,
    `<p><a href="https://itch.io/${cleanId}">Play on itch.io</a></p>`,
  ].join('\n');
}

// ─── Browser-Only Helpers ─────────────────────────────────────────────────────

/**
 * Creates a downloadable itch.txt file for the user to include
 * in their Butler push workflow. Safe to call in the browser.
 */
export function downloadItchTxt(gameDef: GameDefinition, htmlFileName: string): void {
  const { itchTxt } = generateItchMetadata(gameDef, htmlFileName);
  const blob = new Blob([itchTxt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'itch.txt';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
