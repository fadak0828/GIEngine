import React, { useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { LocalizedTextInput } from '@/components/shared/LocalizedTextInput';
import { WordDropdown } from '@/components/words/WordDropdown';
import { SceneDropdown } from '@/components/scenes/SceneDropdown';
import { AudioAssetPicker } from '@/components/shared/AudioAssetPicker';
import { CollectibleWordsEditor } from './CollectibleWordsEditor';
import { InnerHotspotEditor } from './InnerHotspotEditor';
import { AIExamineImageModal } from '@/components/ai/AIExamineImageModal';
import type { Hotspot, HotspotAction, Scene, HotspotArea } from '@gi-engine/core';

interface HotspotPropertiesProps {
  hotspot: Hotspot;
  scene: Scene;
}

function makeDefaultAction(type: HotspotAction['type']): HotspotAction {
  switch (type) {
    case 'examine': return { type: 'examine', content: { ko: '', en: '' } };
    case 'examine_image': return { type: 'examine_image', image: '' };
    case 'word_reveal': return { type: 'word_reveal', wordIds: [] };
    case 'navigate': return { type: 'navigate', targetSceneId: '' };
    case 'toggle_layer': return { type: 'toggle_layer', layerId: '' };
    case 'composite': return { type: 'composite', actions: [] };
    case 'play_sound': return { type: 'play_sound', assetRef: '' };
    default: throw new Error(`Unknown action type: ${type as never}`);
  }
}

export function HotspotProperties({ hotspot, scene }: HotspotPropertiesProps): React.ReactElement {
  const selection = useEditorStore(s => s.selection);
  const dragPreview = useEditorStore(s => s.ui.dragPreview);
  const { updateHotspot, updateHotspotAction, setPanelWidth } = useEditorStore();

  // Auto-expand panel for complex action types
  useEffect(() => {
    const actionType = hotspot.action.type;
    if (actionType === 'examine_image' || actionType === 'composite') {
      setPanelWidth('right', 360);
    } else {
      setPanelWidth('right', 300);
    }
  }, [hotspot.action.type, setPanelWidth]);

  if (!selection.caseId || !selection.sceneId) return <div />;

  const caseId = selection.caseId;
  const sceneId = selection.sceneId;

  const updatePatch = (patch: Partial<Hotspot>) => {
    updateHotspot(caseId, sceneId, hotspot.id, patch);
  };

  const isDraggingThis = dragPreview?.hotspotId === hotspot.id;
  const displayArea: HotspotArea = isDraggingThis ? dragPreview.area : hotspot.area;
  const area = displayArea.type === 'rect' ? displayArea : null;

  return (
    <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={sectionHeader}>핫스팟 속성</div>

      {/* ID */}
      <Field label="ID">
        <input type="text" value={hotspot.id} readOnly style={{ width: '100%', opacity: 0.6 }} />
      </Field>

      {/* Area (rect) */}
      {area && (
        <div>
          <div style={labelStyle}>위치 / 크기</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2xs)' }}>
            {(['x', 'y', 'width', 'height'] as const).map(prop => (
              <label key={prop} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{prop.toUpperCase()}</span>
                <input
                  type="number"
                  value={area[prop]}
                  onChange={e => {
                    const val = Number(e.target.value);
                    updateHotspot(caseId, sceneId, hotspot.id, {
                      area: { ...area, [prop]: val },
                    });
                  }}
                  style={{ width: '100%' }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Cursor */}
      <Field label="커서">
        <select value={hotspot.cursor} onChange={e => updatePatch({ cursor: e.target.value })} style={{ width: '100%' }}>
          {['pointer', 'zoom-in', 'grab', 'crosshair', 'help', 'default'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      {/* Aria label */}
      <LocalizedTextInput
        label="접근성 레이블"
        value={hotspot.ariaLabel}
        onChange={v => updatePatch({ ariaLabel: v })}
      />

      {/* Action type selector */}
      <Field label="액션 타입">
        <select
          value={hotspot.action.type}
          onChange={e => {
            const newType = e.target.value as HotspotAction['type'];
            updateHotspotAction(caseId, sceneId, hotspot.id, makeDefaultAction(newType));
          }}
          style={{ width: '100%' }}
        >
          <option value="examine">조사 (텍스트)</option>
          <option value="examine_image">조사 (이미지)</option>
          <option value="word_reveal">단어 획득</option>
          <option value="navigate">씬 이동</option>
          <option value="toggle_layer">레이어 토글</option>
          <option value="play_sound">효과음 재생</option>
          <option value="composite">복합 액션</option>
        </select>
      </Field>

      {/* Action editor */}
      <ActionEditor
        action={hotspot.action}
        scene={scene}
        caseId={caseId}
        onChange={action => updateHotspotAction(caseId, sceneId, hotspot.id, action)}
      />
    </div>
  );
}

// ── Action editors ────────────────────────────────────────────────

interface ActionEditorProps {
  action: HotspotAction;
  scene: Scene;
  caseId: string;
  onChange: (a: HotspotAction) => void;
}

function ActionEditor({ action, scene, caseId, onChange }: ActionEditorProps): React.ReactElement {
  switch (action.type) {
    case 'examine':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <LocalizedTextInput label="내용" value={action.content} onChange={v => onChange({ ...action, content: v })} multiline />
          <LocalizedTextInput label="제목 (선택)" value={action.title ?? { ko: '', en: '' }} onChange={v => onChange({ ...action, title: v })} />
          <CollectibleWordsEditor
            caseId={caseId}
            collectibleWords={action.collectibleWords ?? []}
            onChange={collectibleWords => onChange({ ...action, collectibleWords })}
          />
        </div>
      );

    case 'examine_image':
      return (
        <ExamineImageActionEditor action={action} caseId={caseId} onChange={onChange} />
      );

    case 'word_reveal':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <WordDropdown
            caseId={caseId}
            wordIds={action.wordIds}
            onChange={wordIds => onChange({ ...action, wordIds })}
          />
          <LocalizedTextInput label="피드백 (선택)" value={action.feedback ?? { ko: '', en: '' }} onChange={v => onChange({ ...action, feedback: v })} />
        </div>
      );

    case 'navigate':
      return (
        <NavigateActionEditor
          action={action}
          caseId={caseId}
          onChange={onChange}
        />
      );

    case 'toggle_layer':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <Field label="대상 레이어">
            <select
              value={action.layerId}
              onChange={e => onChange({ ...action, layerId: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">-- 레이어 선택 --</option>
              {scene.layers.map(l => (
                <option key={l.id} value={l.id}>{l.id}</option>
              ))}
            </select>
          </Field>
          <Field label="가시성">
            <select
              value={action.visible === undefined ? 'toggle' : action.visible ? 'show' : 'hide'}
              onChange={e => {
                const val = e.target.value;
                onChange({ ...action, visible: val === 'toggle' ? undefined : val === 'show' });
              }}
              style={{ width: '100%' }}
            >
              <option value="toggle">토글</option>
              <option value="show">표시</option>
              <option value="hide">숨김</option>
            </select>
          </Field>
        </div>
      );

    case 'play_sound':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <Field label="오디오 에셋">
            <AudioAssetPicker
              assetId={action.assetRef}
              onChange={assetRef => onChange({ ...action, assetRef })}
            />
          </Field>
        </div>
      );

    case 'composite':
      return (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 'var(--space-sm)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
          복합 액션: {action.actions.length}개 하위 액션<br />
          (상세 편집은 차후 업데이트)
        </div>
      );
    default:
      throw new Error(`Unknown action type: ${(action as never)}`);
  }
}

// ── Shared UI ─────────────────────────────────────────────────────

interface NavigateActionEditorProps {
  action: Extract<HotspotAction, { type: 'navigate' }>;
  caseId: string;
  onChange: (a: HotspotAction) => void;
}

function NavigateActionEditor({ action, caseId, onChange }: NavigateActionEditorProps): React.ReactElement {
  const targetSceneExists = useEditorStore(s => {
    if (!s.project || action.targetSceneId === '') return false;

    for (const act of s.project.acts) {
      const selectedCase = act.cases.find(c => c.id === caseId);
      if (selectedCase) {
        return selectedCase.scenes.some(candidate => candidate.id === action.targetSceneId);
      }
    }

    return false;
  });

  const [targetInputMode, setTargetInputMode] = useState<'dropdown' | 'manual'>(
    action.targetSceneId !== '' && !targetSceneExists ? 'manual' : 'dropdown',
  );

  useEffect(() => {
    if (action.targetSceneId !== '' && !targetSceneExists && targetInputMode !== 'manual') {
      setTargetInputMode('manual');
    }
  }, [action.targetSceneId, targetInputMode, targetSceneExists]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <Field label="Target Input">
        <select
          value={targetInputMode}
          onChange={e => setTargetInputMode(e.target.value as 'dropdown' | 'manual')}
          style={{ width: '100%' }}
        >
          <option value="dropdown">Scene Dropdown</option>
          <option value="manual">Manual Scene ID</option>
        </select>
      </Field>

      {targetInputMode === 'dropdown' ? (
        <SceneDropdown
          caseId={caseId}
          sceneId={action.targetSceneId}
          onChange={targetSceneId => onChange({ ...action, targetSceneId })}
          label="Target Scene"
        />
      ) : (
        <Field label="Target Scene ID">
          <input
            type="text"
            value={action.targetSceneId}
            onChange={e => onChange({ ...action, targetSceneId: e.target.value })}
            style={{ width: '100%' }}
          />
        </Field>
      )}

      <Field label="전환 효과">
        <select value={action.transition ?? 'instant'} onChange={e => onChange({ ...action, transition: e.target.value as 'fade' | 'slide_left' | 'slide_right' | 'instant' })} style={{ width: '100%' }}>
          <option value="instant">즉시</option>
          <option value="fade">페이드</option>
          <option value="slide_left">왼쪽 슬라이드</option>
          <option value="slide_right">오른쪽 슬라이드</option>
        </select>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  paddingBottom: 'var(--space-sm)',
  borderBottom: '1px solid var(--border-color)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

// ── ExamineImage action editor ────────────────────────────────────

interface ExamineImageActionEditorProps {
  action: Extract<HotspotAction, { type: 'examine_image' }>;
  caseId: string;
  onChange: (a: HotspotAction) => void;
}

function ExamineImageActionEditor({ action, caseId, onChange }: ExamineImageActionEditorProps): React.ReactElement {
  const [aiModalOpen, setAiModalOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2xs)' }}>
        <label style={labelStyle}>이미지 에셋 ID</label>
        <div style={{ display: 'flex', gap: 'var(--space-2xs)' }}>
          <input
            type="text"
            value={action.image}
            onChange={e => onChange({ ...action, image: e.target.value })}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => setAiModalOpen(true)}
            title="AI로 이미지 생성"
            style={{
              padding: '0 var(--space-sm)',
              fontSize: 11,
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            AI 생성
          </button>
        </div>
      </div>
      <LocalizedTextInput
        label="캡션 (선택)"
        value={action.caption ?? { ko: '', en: '' }}
        onChange={v => onChange({ ...action, caption: v })}
      />
      <InnerHotspotEditor
        caseId={caseId}
        imageAssetRef={action.image}
        innerHotspots={action.innerHotspots ?? []}
        onChange={innerHotspots => onChange({ ...action, innerHotspots })}
      />
      <AIExamineImageModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onConfirm={assetId => onChange({ ...action, image: assetId })}
      />
    </div>
  );
}
