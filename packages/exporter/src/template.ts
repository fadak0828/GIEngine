/**
 * HTML template assembly for single-file game export.
 */

export interface AssembleHtmlOptions {
  title: string;
  css: string;
  js: string;
  gameData: string;
  lang: string;
  description?: string;
  author?: string;
  ogImage?: string;
}

/**
 * Assembles a complete, self-contained HTML document containing
 * the game runtime, styles, and game data.
 */
export function assembleHtml(options: AssembleHtmlOptions): string {
  const { title, css, js, gameData, lang, description, author, ogImage } = options;

  // Escape </script> inside embedded JSON/JS to prevent premature tag closing
  const safeGameData = gameData.replace(/<\/script>/gi, '<\\/script>');
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

  const ogTags = buildOgTags({ title, description, author, ogImage });

  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>${escapeHtml(title)}</title>
${ogTags}
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { background: #0a0a0a; color: #e0e0e0; font-family: system-ui, -apple-system, sans-serif; }
    #gi-engine-root { width: 100%; height: 100%; position: relative; }
    .gi-loading { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 1.5rem; }
${css}
  </style>
</head>
<body>
  <div id="gi-engine-root">
    <div class="gi-loading">Loading...</div>
  </div>

  <script type="application/json" id="gi-game-data">
${safeGameData}
  </script>

  <script>
(function() {
  'use strict';

  // Parse game data
  var dataEl = document.getElementById('gi-game-data');
  if (!dataEl) { console.error('GIEngine: game data not found'); return; }

  var gameData;
  try {
    gameData = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    console.error('GIEngine: failed to parse game data', e);
    return;
  }

  // Make game data available globally for the runtime
  window.__GI_GAME_DATA__ = gameData;

  // Runtime code
${safeJs}

  // Auto-boot if runtime exposes a boot function
  if (typeof window.__giEngineBoot__ === 'function') {
    window.__giEngineBoot__(document.getElementById('gi-engine-root'), gameData);
  }
})();
  </script>
</body>
</html>`;
}

function buildOgTags(opts: {
  title: string;
  description?: string;
  author?: string;
  ogImage?: string;
}): string {
  const lines: string[] = [];
  const t = escapeAttr(opts.title);
  lines.push(`  <meta property="og:type" content="website">`);
  lines.push(`  <meta property="og:title" content="${t}">`);
  lines.push(`  <meta name="twitter:card" content="summary_large_image">`);
  lines.push(`  <meta name="twitter:title" content="${t}">`);
  if (opts.description) {
    const d = escapeAttr(opts.description);
    lines.push(`  <meta property="og:description" content="${d}">`);
    lines.push(`  <meta name="twitter:description" content="${d}">`);
    lines.push(`  <meta name="description" content="${d}">`);
  }
  if (opts.author) {
    lines.push(`  <meta name="author" content="${escapeAttr(opts.author)}">`);
  }
  if (opts.ogImage) {
    const img = escapeAttr(opts.ogImage);
    lines.push(`  <meta property="og:image" content="${img}">`);
    lines.push(`  <meta name="twitter:image" content="${img}">`);
  }
  return lines.join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
