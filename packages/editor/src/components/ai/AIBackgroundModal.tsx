import React, { useState, useMemo, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Hotspot, Locale, Case, Scene } from '@gi-engine/core';

// Inline types to avoid compile-time dependency on @gi-engine/ai
type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';

interface HotspotPromptInfo {
  id: string;
  label: string;
  positionZone: string;
  relativeSize: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  size: { width: number; height: number };
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

// ── Build HotspotPromptInfo from raw hotspots ───────────────────

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
      position: { x: ctx.centerX, y: ctx.centerY },
      size: { width: ctx.width, height: ctx.height },
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
      ],
      global_rule: 'All interactive objects must be visually distinct and naturally integrated into the scene environment.',
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
        visual_description: describeHotspotVisualInline(h),
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
  const { addAsset, updateScene } = useEditorStore();
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

  if (!open) return null;

  const hotspotContexts = computeHotspotContextsInline(sceneDimensions, hotspots, locale);

  const handleGenerate = async () => {
    const effectiveDescription = isPromptManuallyEdited
      ? promptDraft.trim()
      : description.trim();
    if (!effectiveDescription) return;
    setIsLoading(true);
    setError(null);
    try {
      const aiModule = await import('@gi-engine/ai') as {
        generateBackground: (req: {
          sceneDescription: string;
          style: BackgroundStyle;
          aspectRatio: '16:9';
          gameContext?: GameContextForPrompt;
        }) => Promise<{ asset: { id: string; type: 'image'; src: string; inline?: string; mimeType: string; alt?: { ko: string; en: string } }; promptUsed: string }>;
      };

      // When prompt is manually edited, pass it as sceneDescription directly (no gameContext)
      // When auto-generated, pass original description + gameContext for structured prompt
      const result = isPromptManuallyEdited
        ? await aiModule.generateBackground({
            sceneDescription: effectiveDescription,
            style,
            aspectRatio: '16:9',
          })
        : await aiModule.generateBackground({
            sceneDescription: effectiveDescription,
            style,
            aspectRatio: '16:9',
            gameContext: gameContext || undefined,
          });

      addAsset(result.asset);
      updateScene(caseId, sceneId, { background: result.asset.id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
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
            {isLoading ? '생성 중...' : '배경 생성'}
          </button>
        </div>
      </div>
    </>
  );
}
