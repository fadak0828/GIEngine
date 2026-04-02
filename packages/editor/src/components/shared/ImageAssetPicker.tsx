import React, { useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useClickOutside } from '@/hooks/useClickOutside';

// ── ImageAssetPicker ──────────────────────────────────────────────

interface ImageAssetPickerProps {
  assetId: string;
  onChange: (id: string) => void;
}

export function ImageAssetPicker({ assetId, onChange }: ImageAssetPickerProps): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const { addAsset } = useEditorStore();

  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(wrapperRef, () => setIsOpen(false), isOpen);

  const imageAssets = project
    ? Object.values(project.assets.items).filter(a => a.type === 'image')
    : [];

  const selectedAsset = assetId ? project?.assets.items[assetId] : null;

  const getThumbSrc = (id: string): string | null => {
    const asset = project?.assets.items[id];
    if (!asset) return null;
    return asset.inline
      ? `data:${asset.mimeType};base64,${asset.inline}`
      : asset.src || null;
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onerror = () => {
      setUploading(false);
      setUploadError('파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      const newId = `asset_img_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      addAsset({
        id: newId,
        type: 'image',
        src: '',
        inline: base64,
        mimeType,
        size: file.size,
        alt: { ko: file.name, en: file.name },
      });

      onChange(newId);
      setUploading(false);
      setIsOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const selectedThumb = selectedAsset
    ? (selectedAsset.inline
        ? `data:${selectedAsset.mimeType};base64,${selectedAsset.inline}`
        : selectedAsset.src || null)
    : null;

  // Determine whether to open panel upward based on viewport space
  const openUpward = () => {
    if (!wrapperRef.current) return false;
    const rect = wrapperRef.current.getBoundingClientRect();
    return window.innerHeight - rect.bottom < 280;
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Trigger: selected state or empty state */}
      <div
        onClick={() => setIsOpen(v => !v)}
        style={{
          border: `1px ${assetId ? 'solid' : 'dashed'} ${uploadError ? 'var(--danger)' : 'var(--border-color)'}`,
          borderRadius: 4,
          padding: assetId ? '4px 6px' : '8px 10px',
          cursor: 'pointer',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
        }}
      >
        {assetId && selectedThumb ? (
          <>
            <img
              src={selectedThumb}
              alt=""
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty(
                  'display',
                  'flex',
                );
              }}
              style={{
                width: 48,
                height: 48,
                objectFit: 'cover',
                borderRadius: 3,
                flexShrink: 0,
                border: '1px solid var(--border-color)',
              }}
            />
            <div
              style={{
                display: 'none',
                width: 48,
                height: 48,
                borderRadius: 3,
                flexShrink: 0,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🖼
            </div>
            <span
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {assetId}
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                lineHeight: 1,
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}
              title="제거"
            >
              ×
            </button>
          </>
        ) : assetId ? (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 3,
                flexShrink: 0,
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
              }}
            >
              🖼
            </div>
            <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
              {assetId}
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: 0,
                lineHeight: 1,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none' }}>
            이미지 선택 또는 업로드
          </span>
        )}
      </div>

      {uploadError && (
        <div style={{ fontSize: 10, color: 'var(--danger-text)', marginTop: 2 }}>
          {uploadError}
        </div>
      )}

      {/* Picker panel */}
      {isOpen && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            zIndex: 100,
            ...(openUpward()
              ? { bottom: '100%', marginBottom: 2 }
              : { top: '100%', marginTop: 2 }),
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Grid */}
          {imageAssets.length === 0 ? (
            <div
              style={{
                padding: '12px',
                fontSize: 11,
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              에셋이 없습니다
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
                gap: 4,
                padding: 8,
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              {imageAssets.map(asset => {
                const thumbSrc = getThumbSrc(asset.id);
                const isSelected = asset.id === assetId;
                return (
                  <div
                    key={asset.id}
                    title={asset.id}
                    onClick={() => { onChange(asset.id); setIsOpen(false); }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'var(--bg-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt=""
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty('display', 'flex');
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        fontSize: 16,
                      }}
                    >
                      🖼
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload button */}
          <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: 11,
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: `1px solid ${uploadError ? 'var(--danger)' : 'var(--border-color)'}`,
                borderRadius: 3,
                cursor: uploading ? 'default' : 'pointer',
                opacity: uploading ? 0.6 : 1,
                pointerEvents: uploading ? 'none' : 'auto',
              }}
            >
              {uploading ? '업로드 중...' : '+ 이미지 업로드'}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
    </div>
  );
}
