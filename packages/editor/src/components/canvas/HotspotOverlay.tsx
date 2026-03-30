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
  selectedHotspotId: string | null;
  /** Scale from scene coordinates to canvas pixels */
  scaleX: number;
  scaleY: number;
  onSelect: (id: string) => void;
  onHotspotPointerDown?: (e: React.PointerEvent<SVGRectElement>, hotspotId: string) => void;
  onResizeHandlePointerDown?: (e: React.PointerEvent<SVGRectElement>, hotspotId: string, mode: DragMode) => void;
}

export function HotspotOverlay({
  hotspots,
  selectedHotspotId,
  scaleX,
  scaleY,
  onSelect,
  onHotspotPointerDown,
  onResizeHandlePointerDown,
}: HotspotOverlayProps): React.ReactElement {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
    >
      {hotspots.map(hotspot => {
        if (hotspot.area.type !== 'rect') return null;
        const { x, y, width, height } = hotspot.area;
        const cx = x * scaleX;
        const cy = y * scaleY;
        const cw = width * scaleX;
        const ch = height * scaleY;
        const isSelected = hotspot.id === selectedHotspotId;

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
              onClick={() => onSelect(hotspot.id)}
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
      })}
    </svg>
  );
}
