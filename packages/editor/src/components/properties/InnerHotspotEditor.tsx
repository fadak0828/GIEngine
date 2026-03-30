import React, { useState } from 'react';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { WordDropdown } from '@/components/words/WordDropdown';
import type { Hotspot, HotspotAction, HotspotArea, LocalizedText } from '@gi-engine/core';

interface InnerHotspotEditorProps {
  caseId: string;
  innerHotspots: Hotspot[];
  onChange: (hotspots: Hotspot[]) => void;
}

let _innerCounter = 0;
function genInnerId(): string {
  _innerCounter += 1;
  return `inner_hs_${Date.now()}_${_innerCounter}`;
}

function makeDefaultInnerHotspot(): Hotspot {
  return {
    id: genInnerId(),
    area: { type: 'rect', x: 10, y: 10, width: 20, height: 10 },
    action: { type: 'word_reveal', wordIds: [] },
    cursor: 'pointer',
    ariaLabel: { ko: '', en: '' },
  };
}

/**
 * Editor for inner hotspots within an examine_image action.
 * Inner hotspots are positioned as percentage-based overlays on the popup image.
 * Typically used for word_reveal actions (click area on image to collect words).
 */
export function InnerHotspotEditor({
  caseId,
  innerHotspots,
  onChange,
}: InnerHotspotEditorProps): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addHotspot = () => {
    const hs = makeDefaultInnerHotspot();
    onChange([...innerHotspots, hs]);
    setExpandedId(hs.id);
  };

  const removeHotspot = (id: string) => {
    onChange(innerHotspots.filter(h => h.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateHotspot = (id: string, patch: Partial<Hotspot>) => {
    onChange(
      innerHotspots.map(h => (h.id === id ? { ...h, ...patch } : h)),
    );
  };

  const updateArea = (id: string, areaPatch: Partial<Extract<HotspotArea, { type: 'rect' }>>) => {
    const hs = innerHotspots.find(h => h.id === id);
    if (!hs || hs.area.type !== 'rect') return;
    updateHotspot(id, { area: { ...hs.area, ...areaPatch } });
  };

  const updateAction = (id: string, action: HotspotAction) => {
    updateHotspot(id, { action });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={labelStyle}>내부 핫스팟</label>

      {innerHotspots.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8, textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 4 }}>
          내부 핫스팟이 없습니다
        </div>
      )}

      {innerHotspots.map((hs, idx) => {
        const isExpanded = expandedId === hs.id;
        const area = hs.area.type === 'rect' ? hs.area : null;

        return (
          <div
            key={hs.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              background: 'var(--bg-card)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                cursor: 'pointer',
                background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
              }}
              onClick={() => setExpandedId(isExpanded ? null : hs.id)}
            >
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                #{idx + 1} — {hs.action.type === 'word_reveal' ? '단어 획득' : hs.action.type}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    removeHotspot(hs.id);
                  }}
                  style={removeBtnStyle}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-color)' }}>
                {/* Area (rect %) */}
                {area && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>영역 (%, 이미지 기준)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {(['x', 'y', 'width', 'height'] as const).map(prop => (
                        <label key={prop} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{prop.toUpperCase()}</span>
                          <input
                            type="number"
                            value={area[prop]}
                            step={1}
                            min={0}
                            max={100}
                            onChange={e => updateArea(hs.id, { [prop]: Number(e.target.value) })}
                            style={{ width: '100%', fontSize: 11 }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Aria label */}
                <LocalizedTextInput
                  label="접근성 레이블"
                  value={hs.ariaLabel}
                  onChange={(v: LocalizedText) => updateHotspot(hs.id, { ariaLabel: v })}
                />

                {/* Action type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>액션 타입</label>
                  <select
                    value={hs.action.type}
                    onChange={e => {
                      const newType = e.target.value as HotspotAction['type'];
                      if (newType === 'word_reveal') {
                        updateAction(hs.id, { type: 'word_reveal', wordIds: [] });
                      } else if (newType === 'examine') {
                        updateAction(hs.id, { type: 'examine', content: { ko: '', en: '' } });
                      } else if (newType === 'examine_image') {
                        updateAction(hs.id, { type: 'examine_image', image: '' });
                      }
                    }}
                    style={{ width: '100%', fontSize: 11 }}
                  >
                    <option value="word_reveal">단어 획득</option>
                    <option value="examine">조사 (텍스트)</option>
                    <option value="examine_image">조사 (이미지)</option>
                  </select>
                </div>

                {/* Action-specific editor */}
                <InnerActionEditor action={hs.action} caseId={caseId} onChange={a => updateAction(hs.id, a)} />
              </div>
            )}
          </div>
        );
      })}

      {/* Add button */}
      <button
        type="button"
        onClick={addHotspot}
        style={{
          width: '100%',
          padding: '6px 0',
          fontSize: 11,
          background: 'var(--bg-secondary)',
          border: '1px dashed var(--border-color)',
          borderRadius: 4,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        + 내부 핫스팟 추가
      </button>
    </div>
  );
}

function InnerActionEditor({ action, caseId, onChange }: { action: HotspotAction; caseId: string; onChange: (a: HotspotAction) => void }): React.ReactElement | null {
  switch (action.type) {
    case 'word_reveal':
      return (
        <WordDropdown
          caseId={caseId}
          wordIds={action.wordIds}
          onChange={wordIds => onChange({ type: 'word_reveal', wordIds, feedback: action.feedback })}
          label="수집할 단어"
        />
      );
    case 'examine':
      return (
        <LocalizedTextInput
          label="내용"
          value={action.content}
          onChange={(v: LocalizedText) => onChange({ type: 'examine', content: v, title: action.title })}
          multiline
        />
      );
    case 'examine_image':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>이미지 에셋 ID</label>
          <input
            type="text"
            value={action.image}
            onChange={e => onChange({ type: 'examine_image', image: e.target.value, caption: action.caption })}
            style={{ width: '100%', fontSize: 11 }}
          />
        </div>
      );
    default:
      return null;
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: 14,
  fontWeight: 700,
  padding: '0 4px',
  lineHeight: 1,
};
