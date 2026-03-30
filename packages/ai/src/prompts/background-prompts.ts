import type { BackgroundStyle } from '../types.js';
import type { Hotspot, Locale } from '@gi-engine/core';

const STYLE_DESCRIPTORS: Record<BackgroundStyle, string> = {
  realistic:
    'photorealistic, detailed, high resolution, cinematic lighting',
  painterly:
    'digital painting, painterly style, expressive brushwork, vibrant colors',
  'pixel-art':
    'pixel art style, 16-bit era, retro game aesthetic, crisp pixels',
  noir:
    'noir style, black and white, dramatic shadows, high contrast, moody atmosphere',
};

export interface BackgroundPromptOptions {
  sceneDescription: string;
  style?: BackgroundStyle;
}

/**
 * Build an Imagen 3 prompt for a game background image.
 */
export function buildBackgroundPrompt(options: BackgroundPromptOptions): string {
  const { sceneDescription, style = 'painterly' } = options;
  const styleDesc = STYLE_DESCRIPTORS[style];
  return (
    `A game background scene: ${sceneDescription}. ` +
    `Style: ${styleDesc}. ` +
    `Wide angle, no characters, no text, suitable as a point-and-click adventure game background.`
  );
}

// ── Contextual background prompt (Feature 4) ─────────────────────

export interface HotspotContext {
  label: string;
  positionZone: string;  // e.g. "left-top", "center-middle"
  relativeSize: 'small' | 'medium' | 'large';
  description: string;
}

export interface ContextualBackgroundPromptOptions {
  sceneDescription: string;
  scene: { dimensions: { width: number; height: number } };
  hotspots: Hotspot[];
  locale: Locale;
  style?: BackgroundStyle;
}

/**
 * Compute normalized bounding box and spatial context for each hotspot.
 */
export function computeHotspotContexts(
  scene: { dimensions: { width: number; height: number } },
  hotspots: Hotspot[],
  locale: Locale,
): HotspotContext[] {
  const { width: sceneW, height: sceneH } = scene.dimensions;

  return hotspots.map(hotspot => {
    // Normalize area to bounding box
    let bx: number, by: number, bw: number, bh: number;
    const area = hotspot.area;
    if (area.type === 'rect') {
      bx = area.x;
      by = area.y;
      bw = area.width;
      bh = area.height;
    } else if (area.type === 'circle') {
      bx = area.cx - area.radius;
      by = area.cy - area.radius;
      bw = area.radius * 2;
      bh = area.radius * 2;
    } else {
      // polygon
      const xs = area.points.map(p => p[0]);
      const ys = area.points.map(p => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      bx = minX;
      by = minY;
      bw = maxX - minX;
      bh = maxY - minY;
    }

    // Compute center of bounding box
    const cx = bx + bw / 2;
    const cy = by + bh / 2;

    // Map to 3x3 grid zone
    const col = cx / sceneW < 1 / 3 ? 'left' : cx / sceneW < 2 / 3 ? 'center' : 'right';
    const row = cy / sceneH < 1 / 3 ? 'top' : cy / sceneH < 2 / 3 ? 'middle' : 'bottom';
    const positionZone = `${col}-${row}`;

    // Relative size based on width ratio
    const widthRatio = bw / sceneW;
    const relativeSize: 'small' | 'medium' | 'large' =
      widthRatio < 0.10 ? 'small' : widthRatio < 0.30 ? 'medium' : 'large';

    // Label: ariaLabel > action.title > hotspot.id
    let label = hotspot.ariaLabel[locale] || hotspot.ariaLabel.ko || hotspot.ariaLabel.en || '';
    if (!label) {
      const action = hotspot.action;
      if ('title' in action && action.title) {
        label = action.title[locale] || action.title.ko || action.title.en || '';
      }
    }
    if (!label) {
      label = hotspot.id;
    }

    return {
      label,
      positionZone,
      relativeSize,
      description: `${label} (${relativeSize}, ${positionZone})`,
    };
  });
}

/**
 * Build a contextual background prompt that incorporates hotspot spatial layout.
 * Falls back to buildBackgroundPrompt when there are no hotspots.
 */
export function buildContextualBackgroundPrompt(options: ContextualBackgroundPromptOptions): string {
  const { sceneDescription, scene, hotspots, locale, style = 'painterly' } = options;

  if (hotspots.length === 0) {
    return buildBackgroundPrompt({ sceneDescription, style });
  }

  const styleDesc = STYLE_DESCRIPTORS[style];
  const contexts = computeHotspotContexts(scene, hotspots, locale);

  const spatialLines = contexts.map(ctx =>
    `  - ${ctx.label}: positioned at ${ctx.positionZone}, ${ctx.relativeSize} area`
  ).join('\n');

  return (
    `A game background scene: ${sceneDescription}. ` +
    `The scene contains the following interactive areas that should be visually represented:\n` +
    `${spatialLines}\n` +
    `Style: ${styleDesc}. ` +
    `Wide angle, no characters, no text, suitable as a point-and-click adventure game background. ` +
    `The interactive elements should be naturally integrated into the environment.`
  );
}
