import React, { useState, useMemo, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Hotspot, Locale } from '@gi-engine/core';

// Inline type to avoid compile-time dependency on @gi-engine/ai
type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';

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

// Inline hotspot context computation (pure string function, no external deps needed)
interface HotspotContext {
  label: string;
  positionZone: string;
  relativeSize: 'small' | 'medium' | 'large';
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
    return { label, positionZone, relativeSize };
  });
}

function buildContextualPromptInline(
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

export function AIBackgroundModal({
  open,
  onClose,
  sceneId,
  caseId,
  hotspots,
  sceneDimensions,
}: AIBackgroundModalProps): React.ReactElement | null {
  const { addAsset, updateScene } = useEditorStore();
  const ui = useEditorStore(s => s.ui);
  const locale = ui.editorLocale;

  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<BackgroundStyle>('painterly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contextual prompt state
  const [promptDraft, setPromptDraft] = useState('');
  const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  // Auto-compute prompt from description + hotspots + style
  const autoPrompt = useMemo(() => {
    if (!description.trim()) return '';
    return buildContextualPromptInline(description.trim(), sceneDimensions, hotspots, locale, style);
  }, [description, sceneDimensions, hotspots, locale, style]);

  // Sync promptDraft when autoPrompt changes, unless manually edited
  useEffect(() => {
    if (!isPromptManuallyEdited) {
      setPromptDraft(autoPrompt);
    }
  }, [autoPrompt, isPromptManuallyEdited]);

  if (!open) return null;

  const hotspotContexts = computeHotspotContextsInline(sceneDimensions, hotspots, locale);

  const handleGenerate = async () => {
    const effectiveDescription = promptDraft.trim() || description.trim();
    if (!effectiveDescription) return;
    setIsLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiModule = await (new Function('s', 'return import(s)'))('@gi-engine/ai') as {
        generateBackground: (req: {
          sceneDescription: string;
          style: BackgroundStyle;
          aspectRatio: '16:9';
        }) => Promise<{ asset: { id: string; type: 'image'; src: string; inline?: string; mimeType: string; alt?: { ko: string; en: string } }; promptUsed: string }>;
      };
      const result = await aiModule.generateBackground({
        sceneDescription: effectiveDescription,
        style,
        aspectRatio: '16:9',
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
          width: 480,
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
                생성될 프롬프트 초안
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
              rows={5}
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
            color: '#ef4444',
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
