import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'gi_engine_gemini_api_key';

export function AISettings(): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = localStorage.getItem(STORAGE_KEY);
    setSaved(!!existing);
  }, []);

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setInputValue('');
    setSaved(true);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
    setInputValue('');
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
        AI 설정
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          Gemini API 키
        </label>
        <input
          type="password"
          placeholder="AIzaSy..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 12,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          onClick={handleSave}
          disabled={!inputValue.trim()}
          style={{
            flex: 1,
            padding: '5px 8px',
            fontSize: 11,
            background: inputValue.trim() ? 'var(--accent)' : 'var(--bg-card)',
            color: inputValue.trim() ? '#000' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 3,
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          저장
        </button>
        {saved && (
          <button
            onClick={handleClear}
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
            삭제
          </button>
        )}
      </div>

      {saved && (
        <div style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>✓</span>
          <span>키 저장됨</span>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        API 키는 브라우저의 로컬 스토리지에만 저장되며 프로젝트 파일에 포함되지 않습니다.
      </div>
    </div>
  );
}
