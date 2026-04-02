import React, { useState, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { AssetDefinition, AssetCategory } from '@gi-engine/core';

// ── Types ───────────────────────────────────────────────────────────

type ImageCategory = 'background' | 'character' | 'object' | 'ui';
type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';
type AspectRatio = '16:9' | '4:3' | '1:1';

interface GeneratedPreview {
  asset: AssetDefinition;
  promptUsed: string;
  category: ImageCategory;
}

interface AIAssetGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  initialCategory?: ImageCategory;
}

// ── Constants ───────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ImageCategory, {
  label: string;
  icon: string;
  assetCategory: AssetCategory;
  placeholder: string;
  promptPrefix: string;
  promptSuffix: string;
  aspectRatios: AspectRatio[];
  defaultAspect: AspectRatio;
}> = {
  background: {
    label: '배경',
    icon: '🏛',
    assetCategory: 'background',
    placeholder: '예: 빅토리아 시대 서재, 책장이 가득하고 창문에 달빛이 비치는',
    promptPrefix: 'Mystery point-and-click game background scene: ',
    promptSuffix: ' Wide angle, no human characters, no text, suitable as interactive scene background.',
    aspectRatios: ['16:9', '4:3'],
    defaultAspect: '16:9',
  },
  character: {
    label: '캐릭터',
    icon: '🧑',
    assetCategory: 'character',
    placeholder: '예: 50대 탐정, 회색 코트와 중절모, 냉정한 표정',
    promptPrefix: 'Mystery game character portrait: ',
    promptSuffix: ' Game character portrait, detailed face, painterly style, simple or transparent background, no text.',
    aspectRatios: ['1:1', '4:3'],
    defaultAspect: '1:1',
  },
  object: {
    label: '오브젝트',
    icon: '🔍',
    assetCategory: 'object',
    placeholder: '예: 봉인된 편지봉투, 빅토리아 시대 스타일, 붉은 밀랍 도장',
    promptPrefix: 'Mystery game item/object asset: ',
    promptSuffix: ' Isolated item on neutral background, detailed, game asset style, no text.',
    aspectRatios: ['1:1', '4:3'],
    defaultAspect: '1:1',
  },
  ui: {
    label: 'UI 요소',
    icon: '🖼',
    assetCategory: 'ui',
    placeholder: '예: 탐정 수첩 표지, 빈티지 가죽 질감, 금속 잠금쇠',
    promptPrefix: 'Mystery game UI element: ',
    promptSuffix: ' Clean game UI asset, suitable for interface use, no text or letters.',
    aspectRatios: ['1:1', '4:3', '16:9'],
    defaultAspect: '4:3',
  },
};

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

const BATCH_COUNTS = [1, 2, 4] as const;

// ── Helpers ─────────────────────────────────────────────────────────

function buildPrompt(
  description: string,
  category: ImageCategory,
  style: BackgroundStyle,
): string {
  const cfg = CATEGORY_CONFIG[category];
  const styleDesc = STYLE_DESCRIPTORS[style];
  return `${cfg.promptPrefix}${description}.${cfg.promptSuffix} Style: ${styleDesc}.`;
}

function formatThumbSrc(asset: AssetDefinition): string | null {
  if (asset.type !== 'image') return null;
  return asset.inline
    ? `data:${asset.mimeType};base64,${asset.inline}`
    : asset.src || null;
}

// ── Main component ──────────────────────────────────────────────────

