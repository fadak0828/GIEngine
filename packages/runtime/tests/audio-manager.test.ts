/**
 * AudioManager unit tests — Phase 2 BGM system
 *
 * Tests BGM crossfade, stop fade, same-ref dedup, and mute toggle.
 * AudioContext and Web Audio API are mocked — no real audio is produced.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetManifest } from '@gi-engine/core';
import { AudioManager } from '../src/audio/audio-manager';

// ── Mock Web Audio API ───────────────────────────────────────────────────────

function makeGainNodeMock() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
}

function makeSourceNodeMock() {
  return {
    buffer: null as unknown,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

type GainMock = ReturnType<typeof makeGainNodeMock>;
type SourceMock = ReturnType<typeof makeSourceNodeMock>;

interface AudioContextMock {
  currentTime: number;
  state: string;
  resume: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  decodeAudioData: ReturnType<typeof vi.fn>;
  destination: object;
  _gainMock: GainMock;
  _sourceMock: SourceMock;
}

function makeAudioContextMock(): AudioContextMock {
  const gainMock = makeGainNodeMock();
  const sourceMock = makeSourceNodeMock();
  const fakeBuffer = {};

  return {
    currentTime: 0,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    createBufferSource: vi.fn().mockReturnValue(sourceMock),
    createGain: vi.fn().mockReturnValue(gainMock),
    createBuffer: vi.fn().mockReturnValue(fakeBuffer),
    decodeAudioData: vi.fn().mockResolvedValue(fakeBuffer),
    destination: {},
    _gainMock: gainMock,
    _sourceMock: sourceMock,
  };
}

// ── Asset helpers ────────────────────────────────────────────────────────────

const ASSET_BGM_A = 'bgm-forest';
const ASSET_BGM_B = 'bgm-town';

/** Minimal valid inline audio asset (base64 silence placeholder) */
function makeAssets(refs: string[]): AssetManifest {
  const items: AssetManifest['items'] = {};
  for (const ref of refs) {
    items[ref] = {
      id: ref,
      type: 'audio',
      src: `assets/${ref}.mp3`,
      mimeType: 'audio/mp3',
      // inline data avoids fetch(); 'AAAA' is valid base64 (3 null bytes)
      inline: 'data:audio/mp3;base64,AAAA',
    };
  }
  return { items };
}

// ── Factory: create manager with injected mock AudioContext ──────────────────

function makeUnlockedManager(assetRefs: string[]): {
  manager: AudioManager;
  ctxMock: AudioContextMock;
} {
  const manager = new AudioManager({ assets: makeAssets(assetRefs) });
  const ctxMock = makeAudioContextMock();

  // Temporarily replace global AudioContext so unlock() picks up our mock
  const origAudioContext = (globalThis as Record<string, unknown>).AudioContext;
  (globalThis as Record<string, unknown>).AudioContext = vi.fn().mockReturnValue(ctxMock);
  // unlock() sets this.audioContext = new AudioContext() synchronously before first await
  // (no await path is taken because state === 'running')
  manager.unlock();
  (globalThis as Record<string, unknown>).AudioContext = origAudioContext;

  return { manager, ctxMock };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AudioManager — BGM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('playBgm', () => {
    it('같은 assetRef 재생 중 재호출 시 재시작하지 않음 (dedup)', async () => {
      const { manager, ctxMock } = makeUnlockedManager([ASSET_BGM_A]);

      await manager.playBgm(ASSET_BGM_A);
      const firstCount = ctxMock.createBufferSource.mock.calls.length;

      // Same ref → should be no-op
      await manager.playBgm(ASSET_BGM_A);
      expect(ctxMock.createBufferSource.mock.calls.length).toBe(firstCount);
    });

    it('다른 assetRef로 전환 시 새 source 생성', async () => {
      const { manager, ctxMock } = makeUnlockedManager([ASSET_BGM_A, ASSET_BGM_B]);

      await manager.playBgm(ASSET_BGM_A);
      const firstCount = ctxMock.createBufferSource.mock.calls.length;

      await manager.playBgm(ASSET_BGM_B);
      expect(ctxMock.createBufferSource.mock.calls.length).toBeGreaterThan(firstCount);
    });

    it('새 BGM 시작 시 gain에 linearRampToValueAtTime 호출 (fade-in)', async () => {
      const { manager, ctxMock } = makeUnlockedManager([ASSET_BGM_A]);

      await manager.playBgm(ASSET_BGM_A, 1.5);

      expect(ctxMock._gainMock.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });

    it('AudioContext 미초기화(unlock 없음) 시 예외 없이 종료', async () => {
      const manager = new AudioManager({ assets: makeAssets([ASSET_BGM_A]) });
      // No unlock → audioContext is null
      await expect(manager.playBgm(ASSET_BGM_A)).resolves.toBeUndefined();
    });

    it('playBgm 성공 후 currentBgmRef 설정됨 — 즉시 재호출 방지', async () => {
      const { manager, ctxMock } = makeUnlockedManager([ASSET_BGM_A]);

      await manager.playBgm(ASSET_BGM_A);
      const countAfterFirst = ctxMock.createBufferSource.mock.calls.length;
      // Expect at least one source created
      expect(countAfterFirst).toBeGreaterThan(0);

      // Second call with same ref is a no-op
      await manager.playBgm(ASSET_BGM_A);
      expect(ctxMock.createBufferSource.mock.calls.length).toBe(countAfterFirst);
    });
  });

  describe('stopBgm', () => {
    it('BGM 없는 상태에서 호출 시 예외 없이 종료', () => {
      const manager = new AudioManager({ assets: makeAssets([]) });
      expect(() => manager.stopBgm()).not.toThrow();
    });

    it('BGM 재생 후 stopBgm 시 gain 페이드아웃 스케줄 (linearRamp)', async () => {
      const { manager, ctxMock } = makeUnlockedManager([ASSET_BGM_A]);

      await manager.playBgm(ASSET_BGM_A);
      // Reset call counts to isolate stopBgm effects
      ctxMock._gainMock.gain.linearRampToValueAtTime.mockClear();

      manager.stopBgm(0.5);

      expect(ctxMock._gainMock.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
      );
    });

    it('stopBgm 후 currentBgmRef 초기화 → 동일 BGM 재재생 가능', async () => {
      const { manager, ctxMock } = makeUnlockedManager([ASSET_BGM_A]);

      await manager.playBgm(ASSET_BGM_A);
      manager.stopBgm(0);

      const countBeforeReplay = ctxMock.createBufferSource.mock.calls.length;
      await manager.playBgm(ASSET_BGM_A);
      // After stop clears currentBgmRef, playing same ref again should create a new source
      expect(ctxMock.createBufferSource.mock.calls.length).toBeGreaterThan(countBeforeReplay);
    });
  });

  describe('toggleMute', () => {
    it('첫 호출 시 true(muted) 반환', () => {
      const manager = new AudioManager({ assets: makeAssets([]) });
      expect(manager.toggleMute()).toBe(true);
    });

    it('두 번 호출 시 false(unmuted) 반환', () => {
      const manager = new AudioManager({ assets: makeAssets([]) });
      manager.toggleMute();
      expect(manager.toggleMute()).toBe(false);
    });
  });
});
