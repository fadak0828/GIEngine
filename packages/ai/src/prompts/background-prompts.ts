import type { BackgroundStyle, GameContextForPrompt, HotspotPromptInfo } from '../types.js';
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
 * Build a simple Imagen 3 prompt for a game background image.
 * Used as fallback when no game context is available.
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

// ── Contextual background prompt (legacy inline version) ────────

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

    const cx = bx + bw / 2;
    const cy = by + bh / 2;

    const col = cx / sceneW < 1 / 3 ? 'left' : cx / sceneW < 2 / 3 ? 'center' : 'right';
    const row = cy / sceneH < 1 / 3 ? 'top' : cy / sceneH < 2 / 3 ? 'middle' : 'bottom';
    const positionZone = `${col}-${row}`;

    const widthRatio = bw / sceneW;
    const relativeSize: 'small' | 'medium' | 'large' =
      widthRatio < 0.10 ? 'small' : widthRatio < 0.30 ? 'medium' : 'large';

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

// ── Rich contextual prompt (v2 — structured JSON) ──────────────

/**
 * Describe the visual role of a hotspot for the image model.
 */
function describeHotspotVisual(h: HotspotPromptInfo): string {
  switch (h.actionType) {
    case 'examine':
      return h.contentHint
        ? `Examinable object containing clues about: ${h.contentHint}`
        : 'Examinable object — should be visually distinct and inviting to inspect';
    case 'examine_image':
      return 'A visual clue the player can inspect closely — render with fine detail';
    case 'word_reveal':
      if (h.revealedWords && h.revealedWords.length > 0) {
        return `Contains hidden evidence (${h.revealedWords.join(', ')}) — depict an object that could plausibly conceal written information`;
      }
      return 'Contains hidden evidence — depict an object that could conceal information';
    case 'navigate':
      return 'A passage, door, or pathway leading to another area — should clearly read as a traversable exit';
    case 'toggle_layer':
      return 'An interactive element that changes the scene — render with a subtle visual affordance';
    case 'composite':
      if (h.revealedWords && h.revealedWords.length > 0) {
        return `Complex interactive object revealing evidence (${h.revealedWords.join(', ')}) — render prominently`;
      }
      return 'Complex interactive element with multiple effects — render as a notable focal point';
    default:
      return 'An interactive element — should be visually identifiable';
  }
}

interface StructuredPrompt {
  role: string;
  metadata: {
    game?: string;
    case_title: string;
    story: string;
    scene: string;
    scene_description: string;
    connected_locations?: string[];
  };
  art_direction: {
    style: string[];
    composition: string;
    environment: string;
    character?: {
      include: boolean;
      description: string;
      position_zone: string;
      size: 'small' | 'medium' | 'large';
      style_hint: string;
    };
  };
  constraints: {
    negative_prompt: string[];
    global_rule: string;
  };
  story_elements?: {
    key_evidence: Array<{ name: string; type: string; note: string }>;
  };
  interactive_objects?: Array<{
    id: string;
    label: string;
    properties: {
      position_zone: string;
      relative_size: string;
      pixel_center: { x: number; y: number };
      pixel_size: { width: number; height: number };
    };
    details: {
      action: string;
      visual_description: string;
    };
  }>;
}

/**
 * Build a rich, structured JSON prompt for Imagen that incorporates full game context:
 * game story, case narrative, scene role, hotspot details with pixel coordinates,
 * and discoverable clues.
 *
 * The structured format gives the image model a precise, unambiguous understanding
 * of what to render and where.
 *
 * @param sceneDescription  Description of the scene to render
 * @param gameContext        Full game/case/scene context for the prompt
 * @param style              Visual style override (default: painterly)
 * @param includeCharacter   Optional override:
 *                             - true  = include a character figure
 *                             - false = no characters (default, backwards-compatible)
 *                             - null/undefined = AI decides based on scene description
 */
export function buildRichBackgroundPrompt(
  sceneDescription: string,
  gameContext: GameContextForPrompt,
  style: BackgroundStyle = 'painterly',
  includeCharacter?: boolean,
): string {
  const styleTokens = STYLE_DESCRIPTORS[style].split(', ');

  // Determine character policy:
  // - explicit true  → include character (use characterHint or generic)
  // - explicit false → no characters
  // - undefined      → let AI decide naturally (don't hard-code into negative_prompt)
  const wantsCharacter = includeCharacter === true;
  const noCharacters   = includeCharacter === false;
  const characterHint   = gameContext.characterHint;

  const prompt: StructuredPrompt = {
    role: 'Generate a background image for a "Golden Idol"-style mystery/deduction game. The player explores scenes, examines objects, collects word-clues, and solves puzzles.',
    metadata: {
      case_title: gameContext.caseTitle,
      story: gameContext.caseDescription,
      scene: gameContext.sceneName,
      scene_description: sceneDescription,
    },
    art_direction: {
      style: styleTokens,
      composition: 'wide-angle establishing shot, point-and-click adventure background',
      environment: sceneDescription,
    },
    constraints: {
      negative_prompt: noCharacters
        ? [
            'text', 'letters', 'words', 'readable writing', 'UI elements',
            'human characters', 'human figures', 'people',
          ]
        : ['text', 'letters', 'words', 'readable writing', 'UI elements'],
      global_rule: 'All interactive objects must be visually distinct and naturally integrated into the scene environment.',
    },
  };

  // Optional game title
  if (gameContext.gameTitle) {
    prompt.metadata.game = gameContext.gameTitle;
  }

  // Connected locations (sibling scenes)
  if (gameContext.siblingSceneNames && gameContext.siblingSceneNames.length > 0) {
    prompt.metadata.connected_locations = gameContext.siblingSceneNames;
  }

  // Story elements — key evidence from word clues
  if (gameContext.sceneWords && gameContext.sceneWords.length > 0) {
    prompt.story_elements = {
      key_evidence: gameContext.sceneWords.map(w => ({
        name: w.display,
        type: w.category || 'clue',
        note: 'Do not render as text — represent indirectly through objects and atmosphere',
      })),
    };
  }

  // Interactive objects with pixel-precise coordinates
  if (gameContext.hotspots.length > 0) {
    prompt.interactive_objects = gameContext.hotspots.map(h => ({
      id: h.id,
      label: h.label,
      properties: {
        position_zone: h.positionZone,
        relative_size: h.relativeSize,
        pixel_center: h.position,
        pixel_size: h.size,
      },
      details: {
        action: h.actionType,
        visual_description: describeHotspotVisual(h),
      },
    }));
  }

  // Character element — only when explicitly requested
  if (wantsCharacter) {
    prompt.art_direction = {
      ...prompt.art_direction,
      character: {
        include: true,
        description: characterHint?.description ?? 'a mysterious figure, silhouette or shadow of a person, appropriate for a detective/mystery game',
        position_zone: characterHint?.positionZone ?? 'background, non-intrusive',
        size: characterHint?.size ?? 'medium',
        style_hint: 'subtle, atmospheric, non-distracting from interactive elements',
      },
    };
  }

  return JSON.stringify(prompt, null, 2);
}
