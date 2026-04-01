// ============================================================
// Template System — Public API
// ============================================================

export type {
  ProjectTemplate,
  TemplateCategory,
  TemplateDefaultProperties,
  CreateProjectOptions,
} from './types.js';

export { TemplateRegistry } from './registry.js';

// 내장 템플릿
export { blankTemplate } from './blank.js';
export { classicMysteryTemplate } from './classic-mystery.js';
export { tutorialTemplate } from './tutorial.js';

// 미리 구성된 기본 레지스트리 (즉시 사용 가능)
import { TemplateRegistry } from './registry.js';
import { blankTemplate } from './blank.js';
import { classicMysteryTemplate } from './classic-mystery.js';
import { tutorialTemplate } from './tutorial.js';

/**
 * 3개의 내장 템플릿이 등록된 기본 레지스트리입니다.
 * 에디터에서 `defaultTemplateRegistry.getTemplates()` 등으로 바로 사용할 수 있습니다.
 */
export const defaultTemplateRegistry = new TemplateRegistry();
defaultTemplateRegistry.register(blankTemplate);
defaultTemplateRegistry.register(classicMysteryTemplate);
defaultTemplateRegistry.register(tutorialTemplate);
