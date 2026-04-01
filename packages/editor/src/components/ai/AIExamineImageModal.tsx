import React, { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { AssetDefinition } from '@gi-engine/core';

type BackgroundStyle = 'realistic' | 'painterly' | 'pixel-art' | 'noir';

const STYLE_LABELS: Record<BackgroundStyle, string> = {
  realistic: '사실적',
  painterly: '회화적',
  'pixel-art': '픽셀 아트',
  noir: '누아르',
};

interface AIExamineImageModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (assetId: string) => void;
}

export function AIExamineImageModal({
  open,
  onClose,
  onConfirm,
}: AIExamineImageModalProps): React.ReactElement | null {
  const { addAsset } = useEditorStore();

  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<BackgroundStyle>('realistic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<AssetDefinition | null>(null);

  if (!open) return null;

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsLoading(true);
    setError(null);
    setGeneratedAsset(null);
    try {
      const aiModule = await import('@gi-engine/ai') as {
        generateBackground: (req: {
          sceneDescription: string;
          style: BackgroundStyle;
          aspectRatio: '4:3';
        }) => Promise<{ asset: AssetDefinition; promptUsed: string }>;
      };
      const result = await aiModule.generateBackground({
        sceneDescription: description.trim(),
        style,
        aspectRatio: '4:3',
      });
      setGeneratedAsset(result.asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!generatedAsset) return;
    addAsset(generatedAsset);
    onConfirm(generatedAsset.id);
    onClose();
  };

  const handleClose = () => {
    if (isLoading) return;
    setDescription('');
    setGeneratedAsset(null);
    setError(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            AI 조사 이미지 생성
          </div>
          <button
            onClick={handleClose}
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

        {/* Description input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            이미지 설명
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="예: 오래된 편지, 잉크로 쓴 글씨가 번져 있고 촛농이 떨어져 있다"
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

        {/* Generate button */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !description.trim()}
            style={{
              width: '100%',
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
            {isLoading ? '생성 중...' : '이미지 생성'}
          </button>
        </div>

        {/* Error */}
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

        {/* Preview */}
        {generatedAsset && generatedAsset.inline && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>미리보기</div>
            <img
              src={`data:${generatedAsset.mimeType};base64,${generatedAsset.inline}`}
              alt="생성된 조사 이미지"
              style={{
                width: '100%',
                borderRadius: 4,
                border: '1px solid var(--border-color)',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleClose}
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
            onClick={handleConfirm}
            disabled={!generatedAsset}
            style={{
              flex: 2,
              padding: '7px 12px',
              fontSize: 12,
              background: generatedAsset ? 'var(--accent)' : 'var(--bg-card)',
              color: generatedAsset ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 3,
              cursor: generatedAsset ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            확인 (에셋으로 저장)
          </button>
        </div>
      </div>
    </>
  );
}
