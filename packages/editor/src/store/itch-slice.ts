import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { EditorStore } from './types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ItchCredentials {
  apiKey: string;
  username: string;
}

export interface ItchPublishConfig {
  /** "username/game-slug" format */
  pageId: string;
  title: string;
  /** comma-separated tags */
  tags: string;
  /** path to cover image (optional) */
  coverImage?: string;
}

export interface ItchState {
  credentials: ItchCredentials | null;
  publishConfig: ItchPublishConfig | null;
  /** Tracks whether user has been shown the itch.io setup prompt */
  hasPromptedSetup: boolean;
}

export type ItchSlice = {
  itch: ItchState;
  setItchCredentials: (creds: ItchCredentials | null) => void;
  setItchPublishConfig: (config: ItchPublishConfig | null) => void;
  setItchHasPromptedSetup: (v: boolean) => void;
  clearItchCredentials: () => void;
};

// ─── Default State ─────────────────────────────────────────────────────────────

const defaultItchState: ItchState = {
  credentials: null,
  publishConfig: null,
  hasPromptedSetup: false,
};

// ─── Slice Creator ─────────────────────────────────────────────────────────────

export const createItchSlice: StateCreator<EditorStore, [], [], ItchSlice> = (set) => ({
  itch: defaultItchState,

  setItchCredentials: (creds) => {
    set(state => ({
      itch: { ...state.itch, credentials: creds },
    }));
  },

  setItchPublishConfig: (config) => {
    set(state => ({
      itch: { ...state.itch, publishConfig: config },
    }));
  },

  setItchHasPromptedSetup: (v) => {
    set(state => ({
      itch: { ...state.itch, hasPromptedSetup: v },
    }));
  },

  clearItchCredentials: () => {
    set(state => ({
      itch: { ...state.itch, credentials: null },
    }));
  },
});
