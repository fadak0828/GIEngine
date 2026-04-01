import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetDefinition } from '@gi-engine/core';

// ── Types ─────────────────────────────────────────────────────────

type RotationDeg = 0 | 90 | 180 | 270;

interface CropState {
  x: number; // 0–1 (relative to transformed image width)
  y: number;
  w: number;
  h: number;
}

type DragKind =
  | { type: 'none' }
  | { type: 'move'; startX: number; startY: number; startCrop: CropState }
  | {
      type: 'handle';
      handle: string;
      startX: number;
      startY: number;
      startCrop: CropState;
      aspect: number | null; // locked pixel aspect (w/h in display px)
    };

export interface ImageEditorModalProps {
  asset: AssetDefinition;
  onSave: (newBase64: string, newMimeType: string) => void;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────

function getHandlePositions(
  cx: number, cy: number, cw: number, ch: number,
): [string, number, number][] {
  return [
    ['nw', cx,        cy       ],
    ['n',  cx + cw/2, cy       ],
    ['ne', cx + cw,   cy       ],
    ['w',  cx,        cy + ch/2],
    ['e',  cx + cw,   cy + ch/2],
    ['sw', cx,        cy + ch  ],
    ['s',  cx + cw/2, cy + ch  ],
    ['se', cx + cw,   cy + ch  ],
  ];
}

function handleToCursor(handle: string): string {
  const map: Record<string, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    w: 'w-resize', e: 'e-resize',
    sw: 'sw-resize', s: 's-resize', se: 'se-resize',
  };
  return map[handle] ?? 'crosshair';
}

// ── Modal ─────────────────────────────────────────────────────────

