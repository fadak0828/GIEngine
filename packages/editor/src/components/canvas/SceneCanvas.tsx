import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { HotspotOverlay } from './HotspotOverlay';
import { AIBackgroundModal } from '@/components/ai/AIBackgroundModal';
import { canvasToScene, computeScale, type CanvasRect } from '@/utils/coordinate';
import { applyDragToArea } from '@/utils/hotspot-drag';
import { useCanvasDrag, type DragMode, type DragState } from '@/hooks/useCanvasDrag';
import type { HotspotArea } from '@gi-engine/core';

export function SceneCanvas(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);
  const ui = useEditorStore(s => s.ui);
  const { setSelection, addHotspot, updateHotspotArea } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<CanvasRect | null>(null);

  // Live scale derived from canvasRectRef (updated via getBoundingClientRect)
  const [liveScale, setLiveScale] = useState({ scaleX: 1, scaleY: 1 });

  // Draw-rect tool state
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Drag preview state: which hotspot is being dragged and what its new area looks like
  const [dragPreview, setDragPreview] = useState<{ hotspotId: string; area: HotspotArea } | null>(null);

  // AI background modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // ID of the hotspot that initiated the current drag (stored in a ref to avoid stale closure)
  const dragHotspotIdRef = useRef<string | null>(null);

  // Find selected scene
  let scene = null;
  if (project && selection.caseId && selection.sceneId) {
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === selection.caseId);
      if (c) { scene = c.scenes.find(s => s.id === selection.sceneId) ?? null; break; }
    }
  }

  // ── Update canvas rect ──────────────────────────────────────────

  const updateCanvasRect = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cr: CanvasRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    canvasRectRef.current = cr;
    if (scene) {
      setLiveScale(computeScale(cr, scene.dimensions));
    }
  }, [scene]);

  useLayoutEffect(() => {
    updateCanvasRect();
    const observer = new ResizeObserver(updateCanvasRect);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateCanvasRect]);

  // ── Drag / Resize wiring via useCanvasDrag ──────────────────────

  const { startDrag } = useCanvasDrag({
    canvasRectRef,
    sceneDimensions: scene?.dimensions ?? { width: 1280, height: 720 },

    onDragMove: useCallback((dragState: DragState, mode: DragMode) => {
      const hotspotId = dragHotspotIdRef.current;
      if (!hotspotId || !scene) return;
      const hotspot = scene.hotspots.find(h => h.id === hotspotId);
      if (!hotspot) return;
      const newArea = applyDragToArea(hotspot.area, dragState, mode, scene.dimensions);
      setDragPreview({ hotspotId, area: newArea });
    }, [scene]),

    onDragEnd: useCallback((dragState: DragState, mode: DragMode) => {
      const hotspotId = dragHotspotIdRef.current;
      if (!hotspotId || !scene || !selection.caseId || !selection.sceneId) {
        setDragPreview(null);
        dragHotspotIdRef.current = null;
        return;
      }
      const hotspot = scene.hotspots.find(h => h.id === hotspotId);
      if (hotspot) {
        const finalArea = applyDragToArea(hotspot.area, dragState, mode, scene.dimensions);
        updateHotspotArea(selection.caseId, selection.sceneId, hotspotId, finalArea);
      }
      setDragPreview(null);
      dragHotspotIdRef.current = null;
    }, [scene, selection, updateHotspotArea]),
  });

  // ── Hotspot pointer handlers ────────────────────────────────────

  const handleHotspotPointerDown = useCallback((
    e: React.PointerEvent<SVGRectElement>,
    hotspotId: string,
  ) => {
    if (ui.sceneTool !== 'select') return;
    updateCanvasRect();
    dragHotspotIdRef.current = hotspotId;
    startDrag(e, 'move');
  }, [ui.sceneTool, updateCanvasRect, startDrag]);

  const handleResizeHandlePointerDown = useCallback((
    e: React.PointerEvent<SVGRectElement>,
    hotspotId: string,
    mode: DragMode,
  ) => {
    updateCanvasRect();
    dragHotspotIdRef.current = hotspotId;
    startDrag(e, mode);
  }, [updateCanvasRect, startDrag]);

  // ── Draw-rect canvas handlers ───────────────────────────────────

  const getCanvasRect = useCallback(() => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scene || !selection.caseId || !selection.sceneId) return;
    const rect = getCanvasRect();
    if (!rect) return;

    if (ui.sceneTool === 'draw_rect') {
      e.currentTarget.setPointerCapture(e.pointerId);
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const { x, y } = canvasToScene(clientX, clientY, rect, scene.dimensions);
      setDrawStart({ x, y });
      setDrawRect({ x, y, width: 0, height: 0 });
    } else if (ui.sceneTool === 'select') {
      // Click on empty space deselects hotspot
      setSelection({ hotspotId: null });
    }
  }, [scene, selection, ui.sceneTool, getCanvasRect, setSelection]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart || !scene) return;
    const rect = getCanvasRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const { x: curX, y: curY } = canvasToScene(clientX, clientY, rect, scene.dimensions);
    setDrawRect({
      x: Math.min(drawStart.x, curX),
      y: Math.min(drawStart.y, curY),
      width: Math.abs(curX - drawStart.x),
      height: Math.abs(curY - drawStart.y),
    });
  }, [drawStart, scene, getCanvasRect]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart || !drawRect || !scene || !selection.caseId || !selection.sceneId) {
      setDrawStart(null);
      setDrawRect(null);
      return;
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drawRect.width > 10 && drawRect.height > 10) {
      const area: HotspotArea = {
        type: 'rect',
        x: Math.round(drawRect.x),
        y: Math.round(drawRect.y),
        width: Math.round(drawRect.width),
        height: Math.round(drawRect.height),
      };
      addHotspot(selection.caseId, selection.sceneId, area);
    }
    setDrawStart(null);
    setDrawRect(null);
  }, [drawStart, drawRect, scene, selection, addHotspot]);

  // ── Effective hotspots (replace dragged hotspot with live preview) ──

  const effectiveHotspots = scene
    ? scene.hotspots.map(h =>
        dragPreview && h.id === dragPreview.hotspotId
          ? { ...h, area: dragPreview.area }
          : h
      )
    : [];

  const { scaleX, scaleY } = liveScale;
  const bgAsset = scene?.background && project?.assets.items[scene.background];

  if (!scene) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-muted)',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ fontSize: 40 }}>🎬</div>
        <div style={{ fontSize: 14 }}>씬을 선택하거나 사건에서 씬을 추가하세요</div>
        {!project && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>프로젝트를 먼저 열거나 새로 만드세요</div>}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div style={{
        height: 36,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>도구:</span>
        {(['select', 'draw_rect', 'delete'] as const).map(tool => (
          <button
            key={tool}
            onClick={() => useEditorStore.getState().setSceneTool(tool)}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              background: ui.sceneTool === tool ? 'var(--accent)' : 'transparent',
              color: ui.sceneTool === tool ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {tool === 'select' ? '선택' : tool === 'draw_rect' ? '핫스팟 그리기' : '삭제'}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {scene.name[ui.editorLocale]} · {scene.hotspots.length}개 핫스팟
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setAiModalOpen(true)}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 3,
            cursor: 'pointer',
          }}
          title="Gemini AI로 배경 이미지 생성"
        >
          ✨ AI 배경 생성
        </button>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 900,
            aspectRatio: `${scene.dimensions.width} / ${scene.dimensions.height}`,
            background: bgAsset ? undefined : '#1a2035',
            backgroundImage: !bgAsset ? 'repeating-conic-gradient(#1e2a4a 0% 25%, #16213e 0% 50%) 0 0 / 20px 20px' : undefined,
            cursor: ui.sceneTool === 'draw_rect' ? 'crosshair' : ui.sceneTool === 'delete' ? 'not-allowed' : 'default',
            userSelect: 'none',
            border: '1px solid var(--border-color)',
            boxSizing: 'border-box',
          }}
        >
          {bgAsset && (
            <img
              src={bgAsset.inline ? `data:${bgAsset.mimeType};base64,${bgAsset.inline}` : bgAsset.src}
              alt={bgAsset.alt?.ko ?? ''}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              draggable={false}
            />
          )}

          <HotspotOverlay
            hotspots={effectiveHotspots}
            selectedHotspotId={selection.hotspotId}
            scaleX={scaleX}
            scaleY={scaleY}
            onSelect={id => {
              if (ui.sceneTool === 'delete' && selection.caseId && selection.sceneId) {
                if (window.confirm('핫스팟을 삭제하시겠습니까?')) {
                  useEditorStore.getState().deleteHotspot(selection.caseId, selection.sceneId, id);
                }
              } else {
                setSelection({ hotspotId: id });
              }
            }}
            onHotspotPointerDown={handleHotspotPointerDown}
            onResizeHandlePointerDown={handleResizeHandlePointerDown}
          />

          {/* Drawing preview rect */}
          {drawRect && (
            <div
              style={{
                position: 'absolute',
                left: drawRect.x * scaleX,
                top: drawRect.y * scaleY,
                width: drawRect.width * scaleX,
                height: drawRect.height * scaleY,
                border: '2px dashed #f59e0b',
                background: 'rgba(245,158,11,0.15)',
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      </div>

      {/* AI Background Modal */}
      {selection.caseId && selection.sceneId && (
        <AIBackgroundModal
          open={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          sceneId={selection.sceneId}
          caseId={selection.caseId}
          hotspots={scene.hotspots}
          sceneDimensions={scene.dimensions}
        />
      )}
    </div>
  );
}
