import React, { useState, useMemo, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Hotspot, Locale, Case, Scene, ExamineImageAction, HotspotArea } from '@gi-engine/core';

// Inline types to avoid compile-time dependency on @gi-engine/ai
type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';

interface HotspotPromptInfo {
  id: string;
  label: string;
  positionZone: string;
  relativeSize: 'small' | 'medium' | 'large';
  actionType: string;
  contentHint?: string;
  revealedWords?: string[];
}

interface GameContextForPrompt {
  gameTitle?: string;
  gameDescription?: string;
  caseTitle: string;
  caseDescription: string;
  sceneName: string;
  siblingSceneNames?: string[];
  hotspots: HotspotPromptInfo[];
  sceneWords?: Array<{ display: string; category?: string }>;
}

interface DetectedAreaPreview {
  hotspotId: string;
  label: string;
  detectedArea: HotspotArea;
  originalArea: HotspotArea;
}

interface AIBackgroundModalProps {
  open: boolean;
  onClose: () => void;
  sceneId: string;
  caseId: string;
  hotspots: Hotspot[];
  sceneDimensions: { width: number; height: number };
}

const STYLE_LABELS: Record<BackgroundStyle, string> = {
  realistic: '사실적',
  painterly: '회화적',
  'pixel-art': '픽셀 아트',
  noir: '누아르',
};

const STYLE_DESCRIPTORS: Record<BackgroundStyle, string> = {
  realistic: 'photorealistic, detailed, high resolution, cinematic lighting',
  painterly: 'digital painting, painterly style, expressive brushwork, vibrant colors',
  'pixel-art': 'pixel art style, 16-bit era, retro game aesthetic, crisp pixels',
  noir: 'noir style, black and white, dramatic shadows, high contrast, moody atmosphere',
};

// ── Hotspot context computation ─────────────────────────────────

