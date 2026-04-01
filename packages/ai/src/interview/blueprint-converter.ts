/**
 * blueprint-converter.ts
 * Phase 6 + Phase 2 Quality: CaseBlueprint -> 게임 데이터 변환기
 *
 * - case-generator.ts 기반 변환에 진행률 보고 추가
 * - 씬 크기 기반 핫스팟 위치 자동 계산 (그리드 → 의미적 위치)
 * - AI positionHint 기반 위치 우선 + 안전 범위 클램핑
 * - 선택적 배경 이미지 생성 (게임 컨텍스트 주입, 리트라이/폴백)
 */

import type { Case, Scene, Word, AssetDefinition, AssetRef, Locale } from '@gi-engine/core';
import type { CaseBlueprint, BlueprintScene } from './types.js';
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
  /** examine_image 핫스팟에 대해 자동 조사 단어를 생성할지 여부 (기본: false) */
  autoGenerateImageWords?: boolean;
  /** 진행률 콜백 */
  onProgress?: OnProgress;
}

export interface ConvertBlueprintResult {
  case: Case;
  words: Word[];
  /** generateBackgrounds=true 일 때 생성된 AssetDefinition 목록 */
  generatedAssets: AssetDefinition[];
}

// ─── 핫스팟 위치 의미적 계산 (Phase 2 품질 개선 + positionHint 통합) ─────────

export interface BlueprintHotspotPositionHint {
  /** 정규화된 x (0=left, 1=right) */
  x: number;
  /** 정규화된 y (0=top, 1=bottom) */
  y: number;
  /** 위치 설명 (예: "왼쪽 상단 근처 오브젝트") */
  description?: string;
}

/**
 * 핫스팟의 액션 타입 + AI positionHint에 따라 씬 내 의미적으로 적합한 위치를 계산합니다.
 *
 * 우선순위:
 * 1. AI positionHint가 있으면 → 정규화된 좌표를 픽셀 좌표로 변환 + 안전 범위 클램핑
 * 2. 없으면 → 액션 타입별 사전 정의 존 활용
 *
 * - navigate  → 씬 가장자리 (출구/통로)
 * - examine_image → AI 위치 → 없으면 중앙 상단
 * - word_reveal   → AI 위치 → 없으면 중간 영역 분산
 * - examine       → AI 위치 → 없으면 격자 분산
 */
