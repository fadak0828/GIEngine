// Core public API
export * from './models/types.js';
export { I18nManager } from './i18n/i18n.js';
export { validatePuzzle, validateSubPuzzle, validateFillInBlank } from './validator/validator.js';
export { validateProjectDefinition } from './validator/project-validator.js';
export type { ProjectIssue, ProjectIssueSeverity, ProjectIssueKind, ProjectIssueTarget, ProjectValidationResult } from './validator/project-validator.js';
export { transition } from './state/state-machine.js';
export { SaveManager } from './save/save-manager.js';
export { createInitialSaveState } from './save/initial-state.js';

// Template System
export type { ProjectTemplate, TemplateCategory, TemplateDefaultProperties, CreateProjectOptions } from './templates/index.js';
export { TemplateRegistry, defaultTemplateRegistry, blankTemplate, classicMysteryTemplate, tutorialTemplate } from './templates/index.js';
