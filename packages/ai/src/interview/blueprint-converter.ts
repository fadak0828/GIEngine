/**
 * blueprint-converter.ts
 * Phase 6: CaseBlueprint -> 게임 데이터 변환기
 *
 * - case-generator.ts 기반 변환에 진행률 보고 추가
 * - 씬 크기 기반 핫스팟 위치 자동 계산
 * - 선택적 배경 이미지 생성 (Phase 3 AI 에셋 생성 활용)
 */

import type { Case, Scene, Word, AssetDefinition, AssetRef, Locale } from '@gi-engine/core';
import type { CaseBlueprint } from './types.js';
import { generateCaseFromBlueprint } from '../generators/case-generator.js';
import { generateBackground } from '../generators/background-generator.js';

// ─── 진행률 콜백 ──────────────────────────────────────────────────────────────

export interface ConversionProgress {
  step: string;
  percent: number;
}

export type OnProgress = (progress: ConversionProgress) => void;

// ─── 옵션 / 결과 타입 ────────────────────────────────────────────────────────

export interface ConvertBlueprintOptions {
  /** 변환에 사용할 로케일 (기본: 'ko') */
  locale?: Locale;
  /** 씬 배경 이미지를 AI로 생성할지 여부 (기본: false) */
  generateBackgrounds?: boolean;
  /** 진행률 콜백 */
  onProgress?: OnProgress;
}

export interface ConvertBlueprintResult {
  case: Case;
  words: Word[];
  /** generateBackgrounds=true 일 때 생성된 AssetDefinition 목록 */
  generatedAssets: AssetDefinition[];
}

// ─── 핫스팟 위치 자동 계산 ───────────────────────────────────────────────────

/**
 * N개 핫스팟을 씬 치수에 맞게 격자 분배하여 위치 반환.
 * 최대 4열, 상단 여백 고려.
 */
function calcHotspotPositions(
  count: number,
  sceneWidth: number,
  sceneHeight: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  if (count === 0) return [];

  const cols = Math.min(count, 4);
  const rows = Math.ceil(count / cols);
  const padX = 80;
  const padY = 100;
  const zoneW = (sceneWidth - padX * 2) / cols;
  const zoneH = (sceneHeight - padY * 2) / rows;
  const hotspotW = Math.max(120, Math.floor(zoneW * 0.55));
  const hotspotH = Math.max(80, Math.floor(zoneH * 0.55));

  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = Math.floor(padX + col * zoneW + (zoneW - hotspotW) / 2);
    const y = Math.floor(padY + row * zoneH + (zoneH - hotspotH) / 2);
    return { x, y, width: hotspotW, height: hotspotH };
  });
}

/** 씬의 각 핫스팟에 자동 계산된 위치를 적용한다. */
function applyPositionsToScene(scene: Scene): Scene {
  const positions = calcHotspotPositions(
    scene.hotspots.length,
    scene.dimensions.width,
    scene.dimensions.height,
  );

  return {
    ...scene,
    hotspots: scene.hotspots.map((hotspot, i) => ({
      ...hotspot,
      area: {
        type: 'rect' as const,
        x: positions[i]?.x ?? 0,
        y: positions[i]?.y ?? 0,
        width: positions[i]?.width ?? 120,
        height: positions[i]?.height ?? 80,
      },
    })),
  };
}

// ─── 메인 변환 함수 ───────────────────────────────────────────────────────────

/**
 * CaseBlueprint를 실제 게임 데이터(Case + Word[])로 변환합니다.
 *
 * @param blueprint - AI 인터뷰에서 생성된 CaseBlueprint
 * @param options   - 변환 옵션 (로케일, 배경 생성, 진행률 콜백)
 * @returns Case, Word[], generatedAssets
 */
export async function convertBlueprintToGameData(
  blueprint: CaseBlueprint,
  options: ConvertBlueprintOptions = {},
): Promise<ConvertBlueprintResult> {
  const { locale = 'ko', generateBackgrounds = false, onProgress } = options;
  const generatedAssets: AssetDefinition[] = [];

  // Step 1: 기본 Case/Word 변환 (case-generator 위임)
  onProgress?.({ step: '씬 및 단서어 변환 중...', percent: 15 });
  const { case: baseCase, words } = await generateCaseFromBlueprint(blueprint, locale);

  // Step 2: 핫스팟 위치 자동 계산
  onProgress?.({ step: '핫스팟 위치 계산 중...', percent: 40 });
  const positionedScenes: Scene[] = baseCase.scenes.map(applyPositionsToScene);
  let finalCase: Case = { ...baseCase, scenes: positionedScenes };

  // Step 3: 배경 이미지 생성 (옵션)
  if (generateBackgrounds && blueprint.scenes.length > 0) {
    const total = blueprint.scenes.length;
    for (let i = 0; i < total; i++) {
      const bScene = blueprint.scenes[i];
      const pct = 45 + Math.floor(((i + 1) / total) * 40);
      onProgress?.({ step: `씬 배경 생성 중 (${i + 1}/${total})...`, percent: pct });

      try {
        const bgResult = await generateBackground({
          sceneDescription: bScene.description,
          style: 'painterly',
          aspectRatio: '16:9',
        });

        generatedAssets.push(bgResult.asset);

        // 해당 인덱스 씬의 배경을 생성된 에셋 ID로 교체
        finalCase = {
          ...finalCase,
          scenes: finalCase.scenes.map((scene, idx) =>
            idx === i ? { ...scene, background: bgResult.asset.id as AssetRef } : scene,
          ),
        };
      } catch {
        // 개별 씬 배경 생성 실패는 무시하고 계속 진행
      }
    }
  }

  onProgress?.({ step: '변환 완료', percent: 90 });

  return { case: finalCase, words, generatedAssets };
}
