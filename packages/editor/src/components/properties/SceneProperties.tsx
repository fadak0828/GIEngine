import React, { useRef, useState, useEffect } from 'react';
import type { Scene, HotspotAction } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';
import { LayerPanel } from '@/components/layers/LayerPanel';
import { AudioAssetPicker } from '@/components/shared/AudioAssetPicker';
import { WordDropdown } from '@/components/words/WordDropdown';

interface ScenePropertiesProps {
  scene: Scene;
  caseId: string;
}

export function SceneProperties({
  scene,
  caseId,
}: ScenePropertiesProps): React.ReactElement {
  const ui = useEditorStore(s => s.ui);
  const project = useEditorStore(s => s.project);
  const { addAsset, updateScene } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgmFileInputRef = useRef<HTMLInputElement>(null);

  // ── Section collapse state ─────────────────────────────────────
  const [bgOpen, setBgOpen] = useState(true);
  const [bgmOpen, setBgmOpen] = useState(true);
  const [onEnterOpen, setOnEnterOpen] = useState(false);

  // ── Checkerboard pattern colors (warm dark palette) ───────────
  const CHECKERBOARD_DARK = 'var(--bg-secondary)';
  const CHECKERBOARD_LIGHT = 'var(--bg-card)';

  // ── BGM preview state ─────────────────────────────────────────
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmLoading, setBgmLoading] = useState(false);

  // Cleanup audio on unmount or scene change
  useEffect(() => {
    return () => {
      audioEl?.pause();
    };
  }, [audioEl]);

  // Stop playback when scene changes
  useEffect(() => {
    if (audioEl) {
      audioEl.pause();
      setAudioEl(null);
      setBgmPlaying(false);
      setBgmLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  const bgAsset = scene.background
    ? project?.assets.items[scene.background]
    : null;
  const bgmAsset = scene.bgm ? project?.assets.items[scene.bgm] : null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveBackground = () => {
    updateScene(caseId, scene.id, { background: '' });
  };

  const handleBgmUploadClick = () => {
    bgmFileInputRef.current?.click();
  };

  const handleRemoveBgm = () => {
    if (audioEl) {
      audioEl.pause();
      setAudioEl(null);
      setBgmPlaying(false);
    }
    updateScene(caseId, scene.id, { bgm: undefined });
  };

  const handleBgmPlay = () => {
    if (!bgmAsset) return;

    if (bgmPlaying && audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      setAudioEl(null);
      setBgmPlaying(false);
      setBgmLoading(false);
      return;
    }

    const src = bgmAsset.inline
      ? `data:${bgmAsset.mimeType};base64,${bgmAsset.inline}`
      : bgmAsset.src;

    if (!src) return;

    setBgmLoading(true);
    const el = new Audio(src);
    el.loop = false;

    el.oncanplaythrough = () => {
      setBgmLoading(false);
    };

    el.onended = () => {
      setBgmPlaying(false);
      setAudioEl(null);
    };

    el.onerror = () => {
      setBgmLoading(false);
      setBgmPlaying(false);
      setAudioEl(null);
    };

    setAudioEl(el);
    el.play().then(() => {
      setBgmPlaying(true);
      setBgmLoading(false);
    }).catch(() => {
      setBgmLoading(false);
    });
  };

  const handleBgmFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      console.error('오디오 파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');

      const assetId = `asset_bgm_${Date.now()}`;
      addAsset({
        id: assetId,
        type: 'audio',
        src: '',
        inline: base64Data,
        mimeType,
        size: file.size,
        alt: { ko: file.name, en: file.name },
      });
      updateScene(caseId, scene.id, { bgm: assetId });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
    e.target.value = '';
  };

  return (
    <div style={{ padding: 12 }}>
      {/* Scene name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        🎬 {scene.name[ui.editorLocale]}
      </div>

      {/* Scene metadata */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginBottom: 12,
        }}
      >
        <span>ID: {scene.id}</span>
        <span>
          해상도: {scene.dimensions.width} × {scene.dimensions.height}
        </span>
        <span>핫스팟: {scene.hotspots.length}개</span>
      </div>

      {/* ── Background section ── */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <SectionHeader
          label="배경 이미지"
          open={bgOpen}
          onToggle={() => setBgOpen(o => !o)}
          ariaControlsId="scene-bg-section"
        />

        {bgOpen && (
          <>
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
                  : `repeating-conic-gradient(${CHECKERBOARD_DARK} 0% 25%, ${CHECKERBOARD_LIGHT} 0% 50%) 0 0 / 16px 16px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {bgAsset ? (
                <img
                  src={
                    bgAsset.inline
                      ? `data:${bgAsset.mimeType};base64,${bgAsset.inline}`
                      : bgAsset.src
                  }
                  alt={bgAsset.alt?.ko ?? ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  배경 없음
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleUploadClick}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 11,
                  background: 'var(--accent)',
                  color: 'var(--bg-primary)',
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
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger)',
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
          </>
        )}
      </div>

      {/* ── BGM section ── */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 12,
          marginTop: 12,
        }}
      >
        <SectionHeader
          label="BGM (배경음악)"
          open={bgmOpen}
          onToggle={() => setBgmOpen(o => !o)}
          ariaControlsId="scene-bgm-section"
        />

        {bgmOpen && (
          <>
            {bgmAsset ? (
              <div
                style={{
                  marginBottom: 8,
                  padding: '6px 8px',
                  background: 'var(--bg-card)',
                  borderRadius: 4,
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    marginBottom: 2,
                  }}
                >
                  🎵 {bgmAsset.alt?.ko ?? scene.bgm}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {bgmAsset.size ? `${Math.round(bgmAsset.size / 1024)}KB` : ''}{' '}
                  · {bgmAsset.mimeType}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                BGM 없음
              </div>
            )}

            {/* Play / Stop + Upload / Remove */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {bgmAsset && (
                <button
                  onClick={handleBgmPlay}
                  disabled={bgmLoading}
                  style={{
                    padding: '5px 8px',
                    fontSize: 11,
                    background: bgmPlaying ? 'var(--bg-secondary)' : 'var(--bg-card)',
                    color: bgmPlaying ? 'var(--accent)' : 'var(--text-primary)',
                    border: `1px solid ${bgmPlaying ? 'var(--accent)' : 'var(--border-color)'}`,
                    borderRadius: 3,
                    cursor: bgmLoading ? 'default' : 'pointer',
                    fontWeight: 600,
                    minWidth: 56,
                    opacity: bgmLoading ? 0.6 : 1,
                  }}
                >
                  {bgmLoading ? '로딩...' : bgmPlaying ? '■ 정지' : '▶ 재생'}
                </button>
              )}
              <button
                onClick={handleBgmUploadClick}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 11,
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                오디오 업로드
              </button>
              {bgmAsset && (
                <button
                  onClick={handleRemoveBgm}
                  style={{
                    padding: '5px 8px',
                    fontSize: 11,
                    background: 'transparent',
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  제거
                </button>
              )}
            </div>

            {/* BGM stop option */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={scene.bgmStop ?? false}
                onChange={e =>
                  updateScene(caseId, scene.id, { bgmStop: e.target.checked })
                }
              />
              씬 진입 시 BGM 정지
            </label>

            <input
              ref={bgmFileInputRef}
              type="file"
              accept="audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/*"
              style={{ display: 'none' }}
              onChange={handleBgmFileChange}
            />
          </>
        )}
      </div>

      {/* ── Scrollable section ── */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 12,
          marginTop: 12,
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={scene.scrollable ?? false}
            onChange={e =>
              updateScene(caseId, scene.id, { scrollable: e.target.checked || undefined })
            }
          />
          씬 패닝/스크롤 허용
        </label>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 18 }}>
          씬 크기가 뷰포트보다 클 때 드래그로 탐색 가능
        </div>
      </div>

      {/* ── onEnter section ── */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 12,
          marginTop: 12,
        }}
      >
        <SectionHeader
          label={`씬 진입 액션 (${(scene.onEnter ?? []).length})`}
          open={onEnterOpen}
          onToggle={() => setOnEnterOpen(o => !o)}
          ariaControlsId="scene-onenter-section"
        />
        {onEnterOpen && (
          <OnEnterEditor
            caseId={caseId}
            scene={scene}
            onEnter={scene.onEnter ?? []}
            onChange={onEnter => updateScene(caseId, scene.id, { onEnter })}
          />
        )}
      </div>

      {/* ── Layers section (LayerPanel manages its own collapse) ── */}
      <LayerPanel layers={scene.layers} caseId={caseId} sceneId={scene.id} />

      <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
        핫스팟 또는 레이어를 클릭하면 속성을 편집할 수 있습니다.
      </div>
    </div>
  );
}

// ── OnEnterEditor ─────────────────────────────────────────────────

/**
 * onEnter 액션 시퀀스 편집기.
 * 씬 진입 시 자동으로 실행되는 액션들을 편집한다.
 * examine/examine_image 같이 UI 인터랙션이 필요한 액션은 지원하지 않는다.
 */
function OnEnterEditor({
  caseId,
  scene,
  onEnter,
  onChange,
}: {
  caseId: string;
  scene: Scene;
  onEnter: HotspotAction[];
  onChange: (actions: HotspotAction[]) => void;
}): React.ReactElement {
  const handleAdd = () => {
    onChange([...onEnter, { type: 'delay', duration: 500 }]);
  };

  const handleRemove = (idx: number) => {
    onChange(onEnter.filter((_, i) => i !== idx));
  };

  const handleUpdate = (idx: number, updated: HotspotAction) => {
    onChange(onEnter.map((a, i) => (i === idx ? updated : a)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        씬에 진입할 때 자동으로 실행되는 액션들입니다.
      </div>

      {onEnter.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>
          액션 없음
        </div>
      )}

      {onEnter.map((action, idx) => (
        <OnEnterActionRow
          key={idx}
          idx={idx}
          caseId={caseId}
          action={action}
          scene={scene}
          onUpdate={updated => handleUpdate(idx, updated)}
          onRemove={() => handleRemove(idx)}
        />
      ))}

      <button
        onClick={handleAdd}
        style={{
          padding: '4px 8px',
          fontSize: 11,
          background: 'var(--bg-card)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 3,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        + 액션 추가
      </button>
    </div>
  );
}

const ON_ENTER_ACTION_TYPES: Array<{ value: HotspotAction['type']; label: string }> = [
  { value: 'delay', label: '대기 (delay)' },
  { value: 'toggle_layer', label: '레이어 토글' },
  { value: 'play_sound', label: '효과음 재생' },
  { value: 'navigate', label: '씬 이동' },
  { value: 'word_reveal', label: '단어 획득' },
];

function makeDefaultOnEnterAction(type: HotspotAction['type']): HotspotAction {
  switch (type) {
    case 'delay': return { type: 'delay', duration: 500 };
    case 'toggle_layer': return { type: 'toggle_layer', layerId: '' };
    case 'play_sound': return { type: 'play_sound', assetRef: '' };
    case 'navigate': return { type: 'navigate', targetSceneId: '' };
    case 'word_reveal': return { type: 'word_reveal', wordIds: [] };
    default: return { type: 'delay', duration: 500 };
  }
}

function OnEnterActionRow({
  idx,
  caseId,
  action,
  scene,
  onUpdate,
  onRemove,
}: {
  idx: number;
  caseId: string;
  action: HotspotAction;
  scene: Scene;
  onUpdate: (a: HotspotAction) => void;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        padding: '6px 8px',
        background: 'var(--bg-card)',
      }}
    >
      {/* Type selector + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
          #{idx + 1}
        </span>
        <select
          value={action.type}
          onChange={e => {
            const newType = e.target.value as HotspotAction['type'];
            onUpdate(makeDefaultOnEnterAction(newType));
          }}
          style={{
            flex: 1,
            padding: '2px 4px',
            fontSize: 11,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
          }}
        >
          {ON_ENTER_ACTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          style={{
            padding: '2px 6px',
            fontSize: 10,
            background: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger-text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ✕
        </button>
      </div>

      {/* Action-specific fields */}
      {action.type === 'delay' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
            대기 시간 (ms)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={action.duration}
            onChange={e => onUpdate({ ...action, duration: Math.max(0, Number(e.target.value)) })}
            style={{
              flex: 1,
              padding: '2px 4px',
              fontSize: 11,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
            }}
          />
        </div>
      )}

      {action.type === 'toggle_layer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <select
            value={action.layerId}
            onChange={e => onUpdate({ ...action, layerId: e.target.value })}
            style={{
              padding: '2px 4px',
              fontSize: 11,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
            }}
          >
            <option value="">-- 레이어 선택 --</option>
            {scene.layers.map(l => (
              <option key={l.id} value={l.id}>{l.id}</option>
            ))}
          </select>
          <select
            value={action.visible === undefined ? 'toggle' : action.visible ? 'show' : 'hide'}
            onChange={e => {
              const val = e.target.value;
              onUpdate({ ...action, visible: val === 'toggle' ? undefined : val === 'show' });
            }}
            style={{
              padding: '2px 4px',
              fontSize: 11,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
            }}
          >
            <option value="toggle">토글</option>
            <option value="show">표시</option>
            <option value="hide">숨김</option>
          </select>
        </div>
      )}

      {action.type === 'play_sound' && (
        <AudioAssetPicker
          assetId={action.assetRef}
          onChange={assetRef => onUpdate({ ...action, assetRef })}
        />
      )}

      {action.type === 'navigate' && (
        <input
          type="text"
          value={action.targetSceneId}
          onChange={e => onUpdate({ ...action, targetSceneId: e.target.value })}
          placeholder="씬 ID 입력..."
          style={{
            width: '100%',
            padding: '2px 4px',
            fontSize: 11,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            boxSizing: 'border-box',
          }}
        />
      )}

      {action.type === 'word_reveal' && (
        <WordDropdown
          caseId={caseId}
          wordIds={(action as { type: 'word_reveal'; wordIds: string[] }).wordIds}
          onChange={wordIds => onUpdate({ ...action, wordIds })}
        />
      )}
    </div>
  );
}

// ── SectionHeader helper ──────────────────────────────────────────

function SectionHeader({
  label,
  open,
  onToggle,
  ariaControlsId,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  ariaControlsId?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={ariaControlsId}
      onClick={onToggle}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginBottom: open ? 8 : 0,
        width: '100%',
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s',
          display: 'inline-block',
        }}
      >
        &#9654;
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
    </button>
  );
}
