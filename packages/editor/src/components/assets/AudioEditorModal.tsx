import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetDefinition } from '@gi-engine/core';

// ── Helpers ───────────────────────────────────────────────────────

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

/** Encode AudioBuffer → WAV ArrayBuffer (16-bit PCM) */
function encodeWAV(buffer: AudioBuffer): ArrayBuffer {
  const numCh    = Math.min(buffer.numberOfChannels, 2);
  const rate     = buffer.sampleRate;
  const frames   = buffer.length;
  const bps      = 16;
  const blockAlign = numCh * (bps / 8);
  const dataSize   = frames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const ws = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  ws(0,  'RIFF'); view.setUint32(4,  36 + dataSize, true);
  ws(8,  'WAVE'); ws(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,  true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bps, true);
  ws(36, 'data'); view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return out;
}

// ── Props ─────────────────────────────────────────────────────────

export interface AudioEditorModalProps {
  asset: AssetDefinition;
  onSave: (newBase64: string, newMimeType: string) => void;
  onClose: () => void;
}

// ── AudioEditorModal ──────────────────────────────────────────────

export function AudioEditorModal({ asset, onSave, onClose }: AudioEditorModalProps): React.ReactElement {
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const sourceRef     = useRef<AudioBufferSourceNode | null>(null);
  const playStartRef  = useRef<number>(0); // AudioContext time at play start
  const playOffsetRef = useRef<number>(0); // seconds into clip at play start

  const [audioBuf,  setAudioBuf]  = useState<AudioBuffer | null>(null);
  const [duration,  setDuration]  = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd,   setTrimEnd]   = useState(0);
  const [volume,    setVolume]    = useState(1);      // 0–2
  const [fadeIn,    setFadeIn]    = useState(0);      // seconds
  const [fadeOut,   setFadeOut]   = useState(0);      // seconds

  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead,  setPlayhead]  = useState(0);      // seconds, for cursor

  const rafRef = useRef<number | null>(null);

  // ── Decode audio ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const decode = async () => {
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const buf = asset.inline
          ? base64ToArrayBuffer(asset.inline)
          : await fetch(asset.src).then(r => r.arrayBuffer());

        const decoded = await ctx.decodeAudioData(buf);
        if (cancelled) return;

        setAudioBuf(decoded);
        setDuration(decoded.duration);
        setTrimStart(0);
        setTrimEnd(decoded.duration);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('오디오 디코딩 실패: 지원하지 않는 형식입니다.');
          setLoading(false);
        }
      }
    };
    void decode();
    return () => { cancelled = true; };
  }, [asset]);

  // ── Draw waveform ──────────────────────────────────────────────
  const drawWaveform = useCallback(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !audioBuf) return;

    const ctx  = canvas.getContext('2d')!;
    const W    = canvas.width;
    const H    = canvas.height;
    const dur  = audioBuf.duration;
    const data = audioBuf.getChannelData(0);

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'var(--bg-primary, #151210)';
    ctx.fillRect(0, 0, W, H);

    // Trim shading (outside trim = darker)
    const ts = (trimStart / dur) * W;
    const te = (trimEnd   / dur) * W;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0,  0, ts,   H);
    ctx.fillRect(te, 0, W-te, H);

    // Waveform bars
    const samples     = data.length;
    const barCount    = Math.min(W * 2, samples);
    const samplesPerBar = samples / barCount;

    for (let i = 0; i < barCount; i++) {
      const startSample = Math.floor(i * samplesPerBar);
      const endSample   = Math.floor((i + 1) * samplesPerBar);
      let max = 0;
      for (let j = startSample; j < endSample; j++) max = Math.max(max, Math.abs(data[j]));

      const x   = (i / barCount) * W;
      const barH = max * (H / 2) * 0.9;
      const inTrim = x >= ts && x <= te;

      ctx.fillStyle = inTrim ? 'var(--accent, #d4963a)' : '#555';
      ctx.fillRect(x, H / 2 - barH, 1, barH * 2);
    }

    // Trim handles
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    // Start handle
    ctx.beginPath(); ctx.moveTo(ts, 0); ctx.lineTo(ts, H); ctx.stroke();
    // End handle
    ctx.beginPath(); ctx.moveTo(te, 0); ctx.lineTo(te, H); ctx.stroke();

    // Handle arrows
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.moveTo(ts, 10); ctx.lineTo(ts + 10, H/2); ctx.lineTo(ts, H-10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(te, 10); ctx.lineTo(te - 10, H/2); ctx.lineTo(te, H-10); ctx.fill();

    // Playhead cursor
    const ph = ((playhead - trimStart) / (trimEnd - trimStart)) * (te - ts) + ts;
    if (isPlaying && playhead >= trimStart && playhead <= trimEnd) {
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ph, 0); ctx.lineTo(ph, H); ctx.stroke();
    }

    // Time labels
    ctx.fillStyle = 'rgba(200,180,140,0.5)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText(formatTime(trimStart), ts + 4, 12);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(trimEnd), te - 4, 12);
    ctx.textAlign = 'left';
  }, [audioBuf, trimStart, trimEnd, isPlaying, playhead]);

  useEffect(() => { drawWaveform(); }, [drawWaveform]);

  // ── Waveform drag (trim handles) ───────────────────────────────
  const waveformDragRef = useRef<'start' | 'end' | null>(null);

  const getWaveTime = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    return (x / canvas.width) * (audioBuf?.duration ?? 1);
  };

  const handleWaveMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioBuf) return;
    const canvas = waveCanvasRef.current!;
    const W  = canvas.width;
    const dur = audioBuf.duration;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ts = (trimStart / dur) * W;
    const te = (trimEnd   / dur) * W;

    if (Math.abs(x - ts) < 10) waveformDragRef.current = 'start';
    else if (Math.abs(x - te) < 10) waveformDragRef.current = 'end';
    else waveformDragRef.current = null;
  };

  const handleWaveMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!waveformDragRef.current || !audioBuf) return;
    const t = getWaveTime(e);
    if (waveformDragRef.current === 'start') {
      setTrimStart(Math.max(0, Math.min(trimEnd - 0.01, t)));
    } else {
      setTrimEnd(Math.min(audioBuf.duration, Math.max(trimStart + 0.01, t)));
    }
  };

  const handleWaveMouseUp = () => { waveformDragRef.current = null; };

  // ── Playback ───────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* already stopped */ }
      sourceRef.current = null;
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setPlayhead(trimStart);
  }, [trimStart]);

  const startPlayback = useCallback(() => {
    if (!audioBuf || !audioCtxRef.current) return;
    stopPlayback();

    const ctx   = audioCtxRef.current;
    const src   = ctx.createBufferSource();
    src.buffer  = audioBuf;

    const gain  = ctx.createGain();
    gain.gain.value = volume;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + Math.min(fadeIn, trimEnd - trimStart));
    }

    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0, trimStart, trimEnd - trimStart);
    sourceRef.current  = src;
    playStartRef.current = ctx.currentTime;
    playOffsetRef.current = trimStart;

    setIsPlaying(true);

    const tick = () => {
      const elapsed = ctx.currentTime - playStartRef.current;
      const pos = playOffsetRef.current + elapsed;
      setPlayhead(pos);
      if (pos < trimEnd) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsPlaying(false);
        setPlayhead(trimStart);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    src.onended = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsPlaying(false);
      setPlayhead(trimStart);
    };
  }, [audioBuf, volume, fadeIn, trimStart, trimEnd, stopPlayback]);

  useEffect(() => () => { stopPlayback(); }, [stopPlayback]);

  // ── Apply ──────────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    if (!audioBuf) return;
    stopPlayback();

    const numCh    = audioBuf.numberOfChannels;
    const rate     = audioBuf.sampleRate;
    const trimDur  = trimEnd - trimStart;
    const frames   = Math.ceil(trimDur * rate);
    const startF   = Math.floor(trimStart * rate);

    const offline = new OfflineAudioContext(numCh, frames, rate);
    const src     = offline.createBufferSource();
    src.buffer    = audioBuf;

    const gain    = offline.createGain();
    gain.gain.value = volume;

    if (fadeIn > 0 && fadeIn < trimDur) {
      gain.gain.setValueAtTime(0, 0);
      gain.gain.linearRampToValueAtTime(volume, Math.min(fadeIn, trimDur));
    }
    if (fadeOut > 0 && fadeOut < trimDur) {
      const fo = Math.max(0, trimDur - fadeOut);
      gain.gain.setValueAtTime(volume, fo);
      gain.gain.linearRampToValueAtTime(0, trimDur);
    }

    src.connect(gain);
    gain.connect(offline.destination);
    src.start(0, trimStart, trimDur);

    void startF; // used for WAV header but not needed here
    const rendered = await offline.startRendering();
    const wavBuf   = encodeWAV(rendered);
    const base64   = arrayBufferToBase64(wavBuf);
    onSave(base64, 'audio/wav');
  }, [audioBuf, trimStart, trimEnd, volume, fadeIn, fadeOut, stopPlayback, onSave]);

  // ── Render ─────────────────────────────────────────────────────
  const trimDuration = trimEnd - trimStart;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 'min(92vw, 760px)',
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
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>오디오 편집</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              오디오 로딩 중...
            </div>
          )}
          {error && (
            <div style={{ padding: 16, color: 'var(--danger-text)', fontSize: 12, background: 'rgba(196,64,64,0.1)', borderRadius: 4 }}>
              {error}
            </div>
          )}

          {!loading && !error && audioBuf && (
            <>
              {/* Waveform */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  파형 — 핸들을 드래그해 구간을 선택하세요
                </div>
                <div style={{ borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <canvas
                    ref={waveCanvasRef}
                    width={700}
                    height={100}
                    style={{ display: 'block', width: '100%', height: 100, cursor: 'col-resize' }}
                    onMouseDown={handleWaveMouseDown}
                    onMouseMove={handleWaveMouseMove}
                    onMouseUp={handleWaveMouseUp}
                    onMouseLeave={handleWaveMouseUp}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                  <span>{formatTime(trimStart)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>구간: {formatTime(trimDuration)}</span>
                  <span>{formatTime(trimEnd)}</span>
                </div>
              </div>

              {/* Trim inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SliderRow
                  label="시작 (초)"
                  value={trimStart}
                  min={0}
                  max={trimEnd - 0.01}
                  step={0.01}
                  display={formatTime(trimStart)}
                  onChange={v => setTrimStart(v)}
                />
                <SliderRow
                  label="종료 (초)"
                  value={trimEnd}
                  min={trimStart + 0.01}
                  max={duration}
                  step={0.01}
                  display={formatTime(trimEnd)}
                  onChange={v => setTrimEnd(v)}
                />
              </div>

              {/* Volume */}
              <SliderRow
                label="볼륨"
                value={volume}
                min={0}
                max={2}
                step={0.01}
                display={`${Math.round(volume * 100)}%`}
                onChange={setVolume}
              />

              {/* Fade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SliderRow
                  label="페이드 인 (초)"
                  value={fadeIn}
                  min={0}
                  max={Math.max(0, trimDuration / 2)}
                  step={0.01}
                  display={fadeIn > 0 ? `${fadeIn.toFixed(2)}s` : '없음'}
                  onChange={setFadeIn}
                />
                <SliderRow
                  label="페이드 아웃 (초)"
                  value={fadeOut}
                  min={0}
                  max={Math.max(0, trimDuration / 2)}
                  step={0.01}
                  display={fadeOut > 0 ? `${fadeOut.toFixed(2)}s` : '없음'}
                  onChange={setFadeOut}
                />
              </div>

              {/* Playback */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={isPlaying ? stopPlayback : startPlayback}
                  style={{
                    padding: '6px 16px', fontSize: 13, fontWeight: 600,
                    background: isPlaying ? 'rgba(196,64,64,0.15)' : 'var(--accent-dim)',
                    color: isPlaying ? 'var(--danger-text)' : 'var(--accent)',
                    border: `1px solid ${isPlaying ? 'var(--danger)' : 'var(--accent)'}`,
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  {isPlaying ? '⏹ 정지' : '▶ 미리 듣기'}
                </button>
                {isPlaying && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {formatTime(playhead)}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                  원본: {formatTime(duration)} | 선택: {formatTime(trimDuration)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
          padding: '0 16px', height: 48,
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <button onClick={onClose} style={cancelBtnStyle}>취소</button>
          <button
            onClick={() => void handleApply()}
            disabled={!audioBuf}
            style={{ ...applyBtnStyle, opacity: audioBuf ? 1 : 0.5, cursor: audioBuf ? 'pointer' : 'default' }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SliderRow ─────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, display, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────

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
