import { describe, it, expect, beforeEach } from 'vitest';
import {
  TemplateRegistry,
  defaultTemplateRegistry,
  blankTemplate,
  classicMysteryTemplate,
  tutorialTemplate,
} from '../src/templates/index.js';
import type { ProjectTemplate } from '../src/templates/index.js';

// ============================================================
// TemplateRegistry — 유닛 테스트
// ============================================================

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  it('초기에는 비어 있어야 한다', () => {
    expect(registry.size).toBe(0);
    expect(registry.getTemplates()).toHaveLength(0);
  });

  it('템플릿을 등록하고 조회할 수 있어야 한다', () => {
    registry.register(blankTemplate);
    expect(registry.size).toBe(1);
    expect(registry.has('blank')).toBe(true);
    expect(registry.getTemplateById('blank')).toBe(blankTemplate);
  });

  it('존재하지 않는 id 조회 시 undefined를 반환해야 한다', () => {
    expect(registry.getTemplateById('non-existent')).toBeUndefined();
  });

  it('has()는 존재하지 않는 id에 false를 반환해야 한다', () => {
    expect(registry.has('blank')).toBe(false);
    registry.register(blankTemplate);
    expect(registry.has('blank')).toBe(true);
  });

  it('동일 id 재등록 시 덮어써야 한다', () => {
    registry.register(blankTemplate);
    const modifiedTemplate: ProjectTemplate = {
      ...blankTemplate,
      name: { ko: '수정된 빈 프로젝트', en: 'Modified Blank' },
    };
    registry.register(modifiedTemplate);
    expect(registry.size).toBe(1);
    expect(registry.getTemplateById('blank')?.name.ko).toBe('수정된 빈 프로젝트');
  });

  it('여러 템플릿을 등록하고 전체 목록을 조회할 수 있어야 한다', () => {
    registry.register(blankTemplate);
    registry.register(classicMysteryTemplate);
    registry.register(tutorialTemplate);
    expect(registry.size).toBe(3);
    const all = registry.getTemplates();
    expect(all).toHaveLength(3);
    const ids = all.map(t => t.id);
    expect(ids).toContain('blank');
    expect(ids).toContain('classic-mystery');
    expect(ids).toContain('tutorial');
  });

  it('카테고리로 필터링할 수 있어야 한다', () => {
    registry.register(blankTemplate);
    registry.register(classicMysteryTemplate);
    registry.register(tutorialTemplate);

    const blanks = registry.getTemplatesByCategory('blank');
    expect(blanks).toHaveLength(1);
    expect(blanks[0].id).toBe('blank');

    const mysteries = registry.getTemplatesByCategory('mystery');
    expect(mysteries).toHaveLength(1);
    expect(mysteries[0].id).toBe('classic-mystery');

    const tutorials = registry.getTemplatesByCategory('tutorial');
    expect(tutorials).toHaveLength(1);
    expect(tutorials[0].id).toBe('tutorial');

    const customs = registry.getTemplatesByCategory('custom');
    expect(customs).toHaveLength(0);
  });

  describe('createProjectFromTemplate()', () => {
    it('존재하지 않는 템플릿 id 사용 시 에러를 던져야 한다', () => {
      expect(() => registry.createProjectFromTemplate('unknown')).toThrowError(
        /not found/i,
      );
    });

    it('blank 템플릿으로 프로젝트를 생성할 수 있어야 한다', () => {
      registry.register(blankTemplate);
      const project = registry.createProjectFromTemplate('blank');
      expect(project.id).toBe('new-project');
      expect(project.acts).toHaveLength(1);
      expect(project.acts[0].cases).toHaveLength(1);
    });

    it('옵션을 통해 프로젝트 id와 제목을 커스터마이즈할 수 있어야 한다', () => {
      registry.register(blankTemplate);
      const project = registry.createProjectFromTemplate('blank', {
        projectId: 'my-game',
        title: { ko: '내 게임', en: 'My Game' },
      });
      expect(project.id).toBe('my-game');
      expect(project.title.ko).toBe('내 게임');
      expect(project.title.en).toBe('My Game');
    });
  });
});

// ============================================================
// 내장 템플릿 — 구조 유효성 검사
// ============================================================

describe('blankTemplate', () => {
  it('올바른 메타데이터를 가져야 한다', () => {
    expect(blankTemplate.id).toBe('blank');
    expect(blankTemplate.category).toBe('blank');
    expect(blankTemplate.name.ko).toBeTruthy();
    expect(blankTemplate.name.en).toBeTruthy();
    expect(blankTemplate.description.ko).toBeTruthy();
    expect(blankTemplate.description.en).toBeTruthy();
  });

  it('createProject()가 유효한 GameDefinition을 반환해야 한다', () => {
    const def = blankTemplate.createProject();
    expect(def.id).toBeTruthy();
    expect(def.version).toBeTruthy();
    expect(def.acts).toHaveLength(1);
    expect(def.acts[0].cases).toHaveLength(1);
    expect(def.acts[0].cases[0].scenes).toHaveLength(1);
    expect(def.assets).toBeDefined();
    expect(def.supportedLocales).toContain('ko');
    expect(def.supportedLocales).toContain('en');
  });

  it('설정값이 유효한 기본값을 가져야 한다', () => {
    const def = blankTemplate.createProject();
    expect(def.settings.validationFeedbackDuration).toBeGreaterThan(0);
    expect(def.settings.autoSaveInterval).toBeGreaterThan(0);
    expect(typeof def.settings.debug).toBe('boolean');
  });
});

