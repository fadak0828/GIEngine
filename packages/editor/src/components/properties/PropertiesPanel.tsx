import React from 'react';
import { useEditorStore } from '@/store/editor-store';
import { HotspotProperties } from './HotspotProperties';
import { SceneProperties } from './SceneProperties';
import { CaseProperties } from './CaseProperties';
import { LayerProperties } from '@/components/layers/LayerProperties';

export function PropertiesPanel(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);

  // Find selected scene, hotspot, layer, and case
  let selectedScene = null;
  let selectedHotspot = null;
  let selectedLayer = null;
  let selectedCaseId: string | null = null;
  let selectedCase = null;

  if (project && selection.caseId) {
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === selection.caseId);
      if (c) {
        selectedCaseId = c.id;
        selectedCase = c;
        if (selection.sceneId) {
          selectedScene = c.scenes.find(s => s.id === selection.sceneId) ?? null;
          if (selectedScene && selection.hotspotId) {
            selectedHotspot = selectedScene.hotspots.find(h => h.id === selection.hotspotId) ?? null;
          }
          if (selectedScene && selection.layerId) {
            selectedLayer = selectedScene.layers.find(l => l.id === selection.layerId) ?? null;
          }
        }
        break;
      }
    }
  }

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      background: 'var(--bg-panel)',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        속성 패널
      </div>

      {selectedHotspot && selectedScene ? (
        <HotspotProperties hotspot={selectedHotspot} scene={selectedScene} />
      ) : selectedLayer && selectedScene && selectedCaseId ? (
        <LayerProperties layer={selectedLayer} caseId={selectedCaseId} sceneId={selectedScene.id} />
      ) : selectedScene && selectedCaseId ? (
        <SceneProperties scene={selectedScene} caseId={selectedCaseId} />
      ) : selectedCase && !selectedScene ? (
        <CaseProperties caseData={selectedCase} />
      ) : project ? (
        <EmptyProperties />
      ) : (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
          프로젝트를 열거나 새로 만드세요
        </div>
      )}
    </div>
  );
}

function EmptyProperties(): React.ReactElement {
  return (
    <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
      <div style={{ marginBottom: 8 }}>왼쪽 트리에서 씬을 선택하거나</div>
      <div>캔버스에서 핫스팟을 클릭하세요</div>
    </div>
  );
}
