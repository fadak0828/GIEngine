import React, { useState } from 'react';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { WordDropdown } from '@/components/words/WordDropdown';
import { InnerHotspotVisualEditor } from './InnerHotspotVisualEditor';
import type { Hotspot, HotspotAction, HotspotArea, LocalizedText } from '@gi-engine/core';

interface InnerHotspotEditorProps {
  caseId: string;
  imageAssetRef: string;
  innerHotspots: Hotspot[];
  onChange: (hotspots: Hotspot[]) => void;
}

let _innerCounter = 0;
function genInnerId(): string {
  _innerCounter += 1;
  return `inner_hs_${Date.now()}_${_innerCounter}`;
}

function makeDefaultInnerHotspot(area: { x: number; y: number; width: number; height: number }): Hotspot {
  return {
    id: genInnerId(),
    area: { type: 'rect', ...area },
    action: { type: 'word_reveal', wordIds: [] },
    cursor: 'pointer',
    ariaLabel: { ko: '', en: '' },
  };
}

type EditorTool = 'select' | 'draw_rect' | 'delete';

/**
 * Editor for inner hotspots within an examine_image action.
 * Inner hotspots are positioned as percentage-based overlays on the popup image.
 * Includes a visual canvas editor (drag-to-move, resize, draw) and numeric form cards.
 */
export function InnerHotspotEditor({
  caseId,
  imageAssetRef,
  innerHotspots,
  onChange,
}: InnerHotspotEditorProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>('select');

  // Expanded card in the list (synced with selectedId)
  const expandedId = selectedId;

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
  };

  const handleAddHotspot = (area: { x: number; y: number; width: number; height: number }) => {
    const hs = makeDefaultInnerHotspot(area);
    onChange([...innerHotspots, hs]);
    setSelectedId(hs.id);
    setTool('select');
  };

  const addHotspotManual = () => {
    const hs = makeDefaultInnerHotspot({ x: 10, y: 10, width: 20, height: 10 });
    onChange([...innerHotspots, hs]);
    setSelectedId(hs.id);
  };

  const removeHotspot = (id: string) => {
    onChange(innerHotspots.filter(h => h.id !== id));
    if (selectedId === id) setSelectedId(null);
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

      {/* Visual editor card */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 6,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {/* Toolbar */}
        <InnerHotspotToolbar tool={tool} onToolChange={setTool} />

        {/* Canvas */}
        <InnerHotspotVisualEditor
          innerHotspots={innerHotspots}
          imageAssetRef={imageAssetRef}
          selectedId={selectedId}
          tool={tool}
          onSelect={handleSelect}
          onChange={onChange}
          onAddHotspot={handleAddHotspot}
        />

        {/* Hint */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {tool === 'draw_rect' && '빈 영역을 드래그하여 새 핫스팟을 그립니다'}
          {tool === 'select'   && '핫스팟을 클릭하여 선택하고 드래그하여 이동합니다'}
          {tool === 'delete'   && '핫스팟을 클릭하면 즉시 삭제됩니다'}
        </div>
      </div>

      {/* List of hotspot cards */}
      {innerHotspots.length === 0 && (
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          padding: 8, textAlign: 'center',
          border: '1px dashed var(--border-color)', borderRadius: 4,
        }}>
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
              border: `1px solid ${isExpanded ? '#3b82f6' : 'var(--border-color)'}`,
              borderRadius: 4,
              background: 'var(--bg-card)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', cursor: 'pointer',
                background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
              }}
              onClick={() => setSelectedId(isExpanded ? null : hs.id)}
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
                  onClick={e => { e.stopPropagation(); removeHotspot(hs.id); }}
                  style={removeBtnStyle}
                  title="삭제"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{
                padding: 8, display: 'flex', flexDirection: 'column', gap: 8,
                borderTop: '1px solid var(--border-color)',
              }}>
                {/* Area (rect %) */}
                {area && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      영역 (%, 이미지 기준)
                    </div>
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
                <InnerActionEditor
                  action={hs.action}
                  caseId={caseId}
                  onChange={a => updateAction(hs.id, a)}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add button (manual fallback) */}
      <button
        type="button"
        onClick={addHotspotManual}
        style={{
          width: '100%', padding: '6px 0', fontSize: 11,
          background: 'var(--bg-secondary)',
          border: '1px dashed var(--border-color)',
          borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer',
        }}
      >
        + 내부 핫스팟 추가
      </button>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function InnerHotspotToolbar({
  tool,
  onToolChange,
}: {
  tool: EditorTool;
  onToolChange: (t: EditorTool) => void;
}): React.ReactElement {
  const tools: { id: EditorTool; label: string; title: string }[] = [
    { id: 'select',   label: '선택/이동', title: '핫스팟 선택 및 이동' },
    { id: 'draw_rect',label: '그리기',    title: '드래그하여 새 핫스팟 생성' },
    { id: 'delete',   label: '삭제',      title: '클릭하여 핫스팟 삭제' },
  ];

  return (
    <div style={{ display: 'flex', gap: 4, height: 28, alignItems: 'center' }}>
      {tools.map(t => (
        <button
          key={t.id}
          type="button"
          title={t.title}
          onClick={() => onToolChange(t.id)}
          style={{
            padding: '3px 8px', fontSize: 10,
            background: tool === t.id ? 'var(--accent, #d4963a)' : 'var(--bg-secondary)',
            color: tool === t.id ? '#000' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3, cursor: 'pointer', fontWeight: tool === t.id ? 600 : 400,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Inner action editor ───────────────────────────────────────────────────────

function InnerActionEditor({
  action,
  caseId,
  onChange,
}: {
  action: HotspotAction;
  caseId: string;
  onChange: (a: HotspotAction) => void;
}): React.ReactElement | null {
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

// ── Styles ────────────────────────────────────────────────────────────────────

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
