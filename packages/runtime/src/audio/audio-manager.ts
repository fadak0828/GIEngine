import type { AssetManifest, AssetRef } from '@gi-engine/core';

export interface AudioManagerOptions {
  assets: AssetManifest;
}

/**
 * Audio management for sound effects and background music.
 * Handles mobile autoplay restrictions by requiring a user gesture to unlock.
 */
export class AudioManager {
  private assets: AssetManifest;
  private audioContext: AudioContext | null = null;
  private sfxCache: Map<string, AudioBuffer> = new Map();
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private currentBgmRef: string | null = null;
  private muted: boolean = false;
  private masterVolume: number = 1.0;
  private unlocked: boolean = false;

  constructor(opts: AudioManagerOptions) {
    this.assets = opts.assets;
  }

  /**
   * Must be called from a user gesture handler to unlock audio on mobile.
   */
  async unlock(): Promise<void> {
    if (this.unlocked) return;

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create a silent buffer and play it to unlock
      const silentBuffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(this.audioContext.destination);
      source.start(0);

      this.unlocked = true;
    } catch (e) {
      console.warn('[AudioManager] Failed to unlock audio:', e);
    }
  }

  async playSfx(assetRef: AssetRef): Promise<void> {
    if (this.muted || !this.audioContext) return;

    try {
      let buffer = this.sfxCache.get(assetRef);
      if (!buffer) {
        const loaded = await this.loadAudioBuffer(assetRef);
        if (!loaded) return;
        buffer = loaded;
        this.sfxCache.set(assetRef, buffer);
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = this.masterVolume;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (e) {
      console.warn('[AudioManager] Failed to play SFX:', assetRef, e);
    }
  }

  async playBgm(assetRef: AssetRef, crossfadeDuration: number = 1.0): Promise<void> {
    if (assetRef === this.currentBgmRef) return;
    if (!this.audioContext) return;

    try {
      const buffer = await this.loadAudioBuffer(assetRef);
      if (!buffer) return;

      // Crossfade: fade out current BGM
      if (this.bgmSource && this.bgmGain) {
        const oldGain = this.bgmGain;
        const oldSource = this.bgmSource;

        oldGain.gain.setValueAtTime(
          oldGain.gain.value,
          this.audioContext.currentTime
        );
        oldGain.gain.linearRampToValueAtTime(
          0,
          this.audioContext.currentTime + crossfadeDuration
        );

        setTimeout(() => {
          try {
            oldSource.stop();
          } catch {
            // Already stopped
          }
        }, crossfadeDuration * 1000);
      }

      // Create new BGM
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gainNode = this.audioContext.createGain();
      const targetVolume = this.muted ? 0 : this.masterVolume * 0.4;
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        targetVolume,
        this.audioContext.currentTime + crossfadeDuration
      );

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      source.start(0);

      this.bgmSource = source;
      this.bgmGain = gainNode;
      this.currentBgmRef = assetRef;
    } catch (e) {
      console.warn('[AudioManager] Failed to play BGM:', assetRef, e);
    }
  }

  stopBgm(fadeDuration: number = 0.5): void {
    if (!this.bgmSource || !this.bgmGain || !this.audioContext) return;

    const gain = this.bgmGain;
    const source = this.bgmSource;

    gain.gain.setValueAtTime(gain.gain.value, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(
      0,
      this.audioContext.currentTime + fadeDuration
    );

    setTimeout(() => {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }, fadeDuration * 1000);

    this.bgmSource = null;
    this.bgmGain = null;
    this.currentBgmRef = null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;

    if (this.bgmGain && this.audioContext) {
      const targetVolume = this.muted ? 0 : this.masterVolume * 0.4;
      this.bgmGain.gain.setValueAtTime(
        this.bgmGain.gain.value,
        this.audioContext.currentTime
      );
      this.bgmGain.gain.linearRampToValueAtTime(
        targetVolume,
        this.audioContext.currentTime + 0.2
      );
    }

    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));

    if (this.bgmGain && this.audioContext && !this.muted) {
      this.bgmGain.gain.setValueAtTime(
        this.bgmGain.gain.value,
        this.audioContext.currentTime
      );
      this.bgmGain.gain.linearRampToValueAtTime(
        this.masterVolume * 0.4,
        this.audioContext.currentTime + 0.1
      );
    }
  }

  destroy(): void {
    this.stopBgm(0);
    this.sfxCache.clear();

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private async loadAudioBuffer(assetRef: string): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;

    const asset = this.assets.items[assetRef];
    if (!asset) {
      console.warn('[AudioManager] Asset not found:', assetRef);
      return null;
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (asset.inline) {
        // Decode base64 data URL
        const base64 = asset.inline.split(',')[1];
        if (!base64) return null;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const response = await fetch(asset.src);
        arrayBuffer = await response.arrayBuffer();
      }

      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn('[AudioManager] Failed to load audio:', assetRef, e);
      return null;
    }
  }
}
