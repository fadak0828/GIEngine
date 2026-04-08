import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { HotspotOverlay } from './HotspotOverlay';
import { AIBackgroundModal } from '@/components/ai/AIBackgroundModal';
import { canvasToScene, computeScale, type CanvasRect } from '@/utils/coordinate';
import { applyDragToArea } from '@/utils/hotspot-drag';
import { useCanvasDrag, type DragMode, type DragState } from '@/hooks/useCanvasDrag';
import type { HotspotArea, Hotspot } from '@gi-engine/core';
import { genId } from '@/store/utils';

export function SceneCanvas(): React.ReactElement {
  const project = useEditorStore(s => s.project);
  const selection = useEditorStore(s => s.selection);
  const ui = useEditorStore(s => s.ui);
  const dragPreview = ui.dragPreview;
  const { setSelection, addHotspot, updateHotspotArea, setDragPreview } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<CanvasRect | null>(null);

  const [liveScale, setLiveScale] = useState({ scaleX: 1, scaleY: 1 });
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // draw_polygon tool state
  const [polyVertices, setPolyVertices] = useState<[number, number][]>([]);
  const [polyCursor, setPolyCursor] = useState<{ x: number; y: number } | null>(null);

  const [ghostArea, setGhostArea] = useState<{ hotspotId: string; area: HotspotArea } | null>(null);

  // polygon vertex drag state
  const [polyVertexDrag, setPolyVertexDrag] = useState<{ hotspotId: string; vertexIndex: number } | null>(null);
  const polyVertexStartRef = useRef<{ clientX: number; clientY: number; origPoints: [number, number][] } | null>(null);

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const dragHotspotIdRef = useRef<string | null>(null);

  // Hotspot clipboard for copy/paste
  const hotspotClipboardRef = useRef<Hotspot[]>([]);

  // Track shift key for temporarily disabling grid snap
  const shiftKeyRef = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftKeyRef.current = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftKeyRef.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  const scene = useMemo(() => {
    if (!project || !selection.caseId || !selection.sceneId) return null;
    for (const act of project.acts) {
      const c = act.cases.find(cs => cs.id === selection.caseId);
      if (c) return c.scenes.find(s => s.id === selection.sceneId) ?? null;
    }
    return null;
  }, [project, selection.caseId, selection.sceneId]);

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

  // Keyboard shortcuts for hotspot copy/paste
  useEffect(() => {
    if (!scene || !selection.caseId || !selection.sceneId) return;
    const caseId = selection.caseId;
    const sceneId = selection.sceneId;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const { hotspotIds } = useEditorStore.getState().selection;
        if (hotspotIds.length > 0) {
          const selectedHotspots = scene.hotspots.filter(h => hotspotIds.includes(h.id));
          hotspotClipboardRef.current = selectedHotspots.map(h => ({ ...h, id: genId('hotspot') }));
          useEditorStore.getState().showNotification(`${selectedHotspots.length}개 핫스팟 복사됨`, 'success');
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const clipboard = hotspotClipboardRef.current;
        if (clipboard.length > 0) {
          const offset = 20;
          clipboard.forEach(hotspot => {
            let newArea: HotspotArea;
            if (hotspot.area.type === 'rect') {
              newArea = {
                type: 'rect',
                x: hotspot.area.x + offset,
                y: hotspot.area.y + offset,
                width: hotspot.area.width,
                height: hotspot.area.height,
              };
            } else if (hotspot.area.type === 'circle') {
              newArea = {
                type: 'circle',
                cx: hotspot.area.cx + offset,
                cy: hotspot.area.cy + offset,
                radius: hotspot.area.radius,
              };
            } else if (hotspot.area.type === 'polygon') {
              newArea = {
                type: 'polygon',
                points: hotspot.area.points.map(([px, py]) => [px + offset, py + offset] as [number, number]),
              };
            } else {
              return;
            }
            addHotspot(caseId, sceneId, newArea);
          });
          useEditorStore.getState().showNotification(`${clipboard.length}개 핫스팟 붙여넣기 완료`, 'success');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scene, selection.caseId, selection.sceneId, addHotspot]);

  const { startDrag } = useCanvasDrag({
    canvasRectRef,
    sceneDimensions: scene?.dimensions ?? { width: 1280, height: 720 },

    onDragStart: useCallback((_sceneX: number, _sceneY: number, _mode: DragMode) => {
      const hotspotId = dragHotspotIdRef.current;
      if (!hotspotId || !scene) return;
      const hotspot = scene.hotspots.find(h => h.id === hotspotId);
      if (hotspot) {
        setGhostArea({ hotspotId, area: hotspot.area });
      }
    }, [scene]),

    onDragMove: useCallback((dragState: DragState, mode: DragMode) => {
      const hotspotId = dragHotspotIdRef.current;
      if (!hotspotId || !scene) return;
      const hotspot = scene.hotspots.find(h => h.id === hotspotId);
      if (!hotspot) return;
      const gridSnap = { enabled: ui.gridSnapEnabled, gridSize: ui.gridSize, shiftHeld: shiftKeyRef.current };
      const newArea = applyDragToArea(hotspot.area, dragState, mode, scene.dimensions, gridSnap);
      setDragPreview({ hotspotId, area: newArea });
    }, [scene, ui.gridSnapEnabled, ui.gridSize, setDragPreview]),

    onDragEnd: useCallback((dragState: DragState, mode: DragMode) => {
      const hotspotId = dragHotspotIdRef.current;
      if (!hotspotId || !scene || !selection.caseId || !selection.sceneId) {
        setDragPreview(null);
        setGhostArea(null);
        dragHotspotIdRef.current = null;
        return;
      }
      const hotspot = scene.hotspots.find(h => h.id === hotspotId);
      if (hotspot) {
        const gridSnap = { enabled: ui.gridSnapEnabled, gridSize: ui.gridSize, shiftHeld: shiftKeyRef.current };
        const finalArea = applyDragToArea(hotspot.area, dragState, mode, scene.dimensions, gridSnap);
        updateHotspotArea(selection.caseId, selection.sceneId, hotspotId, finalArea);
      }
      setDragPreview(null);
      setGhostArea(null);
      dragHotspotIdRef.current = null;
    }, [scene, selection, updateHotspotArea, ui.gridSnapEnabled, ui.gridSize, setDragPreview]),
  });

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

  // Polygon vertex drag handlers
  const handlePolygonVertexPointerDown = useCallback((
    e: React.PointerEvent<SVGCircleElement>,
    hotspotId: string,
    vertexIndex: number,
  ) => {
    if (!scene) return;
    e.stopPropagation();
    const hotspot = scene.hotspots.find(h => h.id === hotspotId);
    if (!hotspot || hotspot.area.type !== 'polygon') return;
    setPolyVertexDrag({ hotspotId, vertexIndex });
    polyVertexStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origPoints: hotspot.area.points.map(p => [p[0], p[1]] as [number, number]),
    };
    (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
  }, [scene]);

  const handleSVGPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!polyVertexDrag || !polyVertexStartRef.current || !scene || !selection.caseId || !selection.sceneId) return;
    const rect = canvasRectRef.current;
    if (!rect) return;
    const scale = computeScale(rect, scene.dimensions);
    const dx = (e.clientX - polyVertexStartRef.current.clientX) / scale.scaleX;
    const dy = (e.clientY - polyVertexStartRef.current.clientY) / scale.scaleY;
    const newPoints: [number, number][] = polyVertexStartRef.current.origPoints.map((pt, i) => {
      if (i === polyVertexDrag.vertexIndex) {
        return [
          Math.max(0, Math.min(scene.dimensions.width, pt[0] + dx)),
          Math.max(0, Math.min(scene.dimensions.height, pt[1] + dy)),
        ];
      }
      return pt;
    });
    setDragPreview({ hotspotId: polyVertexDrag.hotspotId, area: { type: 'polygon', points: newPoints } });
  }, [polyVertexDrag, scene, selection, setDragPreview]);

  const handleSVGPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!polyVertexDrag || !polyVertexStartRef.current || !scene || !selection.caseId || !selection.sceneId) {
      setPolyVertexDrag(null); polyVertexStartRef.current = null; setDragPreview(null); return;
    }
    const rect = canvasRectRef.current;
    if (!rect) { setPolyVertexDrag(null); polyVertexStartRef.current = null; setDragPreview(null); return; }
    const scale = computeScale(rect, scene.dimensions);
    const dx = (e.clientX - polyVertexStartRef.current.clientX) / scale.scaleX;
    const dy = (e.clientY - polyVertexStartRef.current.clientY) / scale.scaleY;
    const newPoints: [number, number][] = polyVertexStartRef.current.origPoints.map((pt, i) => {
      if (i === polyVertexDrag.vertexIndex) {
        return [
          Math.max(0, Math.min(scene.dimensions.width, pt[0] + dx)),
          Math.max(0, Math.min(scene.dimensions.height, pt[1] + dy)),
        ];
      }
      return pt;
    });
    updateHotspotArea(selection.caseId, selection.sceneId, polyVertexDrag.hotspotId, { type: 'polygon', points: newPoints });
    setPolyVertexDrag(null); polyVertexStartRef.current = null; setDragPreview(null);
  }, [polyVertexDrag, scene, selection, updateHotspotArea, setDragPreview]);

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
      setSelection({ hotspotId: null });
    }
  }, [scene, selection, ui.sceneTool, getCanvasRect, setSelection]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!scene) return;
    const rect = getCanvasRect();
    if (!rect) return;
    if (drawStart) {
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const { x: curX, y: curY } = canvasToScene(clientX, clientY, rect, scene.dimensions);
      setDrawRect({
        x: Math.min(drawStart.x, curX), y: Math.min(drawStart.y, curY),
        width: Math.abs(curX - drawStart.x), height: Math.abs(curY - drawStart.y),
      });
    }
    if (ui.sceneTool === 'draw_polygon' && polyVertices.length > 0) {
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const { x, y } = canvasToScene(clientX, clientY, rect, scene.dimensions);
      setPolyCursor({ x, y });
    }
  }, [drawStart, scene, ui.sceneTool, polyVertices.length, getCanvasRect]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart || !drawRect || !scene || !selection.caseId || !selection.sceneId) {
      setDrawStart(null); setDrawRect(null); return;
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drawRect.width > 10 && drawRect.height > 10) {
      const area: HotspotArea = {
        type: 'rect',
        x: Math.round(drawRect.x), y: Math.round(drawRect.y),
        width: Math.round(drawRect.width), height: Math.round(drawRect.height),
      };
      addHotspot(selection.caseId, selection.sceneId, area);
    }
    setDrawStart(null); setDrawRect(null);
  }, [drawStart, drawRect, scene, selection, addHotspot]);

  const lastClickTimeRef = useRef(0);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (ui.sceneTool !== 'draw_polygon' || !scene || !selection.caseId || !selection.sceneId) return;
    const rect = getCanvasRect();
    if (!rect) return;
    const now = Date.now();
    const isDoubleClick = now - lastClickTimeRef.current < 350;
    lastClickTimeRef.current = now;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const { x, y } = canvasToScene(clientX, clientY, rect, scene.dimensions);
    if (isDoubleClick && polyVertices.length >= 2) {
      const vertices = polyVertices.slice(0, -1);
      if (vertices.length >= 3) {
        const area: HotspotArea = {
          type: 'polygon',
          points: vertices.map(([vx, vy]) => [Math.round(vx), Math.round(vy)] as [number, number]),
        };
        addHotspot(selection.caseId, selection.sceneId, area);
      }
      setPolyVertices([]); setPolyCursor(null);
    } else {
      setPolyVertices(prev => [...prev, [x, y] as [number, number]]);
    }
  }, [ui.sceneTool, scene, selection, polyVertices, getCanvasRect, addHotspot]);

  const effectiveHotspots = scene
    ? scene.hotspots.map(h =>
        dragPreview && h.id === dragPreview.hotspotId ? { ...h, area: dragPreview.area } : h
      )
    : [];

  const { scaleX, scaleY } = liveScale;
  const bgAsset = scene?.background && project?.assets.items[scene.background];

  if (!scene) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', color: 'var(--text-muted)', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 40 }}>🎬</div>
        <div style={{ fontSize: 14 }}>씬을 선택하거나 사건에서 씬을 추가하세요</div>
        {!project && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>프로젝트를 먼저 열거나 새로 만드세요</div>}
      </div>
    );
  }

  const polyInProgress = polyVertices.length > 0;
  const polyPreviewPoints: [number, number][] = polyCursor
    ? [...polyVertices, [polyCursor.x, polyCursor.y]]
    : polyVertices;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div style={{
        height: 36, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', padding: '0 8px', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>도구:</span>
        {(['select', 'draw_rect', 'draw_polygon', 'delete'] as const).map(tool => (
          <button
            key={tool}
            onClick={() => {
              useEditorStore.getState().setSceneTool(tool);
              if (tool !== 'draw_polygon') { setPolyVertices([]); setPolyCursor(null); }
            }}
            style={{
              padding: '3px 8px', fontSize: 11,
              background: ui.sceneTool === tool ? 'var(--accent)' : 'transparent',
              color: ui.sceneTool === tool ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 3, cursor: 'pointer',
            }}
          >
            {tool === 'select' ? '선택' : tool === 'draw_rect' ? '사각 핫스팟' : tool === 'draw_polygon' ? '다각형 핫스팟' : '삭제'}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--border-color)', margin: '0 4px' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {scene.name[ui.editorLocale]} · {scene.hotspots.length}개 핫스팟
        </span>
        {polyInProgress && (
          <span style={{ fontSize: 11, color: '#10b981' }}>
            다각형 그리기 중 ({polyVertices.length}개 꼭짓점) — 더블클릭으로 완성
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => useEditorStore.getState().toggleGridSnap()}
          style={{
            padding: '3px 8px', fontSize: 11,
            background: ui.gridSnapEnabled ? 'var(--accent)' : 'transparent',
            color: ui.gridSnapEnabled ? '#000' : 'var(--text-secondary)',
            border: '1px solid var(--border-color)', borderRadius: 3, cursor: 'pointer',
          }}
          title={`그리드 스냅 ${ui.gridSnapEnabled ? '켜짐' : '꺼짐'} (10px)`}
        >
          ⊞ 스냅{ui.gridSnapEnabled ? ' ON' : ' OFF'}
        </button>
        <button
          onClick={() => setAiModalOpen(true)}
          style={{
            padding: '3px 10px', fontSize: 11, background: 'transparent',
            color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 3, cursor: 'pointer',
          }}
          title='Gemini AI로 배경 이미지 생성'
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
          onClick={handleCanvasClick}
          style={{
            position: 'relative', width: '100%', maxWidth: 900,
            aspectRatio: `${scene.dimensions.width} / ${scene.dimensions.height}`,
            background: bgAsset ? undefined : '#1a2035',
            backgroundImage: !bgAsset ? 'repeating-conic-gradient(#1e2a4a 0% 25%, #16213e 0% 50%) 0 0 / 20px 20px' : undefined,
            cursor: ui.sceneTool === 'draw_rect' || ui.sceneTool === 'draw_polygon' ? 'crosshair'
              : ui.sceneTool === 'delete' ? 'not-allowed' : 'default',
            userSelect: 'none', border: '1px solid var(--border-color)', boxSizing: 'border-box',
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
            selectedHotspotIds={selection.hotspotIds}
            scaleX={scaleX}
            scaleY={scaleY}
            ghostArea={ghostArea}
            dragPreview={dragPreview}
            onSelect={(id, e) => {
              if (ui.sceneTool === 'delete' && selection.caseId && selection.sceneId) {
                if (window.confirm('핫스팟을 삭제하시겠습니까?')) {
                  useEditorStore.getState().deleteHotspot(selection.caseId, selection.sceneId, id);
                }
              } else if (e.ctrlKey || e.metaKey) {
                const { hotspotIds } = useEditorStore.getState().selection;
                if (hotspotIds.includes(id)) {
                  useEditorStore.getState().removeFromHotspotSelection(id);
                } else {
                  useEditorStore.getState().addToHotspotSelection(id);
                }
              } else {
                setSelection({ hotspotId: id, hotspotIds: [id] });
              }
            }}
            onHotspotPointerDown={handleHotspotPointerDown}
            onResizeHandlePointerDown={handleResizeHandlePointerDown}
            onPolygonVertexPointerDown={handlePolygonVertexPointerDown}
          />

          {drawRect && (
            <div style={{
              position: 'absolute',
              left: drawRect.x * scaleX, top: drawRect.y * scaleY,
              width: drawRect.width * scaleX, height: drawRect.height * scaleY,
              border: '2px dashed #f59e0b', background: 'rgba(245,158,11,0.15)',
              pointerEvents: 'none', boxSizing: 'border-box',
            }} />
          )}

          {/* Polygon in-progress SVG */}
          {polyInProgress && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              {polyPreviewPoints.length >= 2 && (
                <polyline
                  points={polyPreviewPoints.map(([px, py]) => `${px * scaleX},${py * scaleY}`).join(' ')}
                  fill='none' stroke='#10b981' strokeWidth={1.5} strokeDasharray='4 2' strokeLinejoin='round'
                />
              )}
              {polyPreviewPoints.length >= 3 && polyCursor && (
                <line
                  x1={polyPreviewPoints[polyPreviewPoints.length - 1][0] * scaleX}
                  y1={polyPreviewPoints[polyPreviewPoints.length - 1][1] * scaleY}
                  x2={polyPreviewPoints[0][0] * scaleX}
                  y2={polyPreviewPoints[0][1] * scaleY}
                  stroke='#10b981' strokeWidth={1} strokeDasharray='2 4' opacity={0.5}
                />
              )}
              {polyVertices.map(([px, py], i) => (
                <circle key={i} cx={px * scaleX} cy={py * scaleY} r={4}
                  fill={i === 0 ? '#10b981' : 'white'} stroke='#10b981' strokeWidth={1.5} />
              ))}
            </svg>
          )}

          {/* Polygon vertex drag overlay */}
          {polyVertexDrag && (
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'all', overflow: 'visible' }}
              onPointerMove={handleSVGPointerMove}
              onPointerUp={handleSVGPointerUp}
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