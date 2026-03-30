import React, { useRef } from 'react';
import type { Scene } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';

interface ScenePropertiesProps {
  scene: Scene;
  caseId: string;
}

export function SceneProperties({ scene, caseId }: ScenePropertiesProps): React.ReactElement {
  const ui = useEditorStore(s => s.ui);
  const project = useEditorStore(s => s.project);
  const { addAsset, updateScene } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgAsset = scene.background ? project?.assets.items[scene.background] : null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveBackground = () => {
    updateScene(caseId, scene.id, { background: '' });
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
      // dataUrl format: data:<mimeType>;base64,<data>
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');

      const assetId = `asset_bg_${Date.now()}`;
      addAsset({
        id: assetId,
        type: 'image',
        src: '',
        inline: base64Data,
        mimeType,
        size: file.size,
        alt: { ko: file.name, en: file.name },
      });
      updateScene(caseId, scene.id, { background: assetId });
    };
    reader.readAsDataURL(file);

    // Reset file input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div style={{ padding: 12 }}>
      {/* Scene name */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        🎬 {scene.name[ui.editorLocale]}
      </div>

      {/* Scene metadata */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
        <span>ID: {scene.id}</span>
        <span>해상도: {scene.dimensions.width} × {scene.dimensions.height}</span>
        <span>핫스팟: {scene.hotspots.length}개</span>
      </div>

      {/* Background section */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          배경 이미지
        </div>

        {/* Thumbnail */}
        <div
          style={{
            width: '100%',
            aspectRatio: `${scene.dimensions.width} / ${scene.dimensions.height}`,
            marginBottom: 8,
            borderRadius: 4,
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            background: bgAsset
              ? undefined
              : 'repeating-conic-gradient(#2a2a3a 0% 25%, #1e1e2e 0% 50%) 0 0 / 16px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {bgAsset ? (
            <img
              src={bgAsset.inline ? `data:${bgAsset.mimeType};base64,${bgAsset.inline}` : bgAsset.src}
              alt={bgAsset.alt?.ko ?? ''}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>배경 없음</span>
          )}
        </div>

        {/* Upload / Remove buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleUploadClick}
            style={{
              flex: 1,
              padding: '5px 8px',
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
          {bgAsset && (
            <button
              onClick={handleRemoveBackground}
              style={{
                padding: '5px 8px',
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

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        핫스팟을 클릭하면 속성을 편집할 수 있습니다.
      </div>
    </div>
  );
}
