import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import type { Hotspot } from '@gi-engine/core';

// ── Types ─────────────────────────────────────────────────────────────────────

type InnerDragMode =
  | 'move'
  | 'resize-nw' | 'resize-n' | 'resize-ne'
  | 'resize-e'  | 'resize-se'
  | 'resize-s'  | 'resize-sw' | 'resize-w';

interface RectArea {
  x: number; y: number; width: number; height: number;
}

/** Handles positioned as (dx, dy) fractions of the rect (0=left/top, 1=right/bottom) */
const HANDLES: { dx: number; dy: number; cursor: string; mode: InnerDragMode }[] = [
  { dx: 0,   dy: 0,   cursor: 'nw-resize', mode: 'resize-nw' },
  { dx: 0.5, dy: 0,   cursor: 'n-resize',  mode: 'resize-n'  },
  { dx: 1,   dy: 0,   cursor: 'ne-resize', mode: 'resize-ne' },
  { dx: 1,   dy: 0.5, cursor: 'e-resize',  mode: 'resize-e'  },
  { dx: 1,   dy: 1,   cursor: 'se-resize', mode: 'resize-se' },
  { dx: 0.5, dy: 1,   cursor: 's-resize',  mode: 'resize-s'  },
  { dx: 0,   dy: 1,   cursor: 'sw-resize', mode: 'resize-sw' },
  { dx: 0,   dy: 0.5, cursor: 'w-resize',  mode: 'resize-w'  },
];

const MIN_PCT = 2;

// ── Geometry helpers ─────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function applyDragPct(orig: RectArea, mode: InnerDragMode | 'move', dx: number, dy: number): RectArea {
  let { x, y, width, height } = orig;

  if (mode === 'move') {
    return {
      x: clamp(x + dx, 0, 100 - width),
      y: clamp(y + dy, 0, 100 - height),
      width, height,
    };
  }

  // Right edge
  if (mode === 'resize-e' || mode === 'resize-ne' || mode === 'resize-se') {
    width = clamp(width + dx, MIN_PCT, 100 - x);
  }
  // Left edge
  if (mode === 'resize-w' || mode === 'resize-nw' || mode === 'resize-sw') {
    const newX = clamp(x + dx, 0, x + width - MIN_PCT);
    width = x + width - newX;
    x = newX;
  }
  // Bottom edge
  if (mode === 'resize-s' || mode === 'resize-se' || mode === 'resize-sw') {
    height = clamp(height + dy, MIN_PCT, 100 - y);
  }
  // Top edge
  if (mode === 'resize-n' || mode === 'resize-nw' || mode === 'resize-ne') {
    const newY = clamp(y + dy, 0, y + height - MIN_PCT);
    height = y + height - newY;
    y = newY;
  }

  return { x, y, width, height };
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface InnerHotspotVisualEditorProps {
  innerHotspots: Hotspot[];
  imageAssetRef: string;
  selectedId: string | null;
  tool: 'select' | 'draw_rect' | 'delete';
  onSelect: (id: string | null) => void;
  onChange: (hotspots: Hotspot[]) => void;
  onAddHotspot: (area: RectArea) => void;
}

