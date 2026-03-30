import React from 'react';
import type { Case } from '@gi-engine/core';
import { useEditorStore } from '@/store/editor-store';

interface CasePropertiesProps {
  caseData: Case;
}

export function CaseProperties({ caseData }: CasePropertiesProps): React.ReactElement {
  const ui = useEditorStore(s => s.ui);
  const { updateCase, setActivePanel } = useEditorStore();

  const locale = ui.editorLocale;

  return (
    <div style={{ padding: 12 }}>
      {/* Section header */}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        📁 {caseData.title[locale] || caseData.id}
      </div>

      {/* Read-only ID */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        ID: {caseData.id}
      </div>

      {/* Title — LocalizedText inputs */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          제목
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, flexShrink: 0 }}>KO</span>
            <input
              value={caseData.title.ko}
              onChange={e => updateCase(caseData.id, { title: { ...caseData.title, ko: e.target.value } })}
              style={{
                flex: 1,
                padding: '4px 6px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, flexShrink: 0 }}>EN</span>
            <input
              value={caseData.title.en}
              onChange={e => updateCase(caseData.id, { title: { ...caseData.title, en: e.target.value } })}
              style={{
                flex: 1,
                padding: '4px 6px',
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
        </div>
      </div>

      {/* Description — LocalizedText textareas */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          설명
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, flexShrink: 0, paddingTop: 4 }}>KO</span>
            <textarea
              value={caseData.description.ko}
              onChange={e => updateCase(caseData.id, { description: { ...caseData.description, ko: e.target.value } })}
              rows={3}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, flexShrink: 0, paddingTop: 4 }}>EN</span>
            <textarea
              value={caseData.description.en}
              onChange={e => updateCase(caseData.id, { description: { ...caseData.description, en: e.target.value } })}
              rows={3}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 3,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Word manager nav button */}
      <button
        onClick={() => setActivePanel('words')}
        style={{
          width: '100%',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          background: 'transparent',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          borderRadius: 3,
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        → 단어 관리 열기
      </button>

      {/* Puzzle editor button */}
      <button
        onClick={() => setActivePanel('puzzle')}
        style={{
          width: '100%',
          padding: '7px 12px',
          fontSize: 12,
          fontWeight: 600,
          background: 'var(--accent)',
          color: '#000',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        퍼즐 편집 열기
      </button>
    </div>
  );
}