export function AIAssetGeneratorModal({
  open,
  onClose,
  initialCategory = 'background',
}: AIAssetGeneratorModalProps): React.ReactElement | null {
  const { addAsset } = useEditorStore();

  const [category, setCategory] = useState<ImageCategory>(initialCategory);
  const [style, setStyle] = useState<BackgroundStyle>('painterly');
  const [description, setDescription] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(CATEGORY_CONFIG[initialCategory].defaultAspect);
  const [batchCount, setBatchCount] = useState<1 | 2 | 4>(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedPreview[]>([]);

  const cfg = CATEGORY_CONFIG[category];

  const handleCategoryChange = useCallback((next: ImageCategory) => {
    setCategory(next);
    setAspectRatio(CATEGORY_CONFIG[next].defaultAspect);
    setError(null);
  }, []);

  const effectivePrompt = useCustomPrompt
    ? customPrompt.trim()
    : description.trim()
      ? buildPrompt(description.trim(), category, style)
      : '';

  const handleGenerate = async () => {
    if (!effectivePrompt) return;
    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: batchCount });

    const newItems: GeneratedPreview[] = [];

    try {
      const aiModule = await import('@gi-engine/ai') as {
        generateBackground: (req: {
          sceneDescription: string;
          style: BackgroundStyle;
          aspectRatio: AspectRatio;
        }) => Promise<{ asset: AssetDefinition; promptUsed: string }>;
      };

      for (let i = 0; i < batchCount; i++) {
        setProgress({ current: i + 1, total: batchCount });
        const result = await aiModule.generateBackground({
          sceneDescription: effectivePrompt,
          style,
          aspectRatio,
        });

        // Stamp category onto asset
        const assetWithCategory: AssetDefinition = {
          ...result.asset,
          category: cfg.assetCategory,
        };

        addAsset(assetWithCategory);
        newItems.push({
          asset: assetWithCategory,
          promptUsed: result.promptUsed,
          category,
        });
      }

      setHistory(prev => [...newItems, ...prev].slice(0, 12));
      setDescription('');
      setCustomPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  if (!open) return null;

  const canGenerate = !!effectivePrompt && !isGenerating;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={isGenerating ? undefined : onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 20,
        zIndex: 1001,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            ✨ AI 에셋 생성
          </div>
          <button
            onClick={isGenerating ? undefined : onClose}
            disabled={isGenerating}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: 18, padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {(Object.keys(CATEGORY_CONFIG) as ImageCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                flex: 1,
                padding: '5px 4px',
                fontSize: 11,
                fontWeight: category === cat ? 600 : 400,
                color: category === cat ? 'var(--accent)' : 'var(--text-muted)',
                background: category === cat ? 'var(--accent-dim)' : 'var(--bg-card)',
                border: `1px solid ${category === cat ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 16 }}>{CATEGORY_CONFIG[cat].icon}</span>
              <span>{CATEGORY_CONFIG[cat].label}</span>
            </button>
          ))}
        </div>

        {/* Prompt toggle */}
        <div style={{ marginBottom: 10, display: 'flex', gap: 6 }}>
          <button
            onClick={() => setUseCustomPrompt(false)}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 3,
              border: `1px solid ${!useCustomPrompt ? 'var(--accent)' : 'var(--border-color)'}`,
              background: !useCustomPrompt ? 'var(--accent-dim)' : 'transparent',
              color: !useCustomPrompt ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            설명으로 생성
          </button>
          <button
            onClick={() => {
              setUseCustomPrompt(true);
              if (!customPrompt && description.trim()) {
                setCustomPrompt(buildPrompt(description.trim(), category, style));
              }
            }}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 3,
              border: `1px solid ${useCustomPrompt ? 'var(--accent)' : 'var(--border-color)'}`,
              background: useCustomPrompt ? 'var(--accent-dim)' : 'transparent',
              color: useCustomPrompt ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            직접 프롬프트 입력
          </button>
        </div>

        {!useCustomPrompt ? (
          <>
            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                설명 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(한국어 또는 영어)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={cfg.placeholder}
                rows={3}
                style={{
                  width: '100%', padding: '6px 8px',
                  fontSize: 12,
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3, outline: 'none', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Style + Aspect ratio */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  스타일
                </label>
                <select
                  value={style}
                  onChange={e => setStyle(e.target.value as BackgroundStyle)}
                  style={{
                    width: '100%', padding: '5px 8px', fontSize: 12,
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3, outline: 'none', cursor: 'pointer',
                  }}
                >
                  {(Object.keys(STYLE_LABELS) as BackgroundStyle[]).map(s => (
                    <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  비율
                </label>
                <select
                  value={aspectRatio}
                  onChange={e => setAspectRatio(e.target.value as AspectRatio)}
                  style={{
                    width: '100%', padding: '5px 8px', fontSize: 12,
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 3, outline: 'none', cursor: 'pointer',
                  }}
                >
                  {cfg.aspectRatios.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview of auto prompt */}
            {description.trim() && (
              <div style={{
                marginBottom: 12,
                padding: '6px 8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 80,
                overflowY: 'auto',
              }}>
                {effectivePrompt}
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              직접 프롬프트
            </label>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="영어 프롬프트를 직접 입력하세요..."
              rows={5}
              style={{
                width: '100%', padding: '6px 8px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 3, outline: 'none', resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
          </div>
        )}

        {/* Batch count */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            생성 개수
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {BATCH_COUNTS.map(n => (
              <button
                key={n}
                onClick={() => setBatchCount(n)}
                style={{
                  padding: '4px 14px', fontSize: 12,
                  fontWeight: batchCount === n ? 600 : 400,
                  color: batchCount === n ? 'var(--accent)' : 'var(--text-muted)',
                  background: batchCount === n ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: `1px solid ${batchCount === n ? 'var(--accent)' : 'var(--border-color)'}`,
                  borderRadius: 3, cursor: 'pointer',
                }}
              >
                {n}개
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: 12, padding: '8px 10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 3, fontSize: 12, color: 'var(--danger-text)',
          }}>
            {error}
          </div>
        )}

        {/* Progress */}
        {isGenerating && progress && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              생성 중... ({progress.current} / {progress.total})
            </div>
            <div style={{
              height: 4, background: 'var(--bg-card)',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(progress.current / progress.total) * 100}%`,
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: history.length > 0 ? 16 : 0 }}>
          <button
            onClick={isGenerating ? undefined : onClose}
            disabled={isGenerating}
            style={{
              flex: 1, padding: '7px 12px', fontSize: 12,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3, cursor: isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            닫기
          </button>
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{
              flex: 2, padding: '7px 12px', fontSize: 12,
              background: canGenerate ? 'var(--accent)' : 'var(--bg-card)',
              color: canGenerate ? '#000' : 'var(--text-muted)',
              border: 'none', borderRadius: 3,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {isGenerating
              ? `생성 중... (${progress?.current ?? 0}/${batchCount})`
              : `✨ ${cfg.label} 생성${batchCount > 1 ? ` (×${batchCount})` : ''}`}
          </button>
        </div>

        {/* Generation history */}
        {history.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: 'var(--text-muted)',
              marginBottom: 8,
              borderTop: '1px solid var(--border-color)',
              paddingTop: 12,
            }}>
              생성 히스토리 (에셋 매니저에 자동 등록됨)
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
            }}>
              {history.map(item => {
                const thumb = formatThumbSrc(item.asset);
                return (
                  <div
                    key={item.asset.id}
                    title={`${item.asset.alt?.ko ?? item.asset.id}\n${item.promptUsed}`}
                    style={{
                      width: 72, height: 72,
                      borderRadius: 4,
                      overflow: 'hidden',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24,
                      }}>
                        {CATEGORY_CONFIG[item.category].icon}
                      </div>
                    )}
                    {/* Category badge */}
                    <div style={{
                      position: 'absolute', bottom: 2, right: 2,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff', fontSize: 8, padding: '1px 3px', borderRadius: 2,
                    }}>
                      {CATEGORY_CONFIG[item.category].label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