export function calcSmartHotspotPositions(
  hotspots: { action: { type: string } }[],
  sceneWidth: number,
  sceneHeight: number,
  /** AI가 제안한 정규화된 위치 힌트 (hotspots와 1:1 대응, 없으면 null) */
  positionHints?: (BlueprintHotspotPositionHint | null)[],
): Array<{ x: number; y: number; width: number; height: number }> {
  if (hotspots.length === 0) return [];

  type HotspotRect = { x: number; y: number; width: number; height: number };

  /** 안전 범위: 씬 테두리에서 최소 40px, 하단 네비게이션에서 220px 여유 */
  const MARGIN = 40;
  const NAV_SAFE_BOTTOM = 220;
  const minX = MARGIN;
  const minY = MARGIN;
  const maxX = sceneWidth - MARGIN;
  const maxY = sceneHeight - NAV_SAFE_BOTTOM;

  /** 정규화된 positionHint를 픽셀 좌표 + 안전 클램핑으로 변환 */
  const clampFromHint = (hint: BlueprintHotspotPositionHint, baseW: number, baseH: number): HotspotRect => {
    const rawX = Math.round(hint.x * sceneWidth - baseW / 2);
    const rawY = Math.round(hint.y * sceneHeight - baseH / 2);
    return {
      x: Math.max(minX, Math.min(rawX, maxX - baseW)),
      y: Math.max(minY, Math.min(rawY, maxY - baseH)),
      width: baseW,
      height: baseH,
    };
  };

  // 1단계: AI 힌트가 있는 핫스팟 먼저 배치
  const result: (HotspotRect | null)[] = hotspots.map((h, i) => {
    const hint = positionHints?.[i] ?? null;
    if (!hint) return null;

    const baseW = h.action.type === 'navigate' ? 160
                : h.action.type === 'examine_image' ? Math.max(200, Math.floor(sceneWidth * 0.22))
                : h.action.type === 'word_reveal' ? 160
                : 140;
    const baseH = h.action.type === 'navigate' ? 180
                : h.action.type === 'examine_image' ? Math.max(220, Math.floor(sceneHeight * 0.22))
                : h.action.type === 'word_reveal' ? 120
                : 100;
    return clampFromHint(hint, baseW, baseH);
  });

  // 2단계: AI 힌트 없는 핫스팟을 액션 타입별 폴백 존으로 채움
  const indexed = hotspots.map((h, i) => ({ h, i }));

  // navigate: 씬 가장자리 5개 존
  const navigates = indexed.filter(({ h }, i) => !result[i] && h.action.type === 'navigate');
  const navZones: HotspotRect[] = [
    { x: 20,                             y: Math.floor(sceneHeight / 2 - 100), width: 160, height: 200 },
    { x: sceneWidth - 180,                y: Math.floor(sceneHeight / 2 - 100), width: 160, height: 200 },
    { x: Math.floor(sceneWidth / 2 - 90), y: sceneHeight - NAV_SAFE_BOTTOM,      width: 180, height: 180 },
    { x: 80,                             y: sceneHeight - NAV_SAFE_BOTTOM,     width: 160, height: 180 },
    { x: sceneWidth - 240,                y: sceneHeight - NAV_SAFE_BOTTOM,    width: 160, height: 180 },
  ];
  navigates.forEach(({ i }, idx) => {
    result[i] = navZones[idx % navZones.length];
  });

  // examine_image: 중앙 상단 시각적 초점
  const examImgs = indexed.filter(({ h }, i) => !result[i] && h.action.type === 'examine_image');
  const imgZones: HotspotRect[] = [
    { x: Math.floor(sceneWidth * 0.35), y: 140, width: Math.floor(sceneWidth * 0.30), height: 260 },
    { x: Math.floor(sceneWidth * 0.55), y: 170, width: Math.floor(sceneWidth * 0.20), height: 200 },
  ];
  examImgs.forEach(({ i }, idx) => {
    result[i] = imgZones[idx % imgZones.length];
  });

  // word_reveal: 중간 높이에 균등 분산
  const wordReveals = indexed.filter(({ h }, i) => !result[i] && h.action.type === 'word_reveal');
  const wrCount = wordReveals.length;
  wordReveals.forEach(({ i }, idx) => {
    const section = wrCount <= 1 ? 0.5 : idx / (wrCount - 1);
    const x = Math.floor(sceneWidth * 0.12 + sceneWidth * 0.76 * section);
    const y = Math.floor(sceneHeight * 0.38 + (idx % 2) * sceneHeight * 0.18);
    result[i] = { x, y, width: 160, height: 120 };
  });

  // examine: 나머지 공간에 격자 분산
  const examines = indexed.filter(
    ({ h }, i) => !result[i] && !['navigate', 'examine_image', 'word_reveal'].includes(h.action.type),
  );
  const exCount = examines.length;
  const cols = Math.min(Math.max(exCount, 1), 3);
  const rows = Math.ceil(exCount / cols);
  const padX = 200;
  const padY = 160;
  const zoneW = (sceneWidth - padX * 2) / cols;
  const zoneH = (sceneHeight - padY - NAV_SAFE_BOTTOM) / Math.max(rows, 1);
  const hotspotW = Math.max(120, Math.floor(zoneW * 0.55));
  const hotspotH = Math.max(80, Math.floor(zoneH * 0.55));
  examines.forEach(({ i }, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = Math.floor(padX + col * zoneW + (zoneW - hotspotW) / 2);
    const y = Math.floor(padY + row * zoneH + (zoneH - hotspotH) / 2);
    result[i] = { x, y, width: hotspotW, height: hotspotH };
  });

  // 최종 폴백
  return result.map(
    (r, i): HotspotRect =>
      r ?? {
        x: minX + (i * 220) % Math.max(1, maxX - minX - 140),
        y: Math.floor(sceneHeight * 0.38),
        width: 140,
        height: 100,
      },
  );
}

