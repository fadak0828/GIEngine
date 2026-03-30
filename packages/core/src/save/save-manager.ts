import type { SaveState } from '../models/types.js';

export class SaveManager {
  private storageKey: string;

  constructor(gameId: string) {
    this.storageKey = `gi-save-${gameId}`;
  }

  /**
   * Migrate a save state loaded from storage to the current schema.
   * Returns the migrated state, or null if migration is not possible.
   */
  migrate(old: unknown): SaveState | null {
    if (!old || typeof old !== 'object') return null;
    const raw = old as Record<string, unknown>;

    // Must have at minimum gameId and caseStates
    if (typeof raw['gameId'] !== 'string') return null;
    if (typeof raw['caseStates'] !== 'object' || raw['caseStates'] === null) return null;

    // Fill in missing fields added in later versions
    if (typeof raw['currentLocale'] !== 'string') raw['currentLocale'] = 'ko';
    if (typeof raw['gameVersion'] !== 'string') raw['gameVersion'] = '0.0.0';
    if (typeof raw['savedAt'] !== 'string') raw['savedAt'] = new Date().toISOString();
    if (raw['currentPosition'] === undefined) raw['currentPosition'] = null;

    return raw as unknown as SaveState;
  }

  save(state: SaveState): void {
    try {
      const json = JSON.stringify(state);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, json);
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to save:', e);
    }
  }

  load(): SaveState | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const json = localStorage.getItem(this.storageKey);
      if (!json) return null;
      return JSON.parse(json) as SaveState;
    } catch (e) {
      console.warn('[SaveManager] Failed to load:', e);
      return null;
    }
  }

  clear(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.storageKey);
      }
    } catch (e) {
      console.warn('[SaveManager] Failed to clear:', e);
    }
  }
}
