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

    // Fill in missing top-level fields added in later versions
    if (typeof raw['currentLocale'] !== 'string') raw['currentLocale'] = 'ko';
    if (typeof raw['gameVersion'] !== 'string') raw['gameVersion'] = '0.0.0';
    if (typeof raw['savedAt'] !== 'string') raw['savedAt'] = new Date().toISOString();
    if (raw['currentPosition'] === undefined) raw['currentPosition'] = null;
    if (typeof raw['flags'] !== 'object' || raw['flags'] === null) raw['flags'] = {};

    // Fill in missing per-case fields added in later versions
    const caseStates = raw['caseStates'] as Record<string, unknown>;
    for (const caseId of Object.keys(caseStates)) {
      const cs = caseStates[caseId] as Record<string, unknown>;
      if (!Array.isArray(cs['visitedHotspotIds'])) cs['visitedHotspotIds'] = [];
      if (!Array.isArray(cs['visitedSceneIds'])) cs['visitedSceneIds'] = [];
      if (!Array.isArray(cs['collectedWordIds'])) cs['collectedWordIds'] = [];
      if (typeof cs['layerVisibility'] !== 'object' || cs['layerVisibility'] === null) {
        cs['layerVisibility'] = {};
      }
      if (typeof cs['puzzleStates'] !== 'object' || cs['puzzleStates'] === null) {
        cs['puzzleStates'] = {};
      }
    }

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