describe('classicMysteryTemplate', () => {
  it('올바른 메타데이터를 가져야 한다', () => {
    expect(classicMysteryTemplate.id).toBe('classic-mystery');
    expect(classicMysteryTemplate.category).toBe('mystery');
    expect(classicMysteryTemplate.name.ko).toBeTruthy();
    expect(classicMysteryTemplate.defaultProperties?.features).toContain('deduction-puzzle');
  });

  it('createProject()가 2개의 씬을 포함한 GameDefinition을 반환해야 한다', () => {
    const def = classicMysteryTemplate.createProject();
    const caseData = def.acts[0].cases[0];
    expect(caseData.scenes).toHaveLength(2);
    // 단어는 GameDefinition.words에 정의됨
    expect(Object.keys(def.words ?? {})).toHaveLength(3);
  });

  it('퍼즐 세그먼트에 슬롯이 존재해야 한다', () => {
    const def = classicMysteryTemplate.createProject();
    const puzzle = def.acts[0].cases[0].puzzles.main;
    // Puzzle.template.segments 경로로 접근
    const slots = puzzle.template.segments.filter(s => s.type === 'slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
  });

  it('옵션으로 프로젝트 id를 지정할 수 있어야 한다', () => {
    const def = classicMysteryTemplate.createProject({ projectId: 'my-mystery' });
    expect(def.id).toBe('my-mystery');
  });
});

describe('tutorialTemplate', () => {
  it('올바른 메타데이터를 가져야 한다', () => {
    expect(tutorialTemplate.id).toBe('tutorial');
    expect(tutorialTemplate.category).toBe('tutorial');
    expect(tutorialTemplate.defaultProperties?.suggestedSceneCount).toBe(3);
    expect(tutorialTemplate.defaultProperties?.features).toContain('navigation');
    expect(tutorialTemplate.defaultProperties?.features).toContain('clue-collection');
  });

  it('createProject()가 3개의 씬을 포함해야 한다', () => {
    const def = tutorialTemplate.createProject();
    const scenes = def.acts[0].cases[0].scenes;
    expect(scenes).toHaveLength(3);
    expect(scenes[0].id).toBe('scene-tutorial-move');
    expect(scenes[1].id).toBe('scene-tutorial-clues');
    expect(scenes[2].id).toBe('scene-tutorial-puzzle');
  });

  it('2번 씬에 단서 수집 핫스팟이 있어야 한다', () => {
    const def = tutorialTemplate.createProject();
    const clueScene = def.acts[0].cases[0].scenes[1];
    const collectingHotspots = clueScene.hotspots.filter(h => {
      const action = h.action as { type: string; collectibleWords?: unknown[] };
      return action.type === 'examine' && Array.isArray(action.collectibleWords) && action.collectibleWords.length > 0;
    });
    expect(collectingHotspots.length).toBeGreaterThanOrEqual(2);
  });

  it('퍼즐에 슬롯이 2개 이상 있어야 한다', () => {
    const def = tutorialTemplate.createProject();
    const puzzle = def.acts[0].cases[0].puzzles.main;
    // Puzzle.template.segments 경로로 접근
    const slots = puzzle.template.segments.filter(s => s.type === 'slot');
    expect(slots.length).toBeGreaterThanOrEqual(2);
  });

  it('debug 모드가 활성화되어 있어야 한다', () => {
    const def = tutorialTemplate.createProject();
    expect(def.settings.debug).toBe(true);
  });
});

// ============================================================
// defaultTemplateRegistry — 통합 테스트
// ============================================================

describe('defaultTemplateRegistry', () => {
  it('3개의 내장 템플릿이 등록되어 있어야 한다', () => {
    expect(defaultTemplateRegistry.size).toBe(3);
  });

  it('getTemplates()가 3개를 반환해야 한다', () => {
    const templates = defaultTemplateRegistry.getTemplates();
    expect(templates).toHaveLength(3);
  });

  it('blank, classic-mystery, tutorial을 id로 조회할 수 있어야 한다', () => {
    expect(defaultTemplateRegistry.getTemplateById('blank')).toBeDefined();
    expect(defaultTemplateRegistry.getTemplateById('classic-mystery')).toBeDefined();
    expect(defaultTemplateRegistry.getTemplateById('tutorial')).toBeDefined();
  });

  it('createProjectFromTemplate()이 각 템플릿에서 동작해야 한다', () => {
    const blank = defaultTemplateRegistry.createProjectFromTemplate('blank');
    const mystery = defaultTemplateRegistry.createProjectFromTemplate('classic-mystery');
    const tutorial = defaultTemplateRegistry.createProjectFromTemplate('tutorial');

    expect(blank.id).toBeTruthy();
    expect(mystery.id).toBeTruthy();
    expect(tutorial.id).toBeTruthy();

    // 각 프로젝트가 독립적으로 생성되어야 함
    expect(blank).not.toBe(mystery);
    expect(blank).not.toBe(tutorial);
  });
});