export function InnerHotspotVisualEditor({
  innerHotspots,
  imageAssetRef,
  selectedId,
  tool,
  onSelect,
  onChange,
  onAddHotspot,
}: InnerHotspotVisualEditorProps): React.ReactElement {
  const project = useEditorStore(s => s.project);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 180 });

  // Transient drag/draw state (overrides innerHotspots during pointer move)
  const [draftHotspots, setDraftHotspots] = useState<Hotspot[] | null>(null);
  const [drawPreview, setDrawPreview] = useState<RectArea | null>(null);

  // Stable ref for interaction session (avoids stale closures in addEventListener)
  const sessionRef = useRef<{
    type: 'move' | 'resize' | 'draw';
    hotspotId?: string;
    mode?: InnerDragMode | 'move';
    origArea?: RectArea;
    startX: number;
    startY: number;
    // snapshot of innerHotspots at drag start for applying deltas correctly
    snapshot: Hotspot[];
  } | null>(null);

  // Measure canvas container
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    obs.observe(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0) setSize({ width: r.width, height: r.height });
    return () => obs.disconnect();
  }, []);

  // Resolve image asset
  const imgAsset = imageAssetRef ? project?.assets.items[imageAssetRef] : null;
  const imgSrc = imgAsset
    ? (imgAsset.inline ? `data:${imgAsset.mimeType};base64,${imgAsset.inline}` : imgAsset.src)
    : null;

  // Client coords → percentage (0-100, clamped)
  const toPct = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  }, []);

  const displayHotspots = draftHotspots ?? innerHotspots;
  const { width: w, height: h } = size;

  // ── Hotspot body: move / delete ───────────────────────────────────────────
  const handleHotspotPointerDown = useCallback((
    e: React.PointerEvent<SVGRectElement>,
    hotspotId: string,
  ) => {
    e.stopPropagation();

    if (tool === 'delete') {
      onSelect(selectedId === hotspotId ? null : selectedId);
      onChange(innerHotspots.filter(h => h.id !== hotspotId));
      return;
    }
    if (tool !== 'select') return;

    onSelect(hotspotId);
    const hs = innerHotspots.find(h => h.id === hotspotId);
    if (!hs || hs.area.type !== 'rect') return;

    e.preventDefault();
    const start = toPct(e.clientX, e.clientY);
    const origArea: RectArea = { x: hs.area.x, y: hs.area.y, width: hs.area.width, height: hs.area.height };

    sessionRef.current = {
      type: 'move', hotspotId, mode: 'move', origArea,
      startX: start.x, startY: start.y, snapshot: innerHotspots,
    };

    const target = e.currentTarget as SVGRectElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const sess = sessionRef.current;
      if (!sess?.origArea) return;
      const cur = toPct(me.clientX, me.clientY);
      const newArea = applyDragPct(sess.origArea, 'move', cur.x - sess.startX, cur.y - sess.startY);
      setDraftHotspots(
        sess.snapshot.map(h => h.id === hotspotId ? { ...h, area: { type: 'rect', ...newArea } } : h),
      );
    };

    const onUp = (ue: PointerEvent) => {
      target.releasePointerCapture(ue.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      const sess = sessionRef.current;
      if (sess?.origArea) {
        const cur = toPct(ue.clientX, ue.clientY);
        const newArea = applyDragPct(sess.origArea, 'move', cur.x - sess.startX, cur.y - sess.startY);
        onChange(
          sess.snapshot.map(h => h.id === hotspotId ? { ...h, area: { type: 'rect', ...newArea } } : h),
        );
      }
      setDraftHotspots(null);
      sessionRef.current = null;
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [tool, innerHotspots, selectedId, onSelect, onChange, toPct]);

  // ── Resize handle ─────────────────────────────────────────────────────────
  const handleResizePointerDown = useCallback((
    e: React.PointerEvent<SVGRectElement>,
    hotspotId: string,
    mode: InnerDragMode,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const hs = innerHotspots.find(h => h.id === hotspotId);
    if (!hs || hs.area.type !== 'rect') return;

    const start = toPct(e.clientX, e.clientY);
    const origArea: RectArea = { x: hs.area.x, y: hs.area.y, width: hs.area.width, height: hs.area.height };

    sessionRef.current = {
      type: 'resize', hotspotId, mode, origArea,
      startX: start.x, startY: start.y, snapshot: innerHotspots,
    };

    const target = e.currentTarget as SVGRectElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const sess = sessionRef.current;
      if (!sess?.origArea) return;
      const cur = toPct(me.clientX, me.clientY);
      const newArea = applyDragPct(sess.origArea, mode, cur.x - sess.startX, cur.y - sess.startY);
      setDraftHotspots(
        sess.snapshot.map(h => h.id === hotspotId ? { ...h, area: { type: 'rect', ...newArea } } : h),
      );
    };

    const onUp = (ue: PointerEvent) => {
      target.releasePointerCapture(ue.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      const sess = sessionRef.current;
      if (sess?.origArea) {
        const cur = toPct(ue.clientX, ue.clientY);
        const newArea = applyDragPct(sess.origArea, mode, cur.x - sess.startX, cur.y - sess.startY);
        onChange(
          sess.snapshot.map(h => h.id === hotspotId ? { ...h, area: { type: 'rect', ...newArea } } : h),
        );
      }
      setDraftHotspots(null);
      sessionRef.current = null;
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [innerHotspots, onChange, toPct]);

  // ── Canvas background: draw_rect / deselect ───────────────────────────────
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (tool === 'select') {
      onSelect(null);
      return;
    }
    if (tool !== 'draw_rect') return;

    e.preventDefault();
    const start = toPct(e.clientX, e.clientY);
    sessionRef.current = {
      type: 'draw',
      startX: start.x, startY: start.y,
      snapshot: innerHotspots,
    };

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (me: PointerEvent) => {
      const sess = sessionRef.current;
      if (!sess) return;
      const cur = toPct(me.clientX, me.clientY);
      setDrawPreview({
        x: Math.min(sess.startX, cur.x),
        y: Math.min(sess.startY, cur.y),
        width: Math.abs(cur.x - sess.startX),
        height: Math.abs(cur.y - sess.startY),
      });
    };

    const onUp = (ue: PointerEvent) => {
      target.releasePointerCapture(ue.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      const sess = sessionRef.current;
      if (sess) {
        const cur = toPct(ue.clientX, ue.clientY);
        const area: RectArea = {
          x: Math.min(sess.startX, cur.x),
          y: Math.min(sess.startY, cur.y),
          width: Math.abs(cur.x - sess.startX),
          height: Math.abs(cur.y - sess.startY),
        };
        if (area.width >= MIN_PCT && area.height >= MIN_PCT) {
          onAddHotspot(area);
        }
      }
      setDrawPreview(null);
      sessionRef.current = null;
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [tool, innerHotspots, onSelect, onAddHotspot, toPct]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<SVGRectElement>, hotspotId: string) => {
    if (e.key === 'Enter') {
      onSelect(hotspotId);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(innerHotspots.filter(h => h.id !== hotspotId));
      if (selectedId === hotspotId) onSelect(null);
    }
  }, [innerHotspots, selectedId, onSelect, onChange]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handleCanvasPointerDown}
      style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        minHeight: 180,
        background: imgSrc ? undefined : '#16213e',
        backgroundImage: imgSrc
          ? undefined
          : 'repeating-conic-gradient(#1e2a4a 0% 25%, #16213e 0% 50%) 0 0 / 16px 16px',
        border: '1px solid var(--border-color)',
        borderRadius: 4,
        overflow: 'hidden',
        cursor: tool === 'draw_rect' ? 'crosshair' : tool === 'delete' ? 'not-allowed' : 'default',
        userSelect: 'none',
      }}
    >
      {/* Image or placeholder */}
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain', display: 'block',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: 'var(--text-muted)',
          textAlign: 'center', padding: 8,
          pointerEvents: 'none',
        }}>
          이미지 에셋을 선택하면<br />내부 핫스팟을 시각적으로 편집할 수 있습니다.
        </div>
      )}

      {/* SVG overlay */}
      <svg style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}>
        {displayHotspots.map((hs, idx) => {
          if (hs.area.type !== 'rect') return null;
          const area = hs.area;
          const px = (area.x / 100) * w;
          const py = (area.y / 100) * h;
          const pw = (area.width / 100) * w;
          const ph = (area.height / 100) * h;
          const isSelected = hs.id === selectedId;

          return (
            <g key={hs.id}>
              <rect
                x={px} y={py} width={pw} height={ph}
                fill={isSelected ? 'rgba(59,130,246,0.25)' : 'rgba(212,150,58,0.20)'}
                stroke={isSelected ? '#3b82f6' : '#d4963a'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray={isSelected ? undefined : '4 2'}
                style={{
                  pointerEvents: 'all',
                  cursor: tool === 'delete' ? 'not-allowed' : isSelected ? 'move' : 'pointer',
                }}
                onPointerDown={e => handleHotspotPointerDown(e, hs.id)}
                onKeyDown={e => handleKeyDown(e, hs.id)}
                tabIndex={0}
                role="button"
                aria-label={hs.ariaLabel?.ko || `내부 핫스팟 ${idx + 1}`}
              />
              {/* Resize handles — selected rect only */}
              {isSelected && tool === 'select' && HANDLES.map(({ dx, dy, cursor, mode }) => (
                <rect
                  key={cursor}
                  x={px + dx * pw - 4}
                  y={py + dy * ph - 4}
                  width={8}
                  height={8}
                  fill="white"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  style={{ pointerEvents: 'all', cursor }}
                  onPointerDown={e => handleResizePointerDown(e, hs.id, mode)}
                />
              ))}
            </g>
          );
        })}

        {/* Draw preview */}
        {drawPreview && (
          <rect
            x={(drawPreview.x / 100) * w}
            y={(drawPreview.y / 100) * h}
            width={(drawPreview.width / 100) * w}
            height={(drawPreview.height / 100) * h}
            fill="rgba(212,150,58,0.20)"
            stroke="#d4963a"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </svg>
    </div>
  );
}
