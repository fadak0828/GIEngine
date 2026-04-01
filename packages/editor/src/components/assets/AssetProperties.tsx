import React, { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { AssetCategory } from '@gi-engine/core';
import { ImageEditorModal } from './ImageEditorModal';
import { AudioEditorModal } from './AudioEditorModal';

// ── Constants ─────────────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: 'background', label: '배경' },
  { value: 'character', label: '캐릭터' },
  { value: 'object', label: '오브젝트' },
  { value: 'ui', label: 'UI' },
  { value: 'audio_bgm', label: 'BGM' },
  { value: 'audio_sfx', label: '효과음' },
  { value: 'font', label: '폰트' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ── Section heading ───────────────────────────────────────────────

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return (
    <div style={{
      padding: '6px 12px',
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      {label}
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ padding: '5px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── TagEditor ─────────────────────────────────────────────────────

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

function TagEditor({ tags, onChange }: TagEditorProps): React.ReactElement {
  const [input, setInput] = useState('');

  const addTag = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) {
      onChange([...tags, t]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div>
      {/* Existing tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px',
              fontSize: 10,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderRadius: 10,
              color: 'var(--accent)',
            }}>
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, lineHeight: 1, fontSize: 11 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Input */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder="태그 입력 후 Enter"
          style={{
            flex: 1,
            padding: '3px 6px',
            fontSize: 11,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={addTag}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          추가
        </button>
      </div>
    </div>
  );
}

// ── AssetProperties ───────────────────────────────────────────────

export function AssetProperties(): React.ReactElement | null {
  const project = useEditorStore(s => s.project);
  const selectedAssetId = useEditorStore(s => s.selection.assetId);
  const editorLocale = useEditorStore(s => s.ui.editorLocale);
  const { updateAsset, deleteAsset, setSelectedAsset, getAssetUsages, showNotification } = useEditorStore();

  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showAudioEditor, setShowAudioEditor] = useState(false);

  if (!project || !selectedAssetId) return null;
  const asset = project.assets.items[selectedAssetId];
  if (!asset) return null;

  const usages = getAssetUsages(selectedAssetId);
  const thumbSrc = asset.type === 'image'
    ? (asset.inline ? `data:${asset.mimeType};base64,${asset.inline}` : asset.src || null)
    : null;
  const name = asset.alt?.[editorLocale] ?? asset.id;
  const fileSize = asset.fileSize ?? asset.size;

  const handleDelete = () => {
    if (usages.length > 0) {
      const confirmed = window.confirm(
        `이 에셋은 ${usages.length}곳에서 사용 중입니다.\n삭제하면 해당 참조가 깨집니다. 계속하시겠습니까?`
      );
      if (!confirmed) return;
    }
    deleteAsset(selectedAssetId);
    setSelectedAsset(null);
    showNotification('에셋이 삭제되었습니다.', 'success');
  };

  const handleEditSave = (newBase64: string, newMimeType: string) => {
    updateAsset(selectedAssetId, { inline: newBase64, mimeType: newMimeType });
    setShowImageEditor(false);
    setShowAudioEditor(false);
    showNotification('에셋이 저장되었습니다.', 'success');
  };

  return (
    <div>
      {/* Modals */}
      {showImageEditor && (asset.type === 'image') && (
        <ImageEditorModal
          asset={asset}
          onSave={handleEditSave}
          onClose={() => setShowImageEditor(false)}
        />
      )}
      {showAudioEditor && (asset.type === 'audio') && (
        <AudioEditorModal
          asset={asset}
          onSave={handleEditSave}
          onClose={() => setShowAudioEditor(false)}
        />
      )}

      {/* Preview */}
      <div style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {asset.type === 'image' && thumbSrc ? (
            <img src={thumbSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 28 }}>
              {asset.type === 'audio' ? '🎵' : asset.type === 'font' ? 'Ff' : '🖼'}
            </span>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.id}
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              {asset.type}
            </span>
            {fileSize != null && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatBytes(fileSize)}</span>
            )}
            {asset.dimensions && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                {asset.dimensions.width}×{asset.dimensions.height}
              </span>
            )}
          </div>
          {(asset.type === 'image' || asset.type === 'audio') && (
            <button
              onClick={() => {
                if (asset.type === 'image') setShowImageEditor(true);
                else setShowAudioEditor(true);
              }}
              style={{
                marginTop: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              ✏ 편집
            </button>
          )}
        </div>
      </div>

      {/* Metadata editing */}
      <SectionHeader label="메타데이터" />

      <FieldRow label="표시 이름">
        <input
          type="text"
          value={asset.alt?.[editorLocale] ?? ''}
          onChange={e => updateAsset(selectedAssetId, { alt: { ko: '', en: '', ...(asset.alt ?? {}), [editorLocale]: e.target.value } })}
          style={{
            padding: '4px 6px',
            fontSize: 12,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </FieldRow>

      <FieldRow label="폴더">
        <input
          type="text"
          value={asset.folder ?? ''}
          onChange={e => updateAsset(selectedAssetId, { folder: e.target.value || undefined })}
          placeholder="예: characters/npc"
          style={{
            padding: '4px 6px',
            fontSize: 12,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      </FieldRow>

      <FieldRow label="카테고리">
        <select
          value={asset.category ?? ''}
          onChange={e => updateAsset(selectedAssetId, { category: (e.target.value as AssetCategory) || undefined })}
          style={{
            padding: '4px 6px',
            fontSize: 12,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        >
          <option value="">미분류</option>
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="태그">
        <TagEditor
          tags={asset.tags ?? []}
          onChange={tags => updateAsset(selectedAssetId, { tags })}
        />
      </FieldRow>

      {/* Usage tracking */}
      <SectionHeader label={`사용처 (${usages.length})`} />

      {usages.length === 0 ? (
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
          이 에셋은 현재 사용되지 않습니다
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          {usages.map((u, i) => (
            <div key={i} style={{
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              borderBottom: '1px solid var(--border-color)',
            }}>
              <span style={{
                fontSize: 9,
                padding: '1px 4px',
                borderRadius: 3,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                flexShrink: 0,
              }}>
                {u.kind === 'scene_background' ? 'BG' :
                  u.kind === 'scene_bgm' ? 'BGM' :
                  u.kind === 'scene_sfx' ? 'SFX' :
                  u.kind === 'layer_image' ? 'LAYER' : 'ACTION'}
              </span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.sceneName}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.caseName}{u.detail ? ` · ${u.detail}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border-color)' }}>
        <button
          type="button"
          onClick={handleDelete}
          style={{
            width: '100%',
            padding: '5px 0',
            fontSize: 12,
            background: 'transparent',
            border: '1px solid var(--danger)',
            borderRadius: 3,
            color: 'var(--danger)',
            cursor: 'pointer',
            fontWeight: 600,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,64,64,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          에셋 삭제
        </button>
      </div>
    </div>
  );
}
