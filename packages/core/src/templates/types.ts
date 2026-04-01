// ============================================================
// Template System Types
// ============================================================

import type { GameDefinition, LocalizedText } from '../models/types.js';

/** 템플릿 카테고리 */
export type TemplateCategory =
  | 'blank'
  | 'mystery'
  | 'tutorial'
  | 'custom';

/** 프로젝트 템플릿 정의 */
export interface ProjectTemplate {
  /** 고유 식별자 */
  id: string;
  /** 표시 이름 (다국어) */
  name: LocalizedText;
  /** 템플릿 설명 (다국어) */
  description: LocalizedText;
  /** 카테고리 */
  category: TemplateCategory;
  /** 썸네일 이미지 경로 (선택) */
  thumbnail?: string;
  /** 기본 프로퍼티 힌트 (에디터 UI에서 활용) */
  defaultProperties?: TemplateDefaultProperties;
  /** 템플릿으로부터 GameDefinition 생성 */
  createProject: (options?: CreateProjectOptions) => GameDefinition;
}

/** 템플릿 기본 프로퍼티 */
export interface TemplateDefaultProperties {
  suggestedSceneCount?: number;
  suggestedActCount?: number;
  features?: string[];
}

/** 프로젝트 생성 옵션 */
export interface CreateProjectOptions {
  /** 새 프로젝트 ID (미지정 시 템플릿 기본값 사용) */
  projectId?: string;
  /** 프로젝트 제목 */
  title?: LocalizedText;
  /** 로케일 설정 */
  locale?: 'ko' | 'en' | 'both';
}
