import type { BackgroundGenerateRequest, BackgroundGenerateResult, GameContextForPrompt, HotspotPromptInfo } from '../types.js';
import { getProvider } from '../providers/factory.js';
import { buildBackgroundPrompt, buildRichBackgroundPrompt } from '../prompts/background-prompts.js';
import type { HotspotArea } from '@gi-engine/core';
import { detectHotspotsFromImage, type DetectedHotspot, type HotspotDetectionInput } from './hotspot-detector.js';

export interface BackgroundWithDetectionOptions {
  sceneDescription: string;
  style?: 'realistic' | 'painterly' | 'pixel-art' | 'noir';
  aspectRatio?: '16:9' | '4:3' | '1:1';
  gameContext?: GameContextForPrompt;
  hotspots: HotspotPromptInfo[];
  sceneWidth: number;
  sceneHeight: number;
  onProgress?: (step: string) => void;
}

export interface BackgroundWithDetectionResult {
  asset: BackgroundGenerateResult['asset'];
  updatedHotspots: Array<{
    hotspotId: string;
    area: HotspotArea;
  }>;
  detectionResults: DetectedHotspot[];
  promptUsed: string;
}

/**
 * Generate a background image using Imagen 3.
 * Returns an AssetDefinition with inline base64 data.
 *
 * When `gameContext` is provided in the request, uses the rich structured prompt
 * that incorporates game story, case narrative, hotspot details, and clue information
 * for significantly higher quality results.
 */
export async function generateBackground(
  request: BackgroundGenerateRequest,
): Promise<BackgroundGenerateResult> {
  const { sceneDescription, style = 'painterly', aspectRatio = '16:9', gameContext, includeCharacter } = request;

  const prompt = gameContext
    ? buildRichBackgroundPrompt(sceneDescription, gameContext, style, includeCharacter)
    : buildBackgroundPrompt({ sceneDescription, style });

  const base64Data = await getProvider().generateImage(prompt, aspectRatio);

  const assetId = `asset_ai_bg_${Date.now()}`;

  return {
    asset: {
      id: assetId,
      type: 'image',
      src: '',
      inline: base64Data,
      mimeType: 'image/png',
      alt: { ko: sceneDescription, en: sceneDescription },
    },
    promptUsed: prompt,
  };
}

export async function generateBackgroundWithDetection(
  options: BackgroundWithDetectionOptions,
): Promise<BackgroundWithDetectionResult> {
  const {
    sceneDescription,
    style = 'painterly',
    aspectRatio = '16:9',
    gameContext,
    hotspots,
    sceneWidth,
    sceneHeight,
    onProgress,
  } = options;

  onProgress?.('이미지 생성 중...');

  const bgResult = await generateBackground({
    sceneDescription,
    style,
    aspectRatio,
    gameContext,
  });

  onProgress?.('핫스팟 위치 감지 중...');

  const detectionInputs: HotspotDetectionInput[] = hotspots.map(h => ({
    hotspotId: h.id,
    label: h.label,
    actionType: h.actionType,
    contentHint: h.contentHint,
  }));

  const imageBase64 = bgResult.asset.inline ?? '';
  const detectedHotspots = await detectHotspotsFromImage({
    imageBase64,
    hotspots: detectionInputs,
    sceneWidth,
    sceneHeight,
  });

  const updatedHotspots = detectedHotspots.map(d => ({
    hotspotId: d.hotspotId,
    area: d.area,
  }));

  return {
    asset: bgResult.asset,
    updatedHotspots,
    detectionResults: detectedHotspots,
    promptUsed: bgResult.promptUsed,
  };
}
