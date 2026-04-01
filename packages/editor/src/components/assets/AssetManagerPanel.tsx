import React, { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { AssetDefinition } from '@gi-engine/core';
import { AIAssetGeneratorModal } from '@/components/ai/AIAssetGeneratorModal';

// ── AssetManagerPanel ─────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  all: '전체',
  image: '이미지',
  audio: '오디오',
  font: '폰트',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function getThumbSrc(asset: AssetDefinition): string | null {
  if (asset.type !== 'image') return null;
  return asset.inline
    ? `data:${asset.mimeType};base64,${asset.inline}`
    : asset.src || null;
}

// ── AssetGridItem ─────────────────────────────────────────────────

interface AssetGridItemProps {
  asset: AssetDefinition;
  isSelected: boolean;
  onSelect: () => void;
}

function AssetGridItem({ asset, isSelected, onSelect }: AssetGridItemProps): React.ReactElement {
  const thumbSrc = getThumbSrc(asset);
  const name = asset.alt?.ko ?? asset.id;

  return (
    <div
      onClick={onSelect}
      title={`${name}\n${asset.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        borderRadius: 6,
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
        background: isSelected ? 'var(--accent-dim)' : 'var(--bg-card)',
        transition: 'border-color 0.1s, background 0.1s',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
      }}
    >
      {/* Thumbnail area */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 4,
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {asset.type === 'image' && thumbSrc ? (
          <img
            src={thumbSrc}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span style={{ fontSize: 24 }}>
            {asset.type === 'audio' ? '🎵' : asset.type === 'font' ? 'Ff' : '🖼'}
          </span>
        )}
      </div>
      {/* Name */}
      <span style={{
        fontSize: 10,
        color: 'var(--text-secondary)',
        textAlign: 'center',
        width: 72,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}>
        {name}
      </span>
    </div>
  );
}

// ── AssetListItem ─────────────────────────────────────────────────

interface AssetListItemProps {
  asset: AssetDefinition;
  isSelected: boolean;
  onSelect: () => void;
}

function AssetListItem({ asset, isSelected, onSelect }: AssetListItemProps): React.ReactElement {
  const thumbSrc = getThumbSrc(asset);
  const name = asset.alt?.ko ?? asset.id;
  const fileSize = asset.fileSize ?? asset.size;

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        cursor: 'pointer',
        background: isSelected ? 'var(--accent-dim)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Icon/Thumb */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 3,
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {asset.type === 'image' && thumbSrc ? (
          <img src={thumbSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 16 }}>
            {asset.type === 'audio' ? '🎵' : asset.type === 'font' ? 'Ff' : '🖼'}
          </span>
        )}
      </div>
      {/* Name + ID */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.id}
        </div>
      </div>
      {/* Type badge */}
      <span style={{
        fontSize: 9,
        padding: '1px 5px',
        borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        flexShrink: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {asset.type}
      </span>
      {/* Size */}
      {fileSize != null && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          {formatBytes(fileSize)}
        </span>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────

export function AssetManagerPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const ui = useEditorStore(s => s.ui);
  const selectedAssetId = useEditorStore(s => s.selection.assetId);
  const { addAsset, setSelectedAsset, setAssetViewMode, setAssetTypeFilter, setAssetSearch } = useEditorStore();

  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiGeneratorOpen, setAiGeneratorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allAssets = project ? Object.values(project.assets.items) : [];

  // Filter
  const filtered = allAssets.filter(a => {
    if (ui.assetTypeFilter !== 'all' && a.type !== ui.assetTypeFilter) return false;
    if (ui.assetSearch.trim()) {
      const q = ui.assetSearch.toLowerCase();
      const name = (a.alt?.ko ?? a.id).toLowerCase();
      const tags = (a.tags ?? []).join(' ').toLowerCase();
      if (!name.includes(q) && !a.id.toLowerCase().includes(q) && !tags.includes(q)) return false;
    }
    return true;
  });

  const processFile = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다'));
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const [header, base64] = dataUrl.split(',');
        const mimeType = header.replace('data:', '').replace(';base64', '');

        let type: 'image' | 'audio' | 'font' = 'image';
        if (mimeType.startsWith('audio/')) type = 'audio';
        else if (mimeType.includes('font') || file.name.match(/\.(ttf|otf|woff2?)$/i)) type = 'font';

        const prefix = type === 'audio' ? 'asset_audio' : type === 'font' ? 'asset_font' : 'asset_img';
        const newId = `${prefix}_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const asset: AssetDefinition = {
          id: newId,
          type,
          src: '',
          inline: base64,
          mimeType,
          size: file.size,
          fileSize: file.size,
          alt: { ko: file.name.replace(/\.[^/.]+$/, ''), en: file.name.replace(/\.[^/.]+$/, '') },
          tags: [],
        };

        addAsset(asset);
        setSelectedAsset(newId);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }, [addAsset, setSelectedAsset]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    for (const file of arr) {
      await processFile(file).catch(() => {});
    }
    setUploading(false);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  if (!project) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        프로젝트를 열거나 새로 만드세요
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag-over overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(212, 150, 58, 0.15)',
          border: '2px dashed var(--accent)',
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 600 }}>파일을 여기에 드롭하세요</span>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Type filter tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['all', 'image', 'audio', 'font'] as const).map(t => (
            <button
              key={t}
              onClick={() => setAssetTypeFilter(t)}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: ui.assetTypeFilter === t ? 600 : 400,
                color: ui.assetTypeFilter === t ? 'var(--accent)' : 'var(--text-muted)',
                background: ui.assetTypeFilter === t ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${ui.assetTypeFilter === t ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="이름, 태그 검색..."
          value={ui.assetSearch}
          onChange={e => setAssetSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 100,
            padding: '3px 7px',
            fontSize: 11,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {(['grid', 'list'] as const).map(m => (
            <button
              key={m}
              onClick={() => setAssetViewMode(m)}
              title={m === 'grid' ? '그리드 뷰' : '리스트 뷰'}
              style={{
                width: 26, height: 26,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13,
                background: ui.assetViewMode === m ? 'var(--accent-dim)' : 'var(--bg-card)',
                border: `1px solid ${ui.assetViewMode === m ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                color: ui.assetViewMode === m ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {m === 'grid' ? '⊞' : '☰'}
            </button>
          ))}
        </div>

        {/* AI Generate button */}
        <button
          onClick={() => setAiGeneratorOpen(true)}
          title="AI로 에셋 생성"
          style={{
            padding: '3px 10px',
            fontSize: 11,
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#818cf8',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: 3,
            cursor: 'pointer',
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          ✨ AI 생성
        </button>

        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRadius: 3,
            cursor: uploading ? 'default' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {uploading ? '업로드 중...' : '+ 업로드'}
        </button>
      </div>

      {/* Count info */}
      <div style={{
        padding: '4px 10px',
        fontSize: 10,
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        {filtered.length === allAssets.length
          ? `${allAssets.length}개 에셋`
          : `${filtered.length} / ${allAssets.length}개`}
      </div>

      {/* Asset list / grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, height: '100%', color: 'var(--text-muted)', fontSize: 12,
          }}>
            <span style={{ fontSize: 32 }}>📂</span>
            <span>{allAssets.length === 0 ? '에셋이 없습니다' : '검색 결과가 없습니다'}</span>
            <span style={{ fontSize: 11 }}>파일을 드래그하거나 업로드 버튼을 클릭하세요</span>
          </div>
        ) : ui.assetViewMode === 'grid' ? (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: 10,
          }}>
            {filtered.map(asset => (
              <AssetGridItem
                key={asset.id}
                asset={asset}
                isSelected={asset.id === selectedAssetId}
                onSelect={() => setSelectedAsset(asset.id === selectedAssetId ? null : asset.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {filtered.map(asset => (
              <AssetListItem
                key={asset.id}
                asset={asset}
                isSelected={asset.id === selectedAssetId}
                onSelect={() => setSelectedAsset(asset.id === selectedAssetId ? null : asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*,.ttf,.otf,.woff,.woff2"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {aiGeneratorOpen && (
        <AIAssetGeneratorModal
          open={aiGeneratorOpen}
          onClose={() => setAiGeneratorOpen(false)}
        />
      )}
    </div>
  );
}