/**
 * 씬의 각 핫스팟에 의미적으로 계산된 위치를 적용합니다.
 * blueprintScene의 positionHint를 활용하여 AI가 제안한 위치를 우선 적용합니다.
 */
function applySmartPositionsToScene(scene: Scene, blueprintScene: BlueprintScene): Scene {
  // BlueprintHotspotHint.positionHint → BlueprintHotspotPositionHint[]
  const positionHints = blueprintScene.hotspotHints.map(h => h.positionHint ?? null);

  const positions = calcSmartHotspotPositions(
    scene.hotspots,
    scene.dimensions.width,
    scene.dimensions.height,
    positionHints,
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

// ─── 배경 생성용 GameContext 빌더 ─────────────────────────────────────────────

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

// ─── 단어 수집 가능성 검증 ───────────────────────────────────────────────────

/**
 * CaseBlueprint의 모든 단어가 수집 가능하도록 보장합니다.
 *
 * 검증 규칙:
 * 1. 모든 단어는 반드시 1개 이상의 핫스팟과 연결되어야 함
 * 2. word_reveal 핫스팟의 relatedWordId로 연결된 단어가 없는 경우 → 자동 word_reveal 핫스팟 생성
 * 3. sourceSceneTempId가 없는 단어 → 첫 번째 씬에 연결
 *
 * @returns 검증/수정된 CaseBlueprint (원본은 불변)
 */
function ensureAllWordsCollectible(blueprint: CaseBlueprint): CaseBlueprint {
  // 1단계: word_reveal 핫스팟의 relatedWordId로 연결된 단어 수집
  const connectedWordIds = new Set<string>();
  for (const scene of blueprint.scenes) {
    for (const hint of scene.hotspotHints) {
      if (hint.actionType === 'word_reveal' && hint.relatedWordId) {
        connectedWordIds.add(hint.relatedWordId);
      }
    }
  }

  // 2단계: 연결되지 않은 단어 식별
  const orphanedWords = blueprint.words.filter(w => !connectedWordIds.has(w.tempId));

  if (orphanedWords.length === 0) {
    return blueprint; // 모든 단어가 연결됨 — 변경 없음
  }

  // 3단계: 고립된 단어마다 자동 word_reveal 핫스팟 생성
  const modifiedScenes = blueprint.scenes.map(scene => {
    // 해당 씬의 단서: scene.tempId와 연결된 단어
    const sceneWords = orphanedWords.filter(w => {
      // sourceSceneTempId가 있으면 그것 기준, 없으면 이 씬이 첫 번째 씬이면 사용
      if (w.sourceSceneTempId === scene.tempId) return true;
      // sourceSceneTempId가 없는 경우: 첫 번째 씬에 연결
      if (!w.sourceSceneTempId) {
        const firstScene = blueprint.scenes[0];
        return scene.tempId === firstScene?.tempId;
      }
      return false;
    });

    if (sceneWords.length === 0) return scene;

    const newHints: typeof scene.hotspotHints = [...scene.hotspotHints];

    for (const word of sceneWords) {
      // 이미 scene의 hotspotHints에 이 단어가 연결되어 있는지 재확인
      const alreadyConnected = newHints.some(
        h => h.actionType === 'word_reveal' && h.relatedWordId === word.tempId,
      );
      if (alreadyConnected) continue;

      // 자동 생성 word_reveal 핫스팟
      const displayText = word.display?.ko ?? word.display?.en ?? word.tempId;
      newHints.push({
        label: `단서: ${displayText}`,
        actionType: 'word_reveal',
        contentHint: word.hint?.ko ?? word.hint?.en ?? `${displayText}에 대한 단서를 발견했다`,
        // positionHint 없이 두면 calcSmartHotspotPositions가 자동으로 배치
        relatedWordId: word.tempId,
      });
    }

    return { ...scene, hotspotHints: newHints };
  });

  return { ...blueprint, scenes: modifiedScenes };
}

// ─── examine_image 핫스팟 자동 조사 단어 생성 ────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * examine_image 핫스팟에 대해 자동 조사 단어를 생성합니다.
 *
 * 각 examine_image 핫스팟을:
 * 1. 해당 이미지의 내용을 설명하는 새 단어(word)로 변환
 * 2. 해당 단어를 word_reveal하는 새 핫스팟으로 대체
 *
 * 예: examine_image("피해자 사진") → 새 단어 "피해자 얼굴" + word_reveal("피해자 얼굴")
 */
function autoGenerateImageWords(blueprint: CaseBlueprint): CaseBlueprint {
  const newWords: import('./types.js').BlueprintWord[] = [];
  const modifiedScenes = blueprint.scenes.map(scene => {
    const newHints: typeof scene.hotspotHints = [];

    for (const hint of scene.hotspotHints) {
      newHints.push(hint);

      if (hint.actionType !== 'examine_image') continue;

      // 이미지 조사 단어 생성
      const labelText = hint.label || '이미지 단서';
      const hintText = hint.contentHint || `${labelText}에서 발견한 단서`;

      const wordTempId = `img_word_${generateId().slice(0, 8)}`;
      const newWord: import('./types.js').BlueprintWord = {
        tempId: wordTempId,
        display: { ko: labelText, en: labelText },
        category: 'evidence',
        hint: { ko: hintText, en: hintText },
        sourceSceneTempId: scene.tempId,
      };
      newWords.push(newWord);

      // word_reveal 핫스팟 추가 (이미지 조사 후 획득)
      newHints.push({
        label: `[단서 획득] ${labelText}`,
        actionType: 'word_reveal',
        contentHint: hintText,
        relatedWordId: wordTempId,
      });
    }

    return { ...scene, hotspotHints: newHints };
  });

  if (newWords.length === 0) return blueprint;

  return {
    ...blueprint,
    scenes: modifiedScenes,
    words: [...blueprint.words, ...newWords],
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

  // Step 0: 모든 단어가 수집 가능하도록 검증/수정
  onProgress?.({ step: '단어 수집 가능성 검증 중...', percent: 5 });
  let processedBlueprint = ensureAllWordsCollectible(blueprint);

  // Step 0b: examine_image 핫스팟 자동 조사 단어 생성 (옵션)
  if (options.autoGenerateImageWords) {
    onProgress?.({ step: '이미지 조사 단어 생성 중...', percent: 8 });
    processedBlueprint = autoGenerateImageWords(processedBlueprint);
  }

  // Step 1: 기본 Case/Word 변환 (case-generator 위임)
  onProgress?.({ step: '씬 및 단서어 변환 중...', percent: 15 });
  const { case: baseCase, words } = await generateCaseFromBlueprint(processedBlueprint, locale);

  // Step 2: 핫스팟 위치 의미적 계산 (positionHint 우선 + 안전 클램핑)
  onProgress?.({ step: '핫스팟 위치 계산 중...', percent: 40 });
  const positionedScenes: Scene[] = baseCase.scenes.map((scene, i) => {
    const bScene = processedBlueprint.scenes[i];
    return bScene ? applySmartPositionsToScene(scene, bScene) : scene;
  });
  let finalCase: Case = { ...baseCase, scenes: positionedScenes };

  // Step 3: 배경 이미지 생성 (옵션) — 게임 컨텍스트 주입 + 재시도
  if (generateBackgrounds && processedBlueprint.scenes.length > 0) {
    const total = processedBlueprint.scenes.length;
    for (let i = 0; i < total; i++) {
      const bScene = processedBlueprint.scenes[i];
      const pct = 45 + Math.floor(((i + 1) / total) * 40);
      onProgress?.({ step: `씬 배경 생성 중 (${i + 1}/${total})...`, percent: pct });

      const gameContext = buildGameContextForScene(finalCase.scenes[i], i, processedBlueprint, locale);

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