export function ImageEditorModal({ asset, onSave, onClose }: ImageEditorModalProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imgLoaded,  setImgLoaded]  = useState(false);
  const [rotation,   setRotation]   = useState<RotationDeg>(0);
  const [flipH,      setFlipH]      = useState(false);
  const [flipV,      setFlipV]      = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast,   setContrast]   = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [crop,       setCrop]       = useState<CropState>({ x: 0, y: 0, w: 1, h: 1 });
  const [cropLocked, setCropLocked] = useState(false);
  const [drag,       setDrag]       = useState<DragKind>({ type: 'none' });
  const [canvasCursor, setCanvasCursor] = useState('crosshair');

  // Resize
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [resizeW, setResizeW]   = useState(0);
  const [resizeH, setResizeH]   = useState(0);
  const [resizeLocked, setResizeLocked] = useState(true);

  const srcUrl = asset.inline
    ? `data:${asset.mimeType};base64,${asset.inline}`
    : asset.src;

  // ── Load image ─────────────────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      setResizeW(img.naturalWidth);
      setResizeH(img.naturalHeight);
    };
    img.src = srcUrl;
  }, [srcUrl]);

  // ── Render canvas ──────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    const odd  = rotation === 90 || rotation === 270;
    const transW = odd ? srcH : srcW;
    const transH = odd ? srcW : srcH;

    // Scale to fit preview container
    const container = containerRef.current;
    const maxW = container ? container.clientWidth  - 32 : 480;
    const maxH = container ? container.clientHeight - 32 : 380;
    const scale = Math.min(maxW / transW, maxH / transH, 1);
    const dispW = Math.round(transW * scale);
    const dispH = Math.round(transH * scale);

    canvas.width  = dispW;
    canvas.height = dispH;

    // Image with transforms + filters
    ctx.save();
    ctx.filter = [
      `brightness(${1 + brightness / 100})`,
      `contrast(${1 + contrast / 100})`,
      `saturate(${1 + saturation / 100})`,
    ].join(' ');
    ctx.translate(dispW / 2, dispH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -srcW / 2 * scale, -srcH / 2 * scale, srcW * scale, srcH * scale);
    ctx.restore();

    // Crop overlay
    const cx = crop.x * dispW;
    const cy = crop.y * dispH;
    const cw = crop.w * dispW;
    const ch = crop.h * dispH;

    const fullCrop = crop.x === 0 && crop.y === 0 && crop.w === 1 && crop.h === 1;
    if (!fullCrop) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0,        0,       dispW,       cy);
      ctx.fillRect(0,        cy+ch,   dispW,       dispH - cy - ch);
      ctx.fillRect(0,        cy,      cx,          ch);
      ctx.fillRect(cx+cw,    cy,      dispW-cx-cw, ch);
      ctx.restore();
    }

    // Crop border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

    // Rule of thirds
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 1; i < 3; i++) {
      ctx.moveTo(cx + (cw * i) / 3, cy);
      ctx.lineTo(cx + (cw * i) / 3, cy + ch);
      ctx.moveTo(cx, cy + (ch * i) / 3);
      ctx.lineTo(cx + cw, cy + (ch * i) / 3);
    }
    ctx.stroke();

    // Handles
    const handles = getHandlePositions(cx, cy, cw, ch);
    ctx.fillStyle   = 'white';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1;
    for (const [, hx, hy] of handles) {
      ctx.beginPath();
      ctx.rect(hx - 4, hy - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }, [brightness, contrast, saturation, rotation, flipH, flipV, crop, imgLoaded]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ── Canvas mouse events ────────────────────────────────────────
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e);
    const dispW = canvas.width;
    const dispH = canvas.height;
    const cx = crop.x * dispW, cy = crop.y * dispH;
    const cw = crop.w * dispW, ch = crop.h * dispH;

    // Check handles first
    const handles = getHandlePositions(cx, cy, cw, ch);
    for (const [name, hx, hy] of handles) {
      if (Math.abs(x - hx) <= 6 && Math.abs(y - hy) <= 6) {
        const aspect = cropLocked ? (cw / ch) : null;
        setDrag({ type: 'handle', handle: name, startX: x, startY: y, startCrop: { ...crop }, aspect });
        return;
      }
    }
    // Inside crop → move
    if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
      setDrag({ type: 'move', startX: x, startY: y, startCrop: { ...crop } });
      return;
    }
    // Outside → new crop
    const nx = x / dispW;
    const ny = y / dispH;
    setCrop({ x: nx, y: ny, w: 0.001, h: 0.001 });
    setDrag({
      type: 'handle',
      handle: 'se',
      startX: x,
      startY: y,
      startCrop: { x: nx, y: ny, w: 0.001, h: 0.001 },
      aspect: cropLocked ? 1 : null,
    });
  }, [crop, cropLocked]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCanvasCoords(e);
    const dispW = canvas.width;
    const dispH = canvas.height;

    if (drag.type === 'none') {
      // Update cursor
      const cx = crop.x * dispW, cy = crop.y * dispH;
      const cw = crop.w * dispW, ch = crop.h * dispH;
      const handles = getHandlePositions(cx, cy, cw, ch);
      let cursor = 'crosshair';
      for (const [name, hx, hy] of handles) {
        if (Math.abs(x - hx) <= 6 && Math.abs(y - hy) <= 6) {
          cursor = handleToCursor(name);
          break;
        }
      }
      if (cursor === 'crosshair' && x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
        cursor = 'move';
      }
      setCanvasCursor(cursor);
      return;
    }

    const dx = (x - drag.startX) / dispW;
    const dy = (y - drag.startY) / dispH;
    const sc = drag.startCrop;

    if (drag.type === 'move') {
      setCrop(prev => ({
        ...prev,
        x: Math.max(0, Math.min(1 - sc.w, sc.x + dx)),
        y: Math.max(0, Math.min(1 - sc.h, sc.y + dy)),
      }));
      return;
    }

    if (drag.type === 'handle') {
      let nx = sc.x, ny = sc.y, nw = sc.w, nh = sc.h;
      const h = drag.handle;

      if (h.includes('e')) nw = Math.max(0.01, Math.min(1 - sc.x, sc.w + dx));
      if (h.includes('s')) nh = Math.max(0.01, Math.min(1 - sc.y, sc.h + dy));
      if (h.includes('w')) {
        const newX = Math.max(0, Math.min(sc.x + sc.w - 0.01, sc.x + dx));
        nw = sc.x + sc.w - newX;
        nx = newX;
      }
      if (h.includes('n')) {
        const newY = Math.max(0, Math.min(sc.y + sc.h - 0.01, sc.y + dy));
        nh = sc.y + sc.h - newY;
        ny = newY;
      }

      // Aspect ratio lock
      if (drag.aspect !== null) {
        if (h.includes('e') || h.includes('w')) {
          nh = (nw * dispW) / (drag.aspect * dispH);
          if (h.includes('n')) ny = sc.y + sc.h - nh;
        } else {
          nw = (nh * drag.aspect * dispH) / dispW;
          if (h.includes('w')) nx = sc.x + sc.w - nw;
        }
        nh = Math.min(nh, 1 - ny);
        nw = Math.min(nw, 1 - nx);
      }

      setCrop({ x: nx, y: ny, w: nw, h: nh });
    }
  }, [drag, crop]);

  const handleMouseUp = useCallback(() => {
    setDrag({ type: 'none' });
  }, []);

  // ── Rotation helpers ───────────────────────────────────────────
  const rotateCW  = () => setRotation(r => ((r + 90)  % 360) as RotationDeg);
  const rotateCCW = () => setRotation(r => ((r + 270) % 360) as RotationDeg);

  // ── Resize handlers ────────────────────────────────────────────
  const img = imgRef.current;
  const odd = rotation === 90 || rotation === 270;
  const naturalW = img ? (odd ? img.naturalHeight : img.naturalWidth)  : 0;
  const naturalH = img ? (odd ? img.naturalWidth  : img.naturalHeight) : 0;
  const aspect   = naturalH > 0 ? naturalW / naturalH : 1;

  const handleResizeW = (v: number) => {
    setResizeW(v);
    if (resizeLocked && v > 0) setResizeH(Math.round(v / aspect));
  };
  const handleResizeH = (v: number) => {
    setResizeH(v);
    if (resizeLocked && v > 0) setResizeW(Math.round(v * aspect));
  };

  // ── Apply ──────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    const srcImg = imgRef.current;
    if (!srcImg) return;

    const srcW = srcImg.naturalWidth;
    const srcH = srcImg.naturalHeight;
    const ro = rotation === 90 || rotation === 270;
    const transW = ro ? srcH : srcW;
    const transH = ro ? srcW : srcH;

    // Step 1: render full transformed image
    const tmp = document.createElement('canvas');
    tmp.width  = transW;
    tmp.height = transH;
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.translate(transW / 2, transH / 2);
    tmpCtx.rotate((rotation * Math.PI) / 180);
    tmpCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    tmpCtx.drawImage(srcImg, -srcW / 2, -srcH / 2, srcW, srcH);

    // Step 2: crop region in pixels
    const sx = Math.round(crop.x * transW);
    const sy = Math.round(crop.y * transH);
    const sw = Math.max(1, Math.round(crop.w * transW));
    const sh = Math.max(1, Math.round(crop.h * transH));

    // Step 3: output size
    const outW = resizeEnabled ? resizeW : sw;
    const outH = resizeEnabled ? resizeH : sh;

    const out = document.createElement('canvas');
    out.width  = outW;
    out.height = outH;
    const outCtx = out.getContext('2d')!;
    outCtx.filter = [
      `brightness(${1 + brightness / 100})`,
      `contrast(${1 + contrast / 100})`,
      `saturate(${1 + saturation / 100})`,
    ].join(' ');
    outCtx.drawImage(tmp, sx, sy, sw, sh, 0, 0, outW, outH);

    const dataUrl = out.toDataURL('image/png');
    const base64  = dataUrl.split(',')[1];
    onSave(base64, 'image/png');
  }, [rotation, flipH, flipV, brightness, contrast, saturation, crop, resizeEnabled, resizeW, resizeH, onSave]);

  // ── Reset helpers ──────────────────────────────────────────────
  const resetCrop    = () => setCrop({ x: 0, y: 0, w: 1, h: 1 });
  const resetAdjust  = () => { setBrightness(0); setContrast(0); setSaturation(0); };

  // ── Slider row ─────────────────────────────────────────────────
  const Slider = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <input
        type="range" min={-100} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(92vw, 900px)',
        height: 'min(90vh, 680px)',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', height: 44,
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>이미지 편집</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Canvas area */}
          <div
            ref={containerRef}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              background: '#1a1a1a',
              backgroundImage: 'repeating-conic-gradient(#222 0% 25%, #181818 0% 50%)',
              backgroundSize: '16px 16px',
              position: 'relative',
            }}
          >
            {!imgLoaded && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>이미지 로딩 중...</div>
            )}
            <canvas
              ref={canvasRef}
              style={{ cursor: canvasCursor, display: imgLoaded ? 'block' : 'none' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Controls */}
          <div style={{
            width: 232,
            flexShrink: 0,
            borderLeft: '1px solid var(--border-color)',
            overflow: 'auto',
            background: 'var(--bg-secondary)',
          }}>
            {/* Transform */}
            <SectionHeader label="변환" />
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <CtrlBtn onClick={rotateCCW} title="반시계 회전">↺ 90°</CtrlBtn>
                <CtrlBtn onClick={rotateCW}  title="시계 회전">90° ↻</CtrlBtn>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <CtrlBtn onClick={() => setFlipH(v => !v)} active={flipH} title="좌우 반전">⇄ 좌우</CtrlBtn>
                <CtrlBtn onClick={() => setFlipV(v => !v)} active={flipV} title="상하 반전">⇅ 상하</CtrlBtn>
              </div>
              {rotation !== 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>회전: {rotation}°</div>
              )}
            </div>

            {/* Color adjustment */}
            <SectionHeader label="색상 조정" />
            <div style={{ padding: '8px 12px' }}>
              <Slider label="밝기" value={brightness} onChange={setBrightness} />
              <Slider label="대비" value={contrast}   onChange={setContrast} />
              <Slider label="채도" value={saturation}  onChange={setSaturation} />
              {(brightness !== 0 || contrast !== 0 || saturation !== 0) && (
                <button onClick={resetAdjust} style={linkBtnStyle}>초기화</button>
              )}
            </div>

            {/* Crop */}
            <SectionHeader label="크롭" />
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cropLocked}
                  onChange={e => setCropLocked(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                종횡비 잠금
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {([['X', 'x'], ['Y', 'y'], ['W', 'w'], ['H', 'h']] as const).map(([lbl, field]) => {
                  const img2 = imgRef.current;
                  const od = rotation === 90 || rotation === 270;
                  const tw = img2 ? (od ? img2.naturalHeight : img2.naturalWidth) : 1;
                  const th = img2 ? (od ? img2.naturalWidth : img2.naturalHeight) : 1;
                  const dim = field === 'x' || field === 'w' ? tw : th;
                  const pxVal = Math.round(crop[field] * dim);
                  return (
                    <div key={field}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>{lbl} (px)</div>
                      <input
                        type="number" min={0}
                        value={pxVal}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value));
                          setCrop(prev => ({ ...prev, [field]: v / dim }));
                        }}
                        style={numInputStyle}
                      />
                    </div>
                  );
                })}
              </div>
              <button onClick={resetCrop} style={linkBtnStyle}>크롭 초기화</button>
            </div>

            {/* Resize */}
            <SectionHeader label="크기 조정" />
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={resizeEnabled}
                  onChange={e => setResizeEnabled(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                크기 변경 활성화
              </label>
              {resizeEnabled && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={resizeLocked}
                      onChange={e => setResizeLocked(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    비율 유지
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600 }}>W (px)</div>
                      <input type="number" min={1} value={resizeW} onChange={e => handleResizeW(Number(e.target.value))} style={numInputStyle} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, fontWeight: 600 }}>H (px)</div>
                      <input type="number" min={1} value={resizeH} onChange={e => handleResizeH(Number(e.target.value))} style={numInputStyle} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '0 16px', height: 48,
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <button onClick={onClose} style={cancelBtnStyle}>취소</button>
          <button onClick={handleApply} style={applyBtnStyle}>적용</button>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: '6px 12px',
      fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.1em',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border-color)',
      borderTop: '1px solid var(--border-color)',
    }}>
      {label}
    </div>
  );
}

function CtrlBtn({
  onClick, title, children, active = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: 1, padding: '5px 4px', fontSize: 11,
        background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-color)'}`,
        borderRadius: 3, cursor: 'pointer', fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}

const numInputStyle: React.CSSProperties = {
  width: '100%', padding: '3px 5px', fontSize: 11,
  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
  borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0,
  fontSize: 11, color: 'var(--accent)', cursor: 'pointer',
  textAlign: 'left',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 18px', fontSize: 12,
  background: 'var(--bg-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)', borderRadius: 4, cursor: 'pointer',
};

const applyBtnStyle: React.CSSProperties = {
  padding: '6px 22px', fontSize: 12, fontWeight: 600,
  background: 'var(--accent-dim)', color: 'var(--accent)',
  border: '1px solid var(--accent)', borderRadius: 4, cursor: 'pointer',
};
