/**
 * HTML template assembly for single-file game export.
 */

export interface AssembleHtmlOptions {
  title: string;
  css: string;
  js: string;
  gameData: string;
  lang: string;
}

/**
 * Assembles a complete, self-contained HTML document containing
 * the game runtime, styles, and game data.
 */
export function assembleHtml(options: AssembleHtmlOptions): string {
  const { title, css, js, gameData, lang } = options;

  // Escape </script> inside embedded JSON/JS to prevent premature tag closing
  const safeGameData = gameData.replace(/<\/script>/gi, '<\\/script>');
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="${escapeAttr(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>${escapeHtml(title)}</title>
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
