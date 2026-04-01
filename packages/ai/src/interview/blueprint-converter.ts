/**
 * blueprint-converter.ts
 * Phase 6 + Phase 2 Quality: CaseBlueprint -> 게임 데이터 변환기
 *
 * - case-generator.ts 기반 변환에 진행률 보고 추가
 * - 씬 크기 기반 핫스팟 위치 자동 계산 (그리드 → 의미적 위치)
 * - 선택적 배경 이미지 생성 (게임 컨텍스트 주입, 리트라이/폴백)
 */

import type { Case, Scene, Word, AssetDefinition, AssetRef, Locale } from '@gi-engine/core';
import type { CaseBlueprint } from './types.js';
import type { GameContextForPrompt, HotspotPromptInfo } from '../types.js';
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

// ─── 핫스팟 위치 의미적 계산 (Phase 2 품질 개선) ────────────────────────────

/**
 * 핫스팟의 액션 타입에 따라 씬 내 의미적으로 적합한 위치를 계산합니다.
 *
 * - navigate  → 씬 가장자리 (출구/통로)
 * - examine_image → 화면 중앙 상단 (시각적 단서 초점)
 * - word_reveal   → 중간 영역 분산 (증거물)
 * - examine       → 일반 분산 (조사 가능 오브젝트)
 */
export function calcSmartHotspotPositions(
  hotspots: { action: { type: string } }[],
  sceneWidth: number,
  sceneHeight: number,
): Array<{ x: number; y: number; width: number; height: number }> {
  if (hotspots.length === 0) return [];

  type HotspotRect = { x: number; y: number; width: number; height: number };
  const result: (HotspotRect | null)[] = new Array(hotspots.length).fill(null);

  const indexed = hotspots.map((h, i) => ({ h, i }));
  const byType = (type: string) => indexed.filter(({ h }) => h.action.type === type);

  const navigates   = byType('navigate');
  const examImgs    = byType('examine_image');
  const wordReveals = byType('word_reveal');
  const examines    = indexed.filter(
    ({ h }) => !['navigate', 'examine_image', 'word_reveal'].includes(h.action.type),
  );

  // navigate → 씬 가장자리 5개 존 (좌, 우, 하단-중앙, 하단-좌, 하단-우)
  const navZones: HotspotRect[] = [
    { x: 20,                       y: Math.floor(sceneHeight / 2 - 100), width: 180, height: 200 },
    { x: sceneWidth - 200,         y: Math.floor(sceneHeight / 2 - 100), width: 180, height: 200 },
    { x: Math.floor(sceneWidth / 2 - 90), y: sceneHeight - 200,           width: 180, height: 180 },
    { x: 80,                       y: sceneHeight - 200,                  width: 160, height: 180 },
    { x: sceneWidth - 240,         y: sceneHeight - 200,                  width: 160, height: 180 },
  ];
  navigates.forEach(({ i }, idx) => {
    result[i] = navZones[idx % navZones.length];
  });

  // examine_image → 중앙 상단 시각적 초점 (최대 2개)
  const imgZones: HotspotRect[] = [
    { x: Math.floor(sceneWidth * 0.35), y: 140, width: Math.floor(sceneWidth * 0.30), height: 260 },
    { x: Math.floor(sceneWidth * 0.55), y: 170, width: Math.floor(sceneWidth * 0.20), height: 200 },
  ];
  examImgs.forEach(({ i }, idx) => {
    result[i] = imgZones[idx % imgZones.length];
  });

  // word_reveal → 중간 높이에 균등 분산
  const wrCount = wordReveals.length;
  wordReveals.forEach(({ i }, idx) => {
    const section = wrCount <= 1 ? 0.5 : idx / (wrCount - 1);
    const x = Math.floor(sceneWidth * 0.12 + sceneWidth * 0.76 * section);
    const y = Math.floor(sceneHeight * 0.38 + (idx % 2) * sceneHeight * 0.18);
    result[i] = { x, y, width: 160, height: 120 };
  });

  // examine → 나머지 공간에 격자 분산
  const exCount = examines.length;
  const cols = Math.min(Math.max(exCount, 1), 3);
  const rows = Math.ceil(exCount / cols);
  const padX = 200;
  const padY = 160;
  const zoneW = (sceneWidth - padX * 2) / cols;
  const zoneH = (sceneHeight - padY - 220) / Math.max(rows, 1);
  const hotspotW = Math.max(120, Math.floor(zoneW * 0.55));
  const hotspotH = Math.max(80, Math.floor(zoneH * 0.55));
  examines.forEach(({ i }, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = Math.floor(padX + col * zoneW + (zoneW - hotspotW) / 2);
    const y = Math.floor(padY + row * zoneH + (zoneH - hotspotH) / 2);
    result[i] = { x, y, width: hotspotW, height: hotspotH };
  });

  // 폴백
  return result.map(
    (r, i): HotspotRect =>
      r ?? { x: 60 + (i * 220) % (sceneWidth - 220), y: 400, width: 140, height: 100 },
  );
}

