import type { AIProvider } from './index.js';
import { GeminiProvider } from './gemini-provider.js';

const REGISTRY_KEY = 'gi_engine_ai_provider';

export type ProviderId = 'gemini';

const providers: Record<ProviderId, AIProvider> = {
  gemini: new GeminiProvider(),
};

export function getProvider(id?: ProviderId): AIProvider {
  if (id) return providers[id];
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(REGISTRY_KEY);
    if (saved && saved in providers) return providers[saved as ProviderId];
  }
  return providers.gemini;
}

export function setActiveProvider(id: ProviderId): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REGISTRY_KEY, id);
  }
}

export function listProviders(): AIProvider[] {
  return Object.values(providers);
}
