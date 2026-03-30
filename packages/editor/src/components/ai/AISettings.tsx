import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'gi_engine_gemini_api_key';
const TEXT_MODEL_KEY = 'gi_engine_text_model';
const IMAGE_MODEL_KEY = 'gi_engine_image_model';

// Inline model lists to avoid compile-time dependency on @gi-engine/ai
interface ModelOption { id: string; label: string; description: string; tier: 'stable' | 'preview' }

const TEXT_MODELS: ModelOption[] = [
  // Gemini 3 series (Preview)
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', description: '최신 최고 성능, 고급 추론', tier: 'preview' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', description: '빠른 프론티어급 모델', tier: 'preview' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', description: '최저 비용, 고속', tier: 'preview' },
  // Gemini 2.5 series (Stable)
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '안정적, 최고 품질 추론', tier: 'stable' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '안정적, 균형잡힌 성능 (기본)', tier: 'stable' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: '안정적, 최고속/최저비용', tier: 'stable' },
];

const IMAGE_MODELS: ModelOption[] = [
  // Imagen 4 (Stable)
  { id: 'imagen-4.0-generate-001', label: 'Imagen 4', description: '표준 이미지 생성, 2K (기본)', tier: 'stable' },
  { id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra', description: '최고 해상도/품질', tier: 'stable' },
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast', description: '빠른 이미지 생성', tier: 'stable' },
  // Gemini native image (Preview)
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', description: '네이티브 이미지 생성+편집 (Preview)', tier: 'preview' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', description: '고품질 네이티브 이미지 (Preview)', tier: 'preview' },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', description: '안정적 네이티브 이미지', tier: 'stable' },
];

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = 'imagen-4.0-generate-001';

interface AISettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AISettingsModal({ open, onClose }: AISettingsModalProps): React.ReactElement | null {
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [textModel, setTextModel] = useState(DEFAULT_TEXT_MODEL);
  const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Load current values from localStorage on open
  useEffect(() => {
    if (!open) return;
    const existing = localStorage.getItem(STORAGE_KEY);
    setHasSavedKey(!!existing);
    setApiKey('');
    setShowKey(false);
    setTextModel(localStorage.getItem(TEXT_MODEL_KEY) || DEFAULT_TEXT_MODEL);
    setImageModel(localStorage.getItem(IMAGE_MODEL_KEY) || DEFAULT_IMAGE_MODEL);
    setSaveStatus('idle');
  }, [open]);

  if (!open) return null;

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setHasSavedKey(true);
    setApiKey('');
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleClearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasSavedKey(false);
    setApiKey('');
  };

  const handleTextModelChange = (id: string) => {
    setTextModel(id);
    localStorage.setItem(TEXT_MODEL_KEY, id);
  };

  const handleImageModelChange = (id: string) => {
    setImageModel(id);
    localStorage.setItem(IMAGE_MODEL_KEY, id);
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
    marginTop: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-muted)',
    display: 'block',
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 12,
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420,
        maxHeight: '85vh',
        overflowY: 'auto',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        padding: 20,
        zIndex: 1001,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            AI 설정
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 18,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* ── API Key Section ── */}
        <div style={sectionLabelStyle}>API 키</div>

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Gemini API 키</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type={showKey ? 'text' : 'password'}
              placeholder={hasSavedKey ? '새 키를 입력하여 변경...' : 'AIzaSy...'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveKey(); }}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                background: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title={showKey ? '숨기기' : '보기'}
            >
              {showKey ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              background: apiKey.trim() ? 'var(--accent)' : 'var(--bg-card)',
              color: apiKey.trim() ? '#000' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 3,
              cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            저장
          </button>
          {hasSavedKey && (
            <button
              onClick={handleClearKey}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              키 삭제
            </button>
          )}
          {hasSavedKey && saveStatus === 'idle' && (
            <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>
              ✓ 키 저장됨
            </span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}>
              ✓ 저장 완료
            </span>
          )}
        </div>

        {/* ── Text Model Section ── */}
        <div style={sectionLabelStyle}>텍스트 생성 모델</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TEXT_MODELS.map(m => (
            <label
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: textModel === m.id ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                border: `1px solid ${textModel === m.id ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                name="textModel"
                value={m.id}
                checked={textModel === m.id}
                onChange={() => handleTextModelChange(m.id)}
                style={{ accentColor: 'var(--accent)', margin: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {m.id} — {m.description}
                </div>
              </div>
              {m.tier === 'preview' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
                  PREVIEW
                </span>
              )}
            </label>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          퍼즐 생성, 스토리 생성 등 텍스트 기반 AI 기능에 사용됩니다.
        </div>

        {/* ── Image Model Section ── */}
        <div style={sectionLabelStyle}>이미지 생성 모델</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {IMAGE_MODELS.map(m => (
            <label
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: imageModel === m.id ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                border: `1px solid ${imageModel === m.id ? 'var(--accent)' : 'var(--border-color)'}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="radio"
                name="imageModel"
                value={m.id}
                checked={imageModel === m.id}
                onChange={() => handleImageModelChange(m.id)}
                style={{ accentColor: 'var(--accent)', margin: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {m.id} — {m.description}
                </div>
              </div>
              {m.tier === 'preview' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
                  PREVIEW
                </span>
              )}
            </label>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          배경 이미지 생성 등 이미지 기반 AI 기능에 사용됩니다.
        </div>

        {/* ── Footer ── */}
        <div style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: '1px solid var(--border-color)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}>
          설정은 브라우저의 로컬 스토리지에만 저장되며 프로젝트 파일에 포함되지 않습니다.
        </div>
      </div>
    </>
  );
}