/** 씬의 각 핫스팟에 의미적으로 계산된 위치를 적용한다. */
function applySmartPositionsToScene(scene: Scene): Scene {
  const positions = calcSmartHotspotPositions(
    scene.hotspots,
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

// ─── 배경 생성용 GameContext 빌더 ────────────────────────���────────────────────

/**
 * 변환된 씬과 블루프린트 정보로 배경 이미지 생성용 GameContextForPrompt를 구성합니다.
 */
function buildGameContextForScene(
  scene: Scene,
  sceneIndex: number,
  blueprint: CaseBlueprint,
  locale: Locale,
): GameContextForPrompt {
  const siblingSceneNames = blueprint.scenes
    .filter((_, i) => i !== sceneIndex)
    .map(s => (locale === 'ko' ? s.name.ko : s.name.en) ?? s.name.ko ?? '');

  const bScene = blueprint.scenes[sceneIndex];
  const sceneWordTempIds = bScene
    ? bScene.hotspotHints
        .filter(h => h.actionType === 'word_reveal' && h.relatedWordId)
        .map(h => h.relatedWordId!)
    : [];

  const sceneWords = blueprint.words
    .filter(w => sceneWordTempIds.includes(w.tempId) || w.sourceSceneTempId === bScene?.tempId)
    .map(w => ({
      display: locale === 'ko' ? w.display.ko : w.display.en,
      category: w.category,
    }));

  // 핫스팟 → HotspotPromptInfo 변환
  const hotspots: HotspotPromptInfo[] = scene.hotspots.map(h => {
    const area = h.area;
    let bx = 0, by = 0, bw = 0, bh = 0;
    if (area.type === 'rect') {
      bx = area.x; by = area.y; bw = area.width; bh = area.height;
    } else if (area.type === 'circle') {
      bx = area.cx - area.radius; by = area.cy - area.radius;
      bw = area.radius * 2; bh = area.radius * 2;
    }
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const col = cx / scene.dimensions.width < 1/3 ? 'left' : cx / scene.dimensions.width < 2/3 ? 'center' : 'right';
    const row = cy / scene.dimensions.height < 1/3 ? 'top' : cy / scene.dimensions.height < 2/3 ? 'middle' : 'bottom';
    const wr = bw / scene.dimensions.width;
    const relativeSize: 'small' | 'medium' | 'large' = wr < 0.10 ? 'small' : wr < 0.30 ? 'medium' : 'large';
    const label = h.ariaLabel[locale] || h.ariaLabel.ko || '';
    return {
      id: h.id,
      label,
      positionZone: `${col}-${row}`,
      relativeSize,
      position: { x: Math.floor(cx), y: Math.floor(cy) },
      size: { width: bw, height: bh },
      actionType: h.action.type,
    };
  });

  return {
    caseTitle: (locale === 'ko' ? blueprint.title.ko : blueprint.title.en) ?? blueprint.title.ko ?? '',
    caseDescription: (locale === 'ko' ? blueprint.description.ko : blueprint.description.en) ?? blueprint.description.ko ?? '',
    sceneName: (locale === 'ko' ? scene.name.ko : scene.name.en) ?? scene.name.ko ?? '',
    siblingSceneNames,
    sceneWords,
    hotspots,
  };
}

/** 배경 이미지 생성 (최대 2회 재시도, 실패 시 silent skip) */
async function generateBackgroundWithRetry(
  request: Parameters<typeof generateBackground>[0],
  maxRetries = 2,
): Promise<Awaited<ReturnType<typeof generateBackground>> | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateBackground(request);
    } catch {
      if (attempt === maxRetries) return null;
    }
  }
  return null;
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

  // Step 2: 핫스팟 위치 의미적 계산 (Phase 2 품질 개선)
  onProgress?.({ step: '핫스팟 위치 계산 중...', percent: 40 });
  const positionedScenes: Scene[] = baseCase.scenes.map(applySmartPositionsToScene);
  let finalCase: Case = { ...baseCase, scenes: positionedScenes };

  // Step 3: 배경 이미지 생성 (옵션) — 게임 컨텍스트 주입 + 재시도
  if (generateBackgrounds && blueprint.scenes.length > 0) {
    const total = blueprint.scenes.length;
    for (let i = 0; i < total; i++) {
      const bScene = blueprint.scenes[i];
      const pct = 45 + Math.floor(((i + 1) / total) * 40);
      onProgress?.({ step: `씬 배경 생성 중 (${i + 1}/${total})...`, percent: pct });

      const gameContext = buildGameContextForScene(finalCase.scenes[i], i, blueprint, locale);

      const bgResult = await generateBackgroundWithRetry({
        sceneDescription: bScene.description,
        style: 'painterly',
        aspectRatio: '16:9',
        gameContext,
      });

      if (bgResult) {
        generatedAssets.push(bgResult.asset);
        finalCase = {
          ...finalCase,
          scenes: finalCase.scenes.map((scene, idx) =>
            idx === i ? { ...scene, background: bgResult.asset.id as AssetRef } : scene,
          ),
        };
      }
    }
  }

  onProgress?.({ step: '변환 완료', percent: 90 });

  return { case: finalCase, words, generatedAssets };
}
