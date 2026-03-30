/**
 * Runtime placeholder constants for use in both Node.js bundler and browser export.
 * Zero Node.js imports — this file must remain browser-safe.
 */

export const PLACEHOLDER_RUNTIME_JS = `
// GIEngine Runtime Placeholder (Phase 1-3)
// The full runtime will be built from packages/runtime
console.log('[GIEngine] Runtime placeholder loaded');
window.__giEngineBoot__ = function(root, gameData) {
  root.innerHTML = '';
  var container = document.createElement('div');
  container.style.cssText = 'padding:2rem;font-family:system-ui;max-width:800px;margin:0 auto;';

  var title = document.createElement('h1');
  var locale = navigator.language.startsWith('ko') ? 'ko' : 'en';
  title.textContent = gameData.title[locale] || gameData.title.ko || gameData.title.en;
  title.style.cssText = 'margin-bottom:1rem;color:#f0f0f0;';
  container.appendChild(title);

  var desc = document.createElement('p');
  desc.textContent = gameData.description[locale] || gameData.description.ko || gameData.description.en;
  desc.style.cssText = 'margin-bottom:2rem;color:#aaa;';
  container.appendChild(desc);

  var info = document.createElement('pre');
  info.style.cssText = 'background:#1a1a2e;padding:1rem;border-radius:8px;overflow:auto;color:#8be9fd;font-size:0.85rem;';
  var summary = {
    id: gameData.id,
    version: gameData.version,
    acts: gameData.acts.length,
    totalCases: gameData.acts.reduce(function(sum, act) { return sum + act.cases.length; }, 0),
    assets: Object.keys(gameData.assets.items).length,
    locales: gameData.supportedLocales
  };
  info.textContent = JSON.stringify(summary, null, 2);
  container.appendChild(info);

  var note = document.createElement('p');
  note.textContent = '[Runtime placeholder - full runtime coming in Phase 4]';
  note.style.cssText = 'margin-top:1rem;color:#666;font-style:italic;';
  container.appendChild(note);

  root.appendChild(container);
};
`.trim();

export const PLACEHOLDER_RUNTIME_CSS = `
/* GIEngine Runtime CSS Placeholder */
`;
