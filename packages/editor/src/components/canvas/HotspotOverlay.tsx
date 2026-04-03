import React from 'react';
import type { Hotspot } from '@gi-engine/core';
import type { DragMode } from '@/hooks/useCanvasDrag';

/** Map from CSS cursor string → DragMode */
const CURSOR_TO_DRAG_MODE: Record<string, DragMode> = {
  'nw-resize': 'resize-nw',
  'n-resize': 'resize-n',
  'ne-resize': 'resize-ne',
  'e-resize': 'resize-e',
  'se-resize': 'resize-se',
  's-resize': 'resize-s',
  'sw-resize': 'resize-sw',
  'w-resize': 'resize-w',
};

interface HotspotOverlayProps {
  hotspots: Hotspot[];
  selectedHotspotIds: string[];
  /** Scale from scene coordinates to canvas pixels */
  scaleX: number;
  scaleY: number;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onHotspotPointerDown?: (e: React.PointerEvent<SVGRectElement>, hotspotId: string) => void;
  onResizeHandlePointerDown?: (e: React.PointerEvent<SVGRectElement>, hotspotId: string, mode: DragMode) => void;
  /** Called when user starts dragging a polygon vertex */
  onPolygonVertexPointerDown?: (
    e: React.PointerEvent<SVGCircleElement>,
    hotspotId: string,
    vertexIndex: number,
  ) => void;
}

export const HotspotOverlay = React.memo(function HotspotOverlay({
  hotspots,
  selectedHotspotIds,
  scaleX,
  scaleY,
  onSelect,
  onHotspotPointerDown,
  onResizeHandlePointerDown,
  onPolygonVertexPointerDown,
}: HotspotOverlayProps): React.ReactElement {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
    >
      {hotspots.map(hotspot => {
        const isSelected = selectedHotspotIds.includes(hotspot.id);
        const area = hotspot.area;

        // ── Rect hotspot ──────────────────────────────────────────
        if (area.type === 'rect') {
          const cx = area.x * scaleX;
          const cy = area.y * scaleY;
          const cw = area.width * scaleX;
          const ch = area.height * scaleY;

          return (
            <g key={hotspot.id}>
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                fill={isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.25)'}
                stroke={isSelected ? '#3b82f6' : '#f59e0b'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray={isSelected ? undefined : '4 2'}
                style={{ pointerEvents: 'all', cursor: 'move' }}
                onClick={e => onSelect(hotspot.id, e)}
                onPointerDown={onHotspotPointerDown ? e => onHotspotPointerDown(e, hotspot.id) : undefined}
              />
              {/* Resize handles on selected hotspot */}
              {isSelected && [
                { px: cx, py: cy, cursor: 'nw-resize' },
                { px: cx + cw / 2, py: cy, cursor: 'n-resize' },
                { px: cx + cw, py: cy, cursor: 'ne-resize' },
                { px: cx + cw, py: cy + ch / 2, cursor: 'e-resize' },
                { px: cx + cw, py: cy + ch, cursor: 'se-resize' },
                { px: cx + cw / 2, py: cy + ch, cursor: 's-resize' },
                { px: cx, py: cy + ch, cursor: 'sw-resize' },
                { px: cx, py: cy + ch / 2, cursor: 'w-resize' },
              ].map(({ px, py, cursor }, i) => {
                const dragMode = CURSOR_TO_DRAG_MODE[cursor];
                return (
                  <rect
                    key={i}
                    x={px - 4}
                    y={py - 4}
                    width={8}
                    height={8}
                    fill="white"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor }}
                    onPointerDown={
                      onResizeHandlePointerDown && dragMode
                        ? e => onResizeHandlePointerDown(e, hotspot.id, dragMode)
                        : undefined
                    }
                  />
                );
              })}
            </g>
          );
        }

        // ── Circle hotspot ────────────────────────────────────────
        if (area.type === 'circle') {
          const ccx = area.cx * scaleX;
          const ccy = area.cy * scaleY;
          const cr = area.radius * Math.min(scaleX, scaleY);
          return (
            <g key={hotspot.id}>
              <circle
                cx={ccx}
                cy={ccy}
                r={cr}
                fill={isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.25)'}
                stroke={isSelected ? '#3b82f6' : '#f59e0b'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray={isSelected ? undefined : '4 2'}
                style={{ pointerEvents: 'all', cursor: 'move' }}
                onClick={e => onSelect(hotspot.id, e)}
              />
            </g>
          );
        }

        // ── Polygon hotspot ───────────────────────────────────────
        if (area.type === 'polygon') {
          const svgPoints = area.points
            .map(([px, py]) => `${px * scaleX},${py * scaleY}`)
            .join(' ');

          return (
            <g key={hotspot.id}>
              <polygon
                points={svgPoints}
                fill={isSelected ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.25)'}
                stroke={isSelected ? '#3b82f6' : '#10b981'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray={isSelected ? undefined : '4 2'}
                strokeLinejoin="round"
                style={{ pointerEvents: 'all', cursor: 'move' }}
                onClick={e => onSelect(hotspot.id, e)}
              />
              {/* Vertex drag handles on selected polygon */}
              {isSelected && area.points.map(([px, py], i) => (
                <circle
                  key={i}
                  cx={px * scaleX}
                  cy={py * scaleY}
                  r={5}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  style={{ pointerEvents: 'all', cursor: 'grab' }}
                  onPointerDown={
                    onPolygonVertexPointerDown
                      ? e => onPolygonVertexPointerDown(e, hotspot.id, i)
                      : undefined
                  }
                />
              ))}
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
});
