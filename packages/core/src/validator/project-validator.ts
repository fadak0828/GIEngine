import type { GameDefinition, Word } from '../models/types.js';

export type ProjectIssueSeverity = 'error' | 'warning';

export type ProjectIssueKind =
  | 'broken_scene_ref'
  | 'broken_word_ref'
  | 'missing_asset'
  | 'empty_puzzle_answers';

export interface ProjectIssueTarget {
  type: 'scene' | 'hotspot' | 'puzzle';
  caseId: string;
  sceneId?: string;
  hotspotId?: string;
}

export interface ProjectIssue {
  severity: ProjectIssueSeverity;
  kind: ProjectIssueKind;
  message: string;
  target?: ProjectIssueTarget;
}

export interface ProjectValidationResult {
  issues: ProjectIssue[];
  errorCount: number;
  warningCount: number;
  isValid: boolean;
}

/**
 * 에디터 내에서 GameDefinition 구조적 무결성을 검사.
 * 런타임 퍼즐 검증(validator.ts)과 별개로, 내보내기 전 깨진 참조 및 누락 에셋 감지.
 */
export function validateProjectDefinition(
  definition: GameDefinition,
  words: Word[]
): ProjectValidationResult {
  const issues: ProjectIssue[] = [];

  const wordIds = new Set(words.map(w => w.id));
  const assetIds = new Set(Object.keys(definition.assets?.items ?? {}));

  // 모든 씬 ID를 수집 (navigate 액션 참조 검증용)
  const sceneIds = new Set<string>();
  for (const act of definition.acts) {
    for (const cas of act.cases) {
      for (const scene of cas.scenes) {
        sceneIds.add(scene.id);
      }
    }
  }

  for (const act of definition.acts) {
    for (const cas of act.cases) {
      const caseId = cas.id;

      // ── 씬 검증 ──────────────────────────────────────────────
      for (const scene of cas.scenes) {
        const sceneId = scene.id;

        // 배경 에셋 존재 확인
        if (scene.background && scene.background !== '' && !assetIds.has(scene.background)) {
          issues.push({
            severity: 'warning',
            kind: 'missing_asset',
            message: `씬 "${scene.name?.ko || sceneId}"의 배경 에셋("${scene.background}")이 에셋 목록에 없습니다.`,
            target: { type: 'scene', caseId, sceneId },
          });
        }

        // 레이어 이미지 에셋 존재 확인
        for (const layer of scene.layers) {
          if (layer.image && layer.image !== '' && !assetIds.has(layer.image)) {
            issues.push({
              severity: 'warning',
              kind: 'missing_asset',
              message: `씬 "${scene.name?.ko || sceneId}"의 레이어 이미지("${layer.image}")가 에셋 목록에 없습니다.`,
              target: { type: 'scene', caseId, sceneId },
            });
          }
        }

        // ── 핫스팟 검증 ─────────────────────────────────────────
        for (const hotspot of scene.hotspots) {
          const hotspotId = hotspot.id;
          const action = hotspot.action;

          // navigate 대상 씬 존재 확인
          if (action.type === 'navigate' && !sceneIds.has(action.targetSceneId)) {
            issues.push({
              severity: 'error',
              kind: 'broken_scene_ref',
              message: `핫스팟의 이동 대상 씬("${action.targetSceneId}")이 존재하지 않습니다.`,
              target: { type: 'hotspot', caseId, sceneId, hotspotId },
            });
          }

          // word_reveal 대상 단어 존재 확인
          if (action.type === 'word_reveal') {
            for (const wid of action.wordIds) {
              if (!wordIds.has(wid)) {
                issues.push({
                  severity: 'error',
                  kind: 'broken_word_ref',
                  message: `핫스팟의 단어 공개 대상("${wid}")이 단어 목록에 없습니다.`,
                  target: { type: 'hotspot', caseId, sceneId, hotspotId },
                });
              }
            }
          }

          // examine 수집 단어 존재 확인
          if (action.type === 'examine') {
            for (const cw of action.collectibleWords ?? []) {
              if (!wordIds.has(cw.wordId)) {
                issues.push({
                  severity: 'error',
                  kind: 'broken_word_ref',
                  message: `핫스팟의 수집 단어("${cw.wordId}")가 단어 목록에 없습니다.`,
                  target: { type: 'hotspot', caseId, sceneId, hotspotId },
                });
              }
            }
          }
        }
      }

      // ── 메인 퍼즐 검증 ───────────────────────────────────────
      const mainPuzzle = cas.puzzles.main;
      const answers = mainPuzzle.answers ?? {};
      const segments = mainPuzzle.template?.segments ?? [];

      // 슬롯이 있는데 정답이 없는 경우
      const hasSlots = segments.some(s => s.type === 'slot');
      if (hasSlots && Object.keys(answers).length === 0) {
        issues.push({
          severity: 'warning',
          kind: 'empty_puzzle_answers',
          message: `사건 "${cas.title?.ko || caseId}"의 메인 퍼즐에 정답이 설정되지 않았습니다.`,
          target: { type: 'puzzle', caseId },
        });
      }

      // 정답 단어 ID 존재 확인
      for (const [slotId, answer] of Object.entries(answers)) {
        if (answer.correctWordId && !wordIds.has(answer.correctWordId)) {
          issues.push({
            severity: 'error',
            kind: 'broken_word_ref',
            message: `메인 퍼즐 슬롯("${slotId}")의 정답 단어("${answer.correctWordId}")가 단어 목록에 없습니다.`,
            target: { type: 'puzzle', caseId },
          });
        }
      }
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
    isValid: errorCount === 0,
  };
}
