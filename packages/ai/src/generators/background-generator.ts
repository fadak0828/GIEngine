import type { BackgroundGenerateRequest, BackgroundGenerateResult } from '../types.js';
import { geminiClient } from '../client.js';
import { buildBackgroundPrompt, buildRichBackgroundPrompt } from '../prompts/background-prompts.js';

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

  const base64Data = await geminiClient.generateImage(prompt, aspectRatio);

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
