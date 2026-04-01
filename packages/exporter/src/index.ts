// Exporter public API
export { inlineAssets, getInlinedAssetsSize } from './asset-inliner.js';
export { assembleHtml } from './template.js';
export type { AssembleHtmlOptions } from './template.js';
export { bundle } from './bundler.js';
export type { BundleOptions, BundleResult } from './bundler.js';
export { browserExport } from './browser-export.js';
export type { BrowserExportOptions, BrowserExportResult } from './browser-export.js';
export {
  publishToItch,
  validateCredentials,
  stageForItch,
  checkButler,
  generateItchMetadata,
  generateEmbedCode,
  downloadItchTxt,
} from './itch-publisher.js';
export type {
  ItchCredentials,
  ItchPageOptions,
  ItchPublishOptions,
  ItchPublishResult,
  ItchMetadataResult,
} from './itch-publisher.js';
