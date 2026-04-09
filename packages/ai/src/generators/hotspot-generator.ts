import type { AssetDefinition } from '@gi-engine/core';
import type { BackgroundStyle } from '../types.js';
import { getProvider } from '../providers/factory.js';

export interface HotspotImageGenerateRequest {
  /** Short description of the image content to generate */
  description: string;
  /** Visual style for the generated image */
  style?: BackgroundStyle;
  /** Aspect ratio override (default: 4:3, suitable for close-up examine images) */
  aspectRatio?: '4:3' | '1:1' | '16:9';
}

export interface HotspotImageGenerateResult {
  asset: AssetDefinition;
  promptUsed: string;
}

const STYLE_DESCRIPTORS: Record<string, string> = {
  realistic: 'photorealistic, detailed, high resolution, close-up macro shot',
  painterly: 'digital painting, painterly style, expressive brushwork, vibrant colors, close-up',
  'pixel-art': 'pixel art style, 16-bit era, retro game aesthetic, crisp pixels',
  noir: 'noir style, black and white, dramatic shadows, high contrast, moody atmosphere, close-up',
};

/**
 * Build a prompt for generating a hotspot (examine_image) image.
 */
function buildHotspotImagePrompt(
  description: string,
  style: BackgroundStyle = 'painterly',
  aspectRatio: '4:3' | '1:1' | '16:9' = '4:3',
): string {
  const styleDesc = STYLE_DESCRIPTORS[style] ?? STYLE_DESCRIPTORS['painterly'];
  const aspectDesc = {
    '4:3': 'standard close-up composition, centered subject',
    '1:1': 'square composition, centered subject',
    '16:9': 'widescreen composition, landscape close-up',
  }[aspectRatio];

  return (
    `A detailed close-up image for a mystery/deduction game hotspot: ${description}. ` +
    `Style: ${styleDesc}. ` +
    `Composition: ${aspectDesc}. ` +
    `No text, no labels, no UI elements, no characters, suitable as a point-and-click adventure game examine image.`
  );
}

/**
 * Generate an image for a hotspot (examine_image type) using Imagen 3.
 *
 * @param request - Generation parameters including description, style, and aspect ratio
 * @returns An AssetDefinition with inline base64 image data and the prompt used
 */
export async function generateHotspotImage(
  request: HotspotImageGenerateRequest,
): Promise<HotspotImageGenerateResult> {
  const { description, style = 'painterly', aspectRatio = '4:3' } = request;

  const prompt = buildHotspotImagePrompt(description, style, aspectRatio);
  const base64Data = await getProvider().generateImage(prompt, aspectRatio);

  const assetId = `asset_ai_hotspot_${Date.now()}`;

  return {
    asset: {
      id: assetId,
      type: 'image',
      src: '',
      inline: base64Data,
      mimeType: 'image/png',
      alt: { ko: description, en: description },
    },
    promptUsed: prompt,
  };
}
