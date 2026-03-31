import React, { useRef } from 'react';
import type { SceneLayer } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';

interface LayerPropertiesProps {
  layer: SceneLayer;
  caseId: string;
  sceneId: string;
}

export function LayerProperties({ layer, caseId, sceneId }: LayerPropertiesProps): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const { updateLayer, addAsset } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<SceneLayer>) => updateLayer(caseId, sceneId, layer.id, p);

  const imageAsset = layer.image ? project?.assets.items[layer.image] : null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    patch({ image: '' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      console.error('이미지 파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');

      const assetId = `asset_layer_${Date.now()}`;
      addAsset({
        id: assetId,
        type: 'image',
        src: '',
        inline: base64Data,
        mimeType,
        size: file.size,
        alt: { ko: file.name, en: file.name },
      });
      patch({ image: assetId });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={sectionHeader}>레이어 속성</div>

      {/* ID */}
      <Field label="ID">
        <input type="text" value={layer.id} readOnly style={{ width: '100%', opacity: 0.6 }} />
      </Field>

      {/* Image */}
      <div>
        <div style={labelStyle}>이미지</div>
        <div
          style={{
            width: '100%',
            height: 80,
            marginTop: 4,
            marginBottom: 6,
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            background: imageAsset
              ? undefined
              : 'repeating-conic-gradient(#2a2a3a 0% 25%, #1e1e2e 0% 50%) 0 0 / 16px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {imageAsset ? (
            <img
              src={imageAsset.inline ? `data:${imageAsset.mimeType};base64,${imageAsset.inline}` : imageAsset.src}
              alt={imageAsset.alt?.ko ?? ''}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>이미지 없음</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleUploadClick}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: 11,
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            이미지 업로드
          </button>
          {imageAsset && (
            <button
              onClick={handleRemoveImage}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              제거
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* Position */}
      <div>
        <div style={labelStyle}>위치</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>X</span>
            <input
              type="number"
              value={layer.position.x}
              onChange={e => patch({ position: { ...layer.position, x: Number(e.target.value) } })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Y</span>
            <input
              type="number"
              value={layer.position.y}
              onChange={e => patch({ position: { ...layer.position, y: Number(e.target.value) } })}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </div>

      {/* zIndex */}
      <Field label="Z-Index (깊이)">
        <input
          type="number"
          value={layer.zIndex}
          onChange={e => patch({ zIndex: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </Field>

      {/* Visibility */}
      <Field label="기본 가시성">
        <select
          value={layer.visible ? 'visible' : 'hidden'}
          onChange={e => patch({ visible: e.target.value === 'visible' })}
          style={{ width: '100%' }}
        >
          <option value="visible">표시</option>
          <option value="hidden">숨김</option>
        </select>
      </Field>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  paddingBottom: 8,
  borderBottom: '1px solid var(--border-color)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
