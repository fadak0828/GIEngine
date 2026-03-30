/**
 * Browser-safe entry point for @gi-engine/exporter.
 * Excludes Node.js-only modules (bundler, asset-inliner).
 */
export { assembleHtml } from './template.js';
export type { AssembleHtmlOptions } from './template.js';
export { browserExport } from './browser-export.js';
export type { BrowserExportOptions, BrowserExportResult } from './browser-export.js';
