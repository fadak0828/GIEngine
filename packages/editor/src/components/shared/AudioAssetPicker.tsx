import React, { useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { useClickOutside } from '@/hooks/useClickOutside';

// ── AudioAssetPicker ──────────────────────────────────────────────

interface AudioAssetPickerProps {
  assetId: string;
  onChange: (id: string) => void;
}

export function AudioAssetPicker({ assetId, onChange }: AudioAssetPickerProps): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const { addAsset } = useEditorStore();

  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useClickOutside(wrapperRef, () => setIsOpen(false), isOpen);

  const audioAssets = project
    ? Object.values(project.assets.items).filter(a => a.type === 'audio')
    : [];

  const selectedAsset = assetId ? project?.assets.items[assetId] : null;

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
      const newId = `asset_audio_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      addAsset({
        id: newId,
        type: 'audio',
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

  const openUpward = () => {
    if (!wrapperRef.current) return false;
    const rect = wrapperRef.current.getBoundingClientRect();
    return window.innerHeight - rect.bottom < 220;
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div
        onClick={() => setIsOpen(v => !v)}
        style={{
          border: `1px ${assetId ? 'solid' : 'dashed'} ${uploadError ? 'var(--danger)' : 'var(--border-color)'}`,
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 32,
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>🎵</span>
        {assetId && selectedAsset ? (
          <>
            <span
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedAsset.alt?.ko ?? assetId}
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
            오디오 선택 또는 업로드
          </span>
        )}
      </div>

      {uploadError && (
        <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>
          {uploadError}
        </div>
      )}

      {/* Picker panel */}
      {isOpen && (
        <div
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
          {audioAssets.length === 0 ? (
            <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              오디오 에셋이 없습니다
            </div>
          ) : (
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {audioAssets.map(asset => {
                const isSelected = asset.id === assetId;
                return (
                  <div
                    key={asset.id}
                    onClick={() => { onChange(asset.id); setIsOpen(false); }}
                    style={{
                      padding: '6px 10px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-dim, rgba(255,165,0,0.1))' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, var(--bg-secondary))';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: 12 }}>🎵</span>
                    <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {asset.alt?.ko ?? asset.id}
                    </span>
                    {asset.size ? (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {Math.round(asset.size / 1024)}KB
                      </span>
                    ) : null}
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
              }}
            >
              {uploading ? '업로드 중...' : '+ 오디오 업로드'}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/*"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
    </div>
  );
}
