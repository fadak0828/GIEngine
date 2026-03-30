import React, { useState } from 'react';
import type { LocalizedText } from '@gi-engine/core';

interface LocalizedTextInputProps {
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  label?: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: Partial<LocalizedText>;
}

export function LocalizedTextInput({
  value,
  onChange,
  label,
  multiline = false,
  required = false,
  placeholder,
}: LocalizedTextInputProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'ko' | 'en'>('ko');

  const handleChange = (lang: 'ko' | 'en', text: string) => {
    onChange({ ...value, [lang]: text });
  };

  const hasWarningKo = required && !value.ko;
  const hasWarningEn = required && !value.en;

  return (
    <div className="localized-text-input" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('ko')}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: activeTab === 'ko' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeTab === 'ko' ? '#000' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          KO {hasWarningKo && <span style={{ color: '#f59e0b' }}>⚠</span>}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('en')}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
            background: activeTab === 'en' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeTab === 'en' ? '#000' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          EN {hasWarningEn && <span style={{ color: '#f59e0b' }}>⚠</span>}
        </button>
      </div>
      {multiline ? (
        <textarea
          value={value[activeTab]}
          onChange={e => handleChange(activeTab, e.target.value)}
          placeholder={placeholder?.[activeTab]}
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 13,
          }}
        />
      ) : (
        <input
          type="text"
          value={value[activeTab]}
          onChange={e => handleChange(activeTab, e.target.value)}
          placeholder={placeholder?.[activeTab]}
          style={{ width: '100%' }}
        />
      )}
    </div>
  );
}
