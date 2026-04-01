// ============================================================
// TemplateRegistry — 템플릿 등록/조회/카테고리 관리
// ============================================================

import type { GameDefinition } from '../models/types.js';
import type {
  ProjectTemplate,
  TemplateCategory,
  CreateProjectOptions,
} from './types.js';

export class TemplateRegistry {
  private readonly templates = new Map<string, ProjectTemplate>();

  /**
   * 템플릿을 레지스트리에 등록합니다.
   * 동일 id가 이미 존재하면 덮어씁니다.
   */
  register(template: ProjectTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 등록된 모든 템플릿을 반환합니다.
   */
  getTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * id로 특정 템플릿을 조회합니다.
   * 없으면 undefined를 반환합니다.
   */
  getTemplateById(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 카테고리로 템플릿 목록을 필터링합니다.
   */
  getTemplatesByCategory(category: TemplateCategory): ProjectTemplate[] {
    return this.getTemplates().filter(t => t.category === category);
  }

  /**
   * 템플릿으로부터 새 GameDefinition을 생성합니다.
   * @throws Error — 템플릿 id를 찾을 수 없는 경우
   */
  createProjectFromTemplate(
    templateId: string,
    options?: CreateProjectOptions,
  ): GameDefinition {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: "${templateId}"`);
    }
    return template.createProject(options);
  }

  /**
   * 등록된 템플릿 수를 반환합니다.
   */
  get size(): number {
    return this.templates.size;
  }

  /**
   * 특정 id의 템플릿이 등록되어 있는지 확인합니다.
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }
}