interface HotspotContext {
  label: string;
  positionZone: string;
  relativeSize: 'small' | 'medium' | 'large';
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

function computeHotspotContextsInline(
  dimensions: { width: number; height: number },
  hotspots: Hotspot[],
  locale: Locale,
): HotspotContext[] {
  const { width: sceneW, height: sceneH } = dimensions;
  return hotspots.map(hotspot => {
    let bx: number, by: number, bw: number, bh: number;
    const area = hotspot.area;
    if (area.type === 'rect') {
      bx = area.x; by = area.y; bw = area.width; bh = area.height;
    } else if (area.type === 'circle') {
      bx = area.cx - area.radius; by = area.cy - area.radius;
      bw = area.radius * 2; bh = area.radius * 2;
    } else {
      const xs = area.points.map(p => p[0]);
      const ys = area.points.map(p => p[1]);
      bx = Math.min(...xs); by = Math.min(...ys);
      bw = Math.max(...xs) - bx; bh = Math.max(...ys) - by;
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
    if (!label) label = hotspot.id;
    return { label, positionZone, relativeSize, centerX: Math.round(cx), centerY: Math.round(cy), width: Math.round(bw), height: Math.round(bh) };
  });
}

// ── examine_image hotspots that need AI image generation ─────────

interface ExamineImageHotspotTarget {
  hotspot: Hotspot;
  /** Description to feed into the image generation prompt */
  imagePrompt: string;
}

/**
 * Return hotspots of type `examine_image` whose image is not yet set,
 * paired with a suitable generation prompt derived from the hotspot label/caption.
 */
function findExamineImageHotspotsNeedingImage(
  hotspots: Hotspot[],
  locale: Locale,
): ExamineImageHotspotTarget[] {
  return hotspots
    .filter((h): h is Hotspot & { action: ExamineImageAction } =>
      h.action.type === 'examine_image' && !h.action.image
    )
    .map(hotspot => {
      const action = hotspot.action as ExamineImageAction;
      // Prefer localized caption, fall back to hotspot label
      const caption =
        action.caption
          ? (action.caption[locale] || action.caption.ko || action.caption.en || '')
          : '';
      const ariaLabel =
        hotspot.ariaLabel[locale] || hotspot.ariaLabel.ko || hotspot.ariaLabel.en || hotspot.id;
      const imagePrompt = caption || ariaLabel;
      return { hotspot, imagePrompt };
    })
    .filter(t => t.imagePrompt.trim().length > 0);
}

function buildHotspotPromptInfos(
  dimensions: { width: number; height: number },
  hotspots: Hotspot[],
  locale: Locale,
  wordDisplayMap: Map<string, { display: string; category?: string }>,
): HotspotPromptInfo[] {
  const contexts = computeHotspotContextsInline(dimensions, hotspots, locale);
  return hotspots.map((hotspot, i) => {
    const ctx = contexts[i];
    const action = hotspot.action;
    let contentHint: string | undefined;
    let revealedWords: string[] | undefined;

    if (action.type === 'examine' && action.content) {
      const text = action.content[locale] || action.content.ko || action.content.en || '';
      if (text) contentHint = text.length > 80 ? text.slice(0, 80) + '…' : text;
    } else if (action.type === 'examine_image' && action.caption) {
      const cap = action.caption[locale] || action.caption.ko || action.caption.en || '';
      if (cap) contentHint = cap;
    } else if (action.type === 'word_reveal' && action.wordIds) {
      revealedWords = action.wordIds
        .map(id => wordDisplayMap.get(id)?.display || id)
        .filter(Boolean);
    } else if (action.type === 'composite' && 'actions' in action) {
      // Extract word reveals and examine content from composite actions
      const subActions = (action as { actions: Array<{ type: string; wordIds?: string[]; content?: Record<string, string> }> }).actions;
      const words: string[] = [];
      for (const sub of subActions) {
        if (sub.type === 'word_reveal' && sub.wordIds) {
          words.push(...sub.wordIds.map(id => wordDisplayMap.get(id)?.display || id));
        }
        if (sub.type === 'examine' && sub.content && !contentHint) {
          const text = sub.content[locale] || sub.content.ko || sub.content.en || '';
          if (text) contentHint = text.length > 80 ? text.slice(0, 80) + '…' : text;
        }
      }
      if (words.length > 0) revealedWords = words;
    }

    return {
      id: hotspot.id,
      label: ctx.label,
      positionZone: ctx.positionZone,
      relativeSize: ctx.relativeSize,
      actionType: action.type,
      contentHint,
      revealedWords,
    };
  });
}

// ── Rich prompt builder (inline preview version — structured JSON) ──

function describeHotspotVisualInline(h: HotspotPromptInfo): string {
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

// ── Spatial hint builder (inline version) ─────────────────────────

const ZONE_LABELS_INLINE: Record<string, string> = {
  'left-top':    'upper-left corner',
  'left-middle': 'left side, vertically centered',
  'left-bottom': 'lower-left corner',
  'center-top':  'upper-center',
  'center-middle': 'center of the scene',
  'center-bottom': 'lower-center',
  'right-top':   'upper-right corner',
  'right-middle':'right side, vertically centered',
  'right-bottom':'lower-right corner',
};

function buildSpatialHintsInline(hotspots: HotspotPromptInfo[]): Map<string, string> {
  const hints = new Map<string, string>();
  if (hotspots.length === 0) return hints;

  const byZone = new Map<string, HotspotPromptInfo[]>();
  for (const h of hotspots) {
    const list = byZone.get(h.positionZone) ?? [];
    list.push(h);
    byZone.set(h.positionZone, list);
  }

  for (const h of hotspots) {
    const parts: string[] = [];

    const zoneDesc = ZONE_LABELS_INLINE[h.positionZone];
    if (zoneDesc) parts.push(`Positioned in the ${zoneDesc} of the scene.`);

    const zoneMates = byZone.get(h.positionZone) ?? [];
    if (zoneMates.length > 1) {
      const sorted = [...zoneMates].sort((a, b) => {
        const sizeOrder: Record<string, number> = { small: 0, medium: 1, large: 2 };
        return sizeOrder[b.relativeSize] - sizeOrder[a.relativeSize];
      });
      const idx = sorted.findIndex(x => x.id === h.id);
      if (idx === 0) {
        parts.push('It is the largest/most prominent object in this area.');
      } else if (idx === sorted.length - 1) {
        parts.push('It is the smallest/least prominent object in this area.');
      } else {
        parts.push('It is intermediate in prominence within this area.');
      }
    }

    const otherZones = [...byZone.entries()].filter(([zone]) => zone !== h.positionZone);
    for (const [otherZone] of otherZones) {
      const [myCol] = h.positionZone.split('-');
      const [otherCol] = otherZone.split('-');
      const colOrder = ['left', 'center', 'right'];
      const myColIdx = colOrder.indexOf(myCol);
      const otherColIdx = colOrder.indexOf(otherCol);

      if (myColIdx < otherColIdx) {
        parts.push(`It should be to the LEFT of the ${ZONE_LABELS_INLINE[otherZone] ?? otherZone} area.`);
      } else if (myColIdx > otherColIdx) {
        parts.push(`It should be to the RIGHT of the ${ZONE_LABELS_INLINE[otherZone] ?? otherZone} area.`);
      }
    }

    if (parts.length > 0) {
      hints.set(h.id, parts.join(' '));
    }
  }

  return hints;
}

function buildRichPromptInline(
  description: string,
  gameContext: GameContextForPrompt,
  style: BackgroundStyle,
): string {
  const styleTokens = STYLE_DESCRIPTORS[style].split(', ');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompt: Record<string, any> = {
    role: 'Generate a background image for a "Golden Idol"-style mystery/deduction game. The player explores scenes, examines objects, collects word-clues, and solves puzzles.',
    metadata: {
      ...(gameContext.gameTitle ? { game: gameContext.gameTitle } : {}),
      case_title: gameContext.caseTitle,
      story: gameContext.caseDescription,
      scene: gameContext.sceneName,
      scene_description: description,
      ...(gameContext.siblingSceneNames && gameContext.siblingSceneNames.length > 0
        ? { connected_locations: gameContext.siblingSceneNames }
        : {}),
    },
    art_direction: {
      style: styleTokens,
      composition: 'wide-angle establishing shot, point-and-click adventure background',
      environment: description,
    },
    constraints: {
      negative_prompt: [
        'text', 'letters', 'words', 'readable writing', 'UI elements',
        'human characters', 'human figures', 'people',
        'labels', 'names', 'coordinates', 'position numbers',
      ],
      global_rule: 'All interactive objects must be visually distinct and naturally integrated into the scene environment. Do NOT render any text, coordinate numbers, or object names in the image. CRITICAL CONSTRAINTS: (1) Exactly match the specified number of interactive objects — do not omit or add any. (2) No overlapping between objects — each object must occupy a distinct, non-overlapping area. (3) Objects must be clearly visually distinguishable from each other through size, position, or visual treatment.',
    },
  };

  if (gameContext.sceneWords && gameContext.sceneWords.length > 0) {
    prompt.story_elements = {
      key_evidence: gameContext.sceneWords.map(w => ({
        name: w.display,
        type: w.category || 'clue',
        note: 'Do not render as text — represent indirectly through objects and atmosphere',
      })),
    };
  }

  if (gameContext.hotspots.length > 0) {
    const spatialHints = buildSpatialHintsInline(gameContext.hotspots);
    prompt.interactive_objects = gameContext.hotspots.map(h => ({
      id: h.id,
      properties: {
        position_zone: h.positionZone,
        relative_size: h.relativeSize,
      },
      details: {
        action: h.actionType,
        visual_description: describeHotspotVisualInline(h),
        spatial_hint: spatialHints.get(h.id),
      },
    }));
  }

  return JSON.stringify(prompt, null, 2);
}

// ── Simple prompt builder (fallback) ────────────────────────────

function buildSimplePromptInline(
  description: string,
  dimensions: { width: number; height: number },
  hotspots: Hotspot[],
  locale: Locale,
  style: BackgroundStyle,
): string {
  const styleDesc = STYLE_DESCRIPTORS[style];
  if (hotspots.length === 0) {
    return (
      `A game background scene: ${description}. ` +
      `Style: ${styleDesc}. ` +
      `Wide angle, no characters, no text, suitable as a point-and-click adventure game background.`
    );
  }
  const contexts = computeHotspotContextsInline(dimensions, hotspots, locale);
  const spatialLines = contexts.map(ctx =>
    `  - ${ctx.label}: positioned at ${ctx.positionZone}, ${ctx.relativeSize} area`
  ).join('\n');
  return (
    `A game background scene: ${description}. ` +
    `The scene contains the following interactive areas that should be visually represented:\n` +
    `${spatialLines}\n` +
    `Style: ${styleDesc}. ` +
    `Wide angle, no characters, no text, suitable as a point-and-click adventure game background. ` +
    `The interactive elements should be naturally integrated into the environment.`
  );
}

// ── Main component ──────────────────────────────────────────────

export function AIBackgroundModal({
  open,
  onClose,
  sceneId,
  caseId,
  hotspots,
  sceneDimensions,
}: AIBackgroundModalProps): React.ReactElement | null {
  const { addAsset, updateScene, updateHotspotArea } = useEditorStore();
  const project = useEditorStore(s => s.project);
  const words = useEditorStore(s => s.words);
  const ui = useEditorStore(s => s.ui);
  const locale = ui.editorLocale;

  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<BackgroundStyle>('painterly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [promptDraft, setPromptDraft] = useState('');
  const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [generateHotspotImages, setGenerateHotspotImages] = useState(false);
  const [hotspotGenProgress, setHotspotGenProgress] = useState<{ current: number; total: number } | null>(null);

  const [detectionProgress, setDetectionProgress] = useState<string | null>(null);
  const [detectionPreview, setDetectionPreview] = useState<DetectedAreaPreview[] | null>(null);
  const [detectionImage, setDetectionImage] = useState<string | null>(null);
  const [showDetectionConfirm, setShowDetectionConfirm] = useState(false);

  // Build game context from editor state
  const gameContext = useMemo((): GameContextForPrompt | null => {
    if (!project) return null;
    let theCase: Case | null = null;
    for (const act of project.acts) {
      const found = act.cases.find(c => c.id === caseId);
      if (found) { theCase = found; break; }
    }
    if (!theCase) return null;

    const scene: Scene | undefined = theCase.scenes.find(s => s.id === sceneId);
    if (!scene) return null;

    const caseTitle = theCase.title[locale as keyof typeof theCase.title] || theCase.title.ko || theCase.title.en || '';
    const caseDesc = theCase.description[locale as keyof typeof theCase.description] || theCase.description.ko || theCase.description.en || '';
    const sceneName = scene.name[locale as keyof typeof scene.name] || scene.name.ko || scene.name.en || '';

    // Sibling scene names (other scenes in the same case)
    const siblingSceneNames = theCase.scenes
      .filter(s => s.id !== sceneId)
      .map(s => s.name[locale as keyof typeof s.name] || s.name.ko || s.name.en || '')
      .filter(Boolean);

    // Words that can be found in this scene (via word_reveal hotspots)
    const revealedWordIds = new Set<string>();
    for (const h of hotspots) {
      if (h.action.type === 'word_reveal' && h.action.wordIds) {
        h.action.wordIds.forEach(id => revealedWordIds.add(id));
      }
      if (h.action.type === 'composite' && 'actions' in h.action) {
        const subs = (h.action as { actions: Array<{ type: string; wordIds?: string[] }> }).actions;
        for (const sub of subs) {
          if (sub.type === 'word_reveal' && sub.wordIds) {
            sub.wordIds.forEach(id => revealedWordIds.add(id));
          }
        }
      }
    }

    const wordDisplayMap = new Map<string, { display: string; category?: string }>();
    const caseWords = words.filter(w => w.caseId === caseId);
    for (const w of caseWords) {
      wordDisplayMap.set(w.id, {
        display: w.display[locale] || w.display.ko || w.id,
        category: w.category,
      });
    }

    const sceneWords = Array.from(revealedWordIds)
      .map(id => wordDisplayMap.get(id))
      .filter((w): w is { display: string; category?: string } => w !== undefined);

    const hotspotInfos = buildHotspotPromptInfos(sceneDimensions, hotspots, locale, wordDisplayMap);

    return {
      gameTitle: project.title[locale as keyof typeof project.title] || project.title.ko || project.title.en || undefined,
      gameDescription: project.description[locale as keyof typeof project.description] || project.description.ko || project.description.en || undefined,
      caseTitle,
      caseDescription: caseDesc,
      sceneName,
      siblingSceneNames: siblingSceneNames.length > 0 ? siblingSceneNames : undefined,
      hotspots: hotspotInfos,
      sceneWords: sceneWords.length > 0 ? sceneWords : undefined,
    };
  }, [project, caseId, sceneId, hotspots, words, locale, sceneDimensions]);

  // Auto-compute prompt from description + game context + style
  const autoPrompt = useMemo(() => {
    if (!description.trim()) return '';
    if (gameContext) {
      return buildRichPromptInline(description.trim(), gameContext, style);
    }
    return buildSimplePromptInline(description.trim(), sceneDimensions, hotspots, locale, style);
  }, [description, gameContext, sceneDimensions, hotspots, locale, style]);

  useEffect(() => {
    if (!isPromptManuallyEdited) {
      setPromptDraft(autoPrompt);
    }
  }, [autoPrompt, isPromptManuallyEdited]);

  // Reset new state when modal closes
  useEffect(() => {
    return () => {
      setGenerateHotspotImages(false);
      setHotspotGenProgress(null);
      setDetectionProgress(null);
      setDetectionPreview(null);
      setDetectionImage(null);
      setShowDetectionConfirm(false);
    };
  }, []);

  if (!open) return null;

  const hotspotContexts = computeHotspotContextsInline(sceneDimensions, hotspots, locale);

  const handleConfirmDetection = () => {
    if (!detectionPreview) return;
    for (const preview of detectionPreview) {
      updateHotspotArea(caseId, sceneId, preview.hotspotId, preview.detectedArea);
    }
    setShowDetectionConfirm(false);
    setDetectionPreview(null);
    setDetectionImage(null);
    onClose();
  };

  const handleCancelDetection = () => {
    setShowDetectionConfirm(false);
    setDetectionPreview(null);
    setDetectionImage(null);
  };

  const handleGenerate = async () => {
    const effectiveDescription = isPromptManuallyEdited
      ? promptDraft.trim()
      : description.trim();
    if (!effectiveDescription) return;
    setIsLoading(true);
    setError(null);
    setDetectionProgress('이미지 생성 중...');
    try {
      const aiModule = await import('@gi-engine/ai') as {
        generateBackgroundWithDetection: (req: {
          sceneDescription: string;
          style: BackgroundStyle;
          aspectRatio: '16:9';
          gameContext?: GameContextForPrompt;
          hotspots: HotspotPromptInfo[];
          sceneWidth: number;
          sceneHeight: number;
          onProgress?: (step: string) => void;
        }) => Promise<{
          asset: { id: string; type: 'image'; src: string; inline?: string; mimeType: string; alt?: { ko: string; en: string } };
          updatedHotspots: Array<{ hotspotId: string; area: HotspotArea }>;
          detectionResults: Array<{ hotspotId: string; area: HotspotArea; confidence: number }>;
          promptUsed: string;
        }>;
      };

      const hotspotInfos = buildHotspotPromptInfos(sceneDimensions, hotspots, locale, new Map());

      const result = isPromptManuallyEdited
        ? await aiModule.generateBackgroundWithDetection({
            sceneDescription: effectiveDescription,
            style,
            aspectRatio: '16:9',
            hotspots: hotspotInfos,
            sceneWidth: sceneDimensions.width,
            sceneHeight: sceneDimensions.height,
            onProgress: (step) => setDetectionProgress(step),
          })
        : await aiModule.generateBackgroundWithDetection({
            sceneDescription: effectiveDescription,
            style,
            aspectRatio: '16:9',
            gameContext: gameContext || undefined,
            hotspots: hotspotInfos,
            sceneWidth: sceneDimensions.width,
            sceneHeight: sceneDimensions.height,
            onProgress: (step) => setDetectionProgress(step),
          });

      setDetectionProgress(null);
      addAsset(result.asset);
      updateScene(caseId, sceneId, { background: result.asset.id });

      const preview: DetectedAreaPreview[] = result.updatedHotspots.map((updated) => {
        const originalHotspot = hotspots.find(h => h.id === updated.hotspotId);
        return {
          hotspotId: updated.hotspotId,
          label: originalHotspot?.ariaLabel?.[locale] || originalHotspot?.ariaLabel?.ko || updated.hotspotId,
          detectedArea: updated.area,
          originalArea: originalHotspot?.area || updated.area,
        };
      });

      setDetectionImage(result.asset.inline || null);
      setDetectionPreview(preview);
      setShowDetectionConfirm(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setDetectionProgress(null);
    }
  };

  const handleCopyPrompt = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(promptDraft).catch(() => {/* ignore */});
    }
  };

  const handleResetPrompt = () => {
    setIsPromptManuallyEdited(false);
    setPromptDraft(autoPrompt);
  };

  return (
    <>
      {/* Backdrop — blocked while loading */}
      <div
        onClick={isLoading ? undefined : onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 20,
          zIndex: 1001,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            AI 배경 생성
          </div>
          <button
            onClick={isLoading ? undefined : onClose}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Game context summary */}
        {gameContext && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)', fontSize: 11 }}>
              게임 컨텍스트 (프롬프트에 자동 반영)
            </div>
            <div>사건: {gameContext.caseTitle}</div>
            <div>씬: {gameContext.sceneName}</div>
            {gameContext.hotspots.length > 0 && (
              <div>핫스팟: {gameContext.hotspots.length}개</div>
            )}
            {gameContext.sceneWords && gameContext.sceneWords.length > 0 && (
              <div>단서: {gameContext.sceneWords.map(w => w.display).join(', ')}</div>
            )}
          </div>
        )}

        {/* Scene description */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            장면 설명
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="예: 어두운 서재, 책상 위에 촛불이 켜져 있고 창밖에 비가 내린다"
            rows={3}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Context preview — collapsible */}
        {hotspots.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setContextExpanded(v => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: contextExpanded ? 8 : 0,
              }}
            >
              {contextExpanded ? '▼' : '▶'}
              씬 오브젝트 컨텍스트 ({hotspots.length}개)
            </button>
            {contextExpanded && (
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>레이블</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>위치</th>
                    <th style={{ textAlign: 'left', padding: '3px 6px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>크기</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspotContexts.map((ctx, i) => (
                    <tr key={i}>
                      <td style={{ padding: '3px 6px', color: 'var(--text-secondary)' }}>{ctx.label}</td>
                      <td style={{ padding: '3px 6px', color: 'var(--text-secondary)' }}>{ctx.positionZone}</td>
                      <td style={{ padding: '3px 6px', color: 'var(--text-secondary)' }}>{ctx.relativeSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Prompt draft */}
        {description.trim() && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                생성될 프롬프트 {gameContext ? '(게임 컨텍스트 포함)' : ''}
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isPromptManuallyEdited && (
                  <button
                    onClick={handleResetPrompt}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    자동 생성으로 초기화
                  </button>
                )}
                <button
                  onClick={handleCopyPrompt}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 3,
                  }}
                >
                  복사
                </button>
              </div>
            </div>
            <textarea
              value={promptDraft}
              onChange={e => {
                setPromptDraft(e.target.value);
                setIsPromptManuallyEdited(true);
              }}
              rows={8}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 11,
                background: 'var(--bg-card)',
                color: isPromptManuallyEdited ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: `1px solid ${isPromptManuallyEdited ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: 3,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
          </div>
        )}

        {/* Style selector */}
        {(() => {
          const examineImageTargets = findExamineImageHotspotsNeedingImage(hotspots, locale);
          if (examineImageTargets.length === 0) return null;
          return (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={generateHotspotImages}
                  onChange={e => setGenerateHotspotImages(e.target.checked)}
                  disabled={isLoading}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  조사 이미지 핫스팟 자동 생성 ({examineImageTargets.length}개)
                </span>
              </label>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, paddingLeft: 22 }}>
                핫스팟의 캡션/레이블을 기반으로 AI 이미지를 자동 생성합니다
              </div>
            </div>
          );
        })()}

        {/* Hotspot image generation progress */}
        {hotspotGenProgress && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 4,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}>
            핫스팟 이미지 생성 중... ({hotspotGenProgress.current}/{hotspotGenProgress.total})
          </div>
        )}

        {/* Detection confirmation UI */}
        {showDetectionConfirm && detectionPreview && detectionImage && (
          <div style={{
            marginBottom: 12,
            padding: 12,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 4,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              핫스팟 위치 감지 완료
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              감지된 영역을 확인하고 필요시 수동으로 조정하세요.
            </div>
            {/* Image preview with overlay */}
            <div style={{
              position: 'relative',
              width: '100%',
              marginBottom: 8,
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <img
                src={`data:image/png;base64,${detectionImage}`}
                alt="생성된 배경"
                style={{ width: '100%', display: 'block' }}
              />
              {/* Hotspot overlays */}
              {detectionPreview.map((preview, idx) => {
                const area = preview.detectedArea;
                if (area.type !== 'rect') return null;
                const scaleX = 100 / sceneDimensions.width;
                const scaleY = 100 / sceneDimensions.height;
                return (
                  <div
                    key={preview.hotspotId}
                    title={preview.label}
                    style={{
                      position: 'absolute',
                      left: `${area.x * scaleX}%`,
                      top: `${area.y * scaleY}%`,
                      width: `${area.width * scaleX}%`,
                      height: `${area.height * scaleY}%`,
                      border: '2px solid rgba(16, 185, 129, 0.8)',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      borderRadius: 2,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: -18,
                      left: 0,
                      fontSize: 9,
                      color: 'rgba(16, 185, 129, 1)',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      padding: '1px 4px',
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                    }}>
                      {idx + 1}. {preview.label.length > 15 ? preview.label.slice(0, 15) + '...' : preview.label}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Detection results list */}
            <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 8 }}>
              {detectionPreview.map((preview, idx) => (
                <div key={preview.hotspotId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                  fontSize: 10,
                }}>
                  <span style={{ color: 'var(--text-muted)', width: 16 }}>{idx + 1}.</span>
                  <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preview.label}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {preview.detectedArea.type === 'rect'
                      ? `x:${preview.detectedArea.x} y:${preview.detectedArea.y} w:${preview.detectedArea.width} h:${preview.detectedArea.height}`
                      : 'circle'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            스타일
          </label>
          <select
            value={style}
            onChange={e => setStyle(e.target.value as BackgroundStyle)}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {(Object.keys(STYLE_LABELS) as BackgroundStyle[]).map(s => (
              <option key={s} value={s}>{STYLE_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 3,
            fontSize: 12,
            color: 'var(--danger-text)',
          }}>
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {showDetectionConfirm ? (
            <>
              <button
                onClick={handleCancelDetection}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: 12,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmDetection}
                style={{
                  flex: 2,
                  padding: '7px 12px',
                  fontSize: 12,
                  background: 'var(--accent)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                핫스팟 영역 적용
              </button>
            </>
          ) : (
            <>
              <button
                onClick={isLoading ? undefined : onClose}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: 12,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading || !description.trim()}
                style={{
                  flex: 2,
                  padding: '7px 12px',
                  fontSize: 12,
                  background: !isLoading && description.trim() ? 'var(--accent)' : 'var(--bg-card)',
                  color: !isLoading && description.trim() ? '#000' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 3,
                  cursor: !isLoading && description.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                {isLoading
                  ? detectionProgress
                    ? detectionProgress
                    : hotspotGenProgress
                    ? `핫스팟 이미지 생성 중 (${hotspotGenProgress.current}/${hotspotGenProgress.total})...`
                    : '생성 중...'
                  : generateHotspotImages && findExamineImageHotspotsNeedingImage(hotspots, locale).length > 0
                  ? '배경 + 핫스팟 이미지 생성'
                  : '배경 + 핫스팟 감지 생성'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
