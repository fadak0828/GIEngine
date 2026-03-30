import type {
  Case,
  CaseState,
  SaveState,
  AssetManifest,
  GameEvent,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface CaseSelectRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

export class CaseSelectRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private rootEl: HTMLElement | null = null;

  constructor(opts: CaseSelectRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  render(cases: Case[], save: SaveState): void {
    this.destroy();

    const root = document.createElement('div');
    root.className = 'gi-case-select';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', this.i18n.resolveKey('ui.case_select'));

    const title = document.createElement('h1');
    title.className = 'gi-case-select-title';
    title.textContent = this.i18n.resolveKey('ui.case_select');
    root.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'gi-case-grid';

    for (const c of cases) {
      const caseState = save.caseStates[c.id];
      const card = this.createCaseCard(c, caseState);
      grid.appendChild(card);
    }

    root.appendChild(grid);
    this.rootEl = root;
    this.container.appendChild(root);
  }

  destroy(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
  }

  private createCaseCard(c: Case, caseState: CaseState | undefined): HTMLElement {
    const status = caseState?.status ?? 'locked';
    const card = document.createElement('div');
    card.className = 'gi-case-card';
    card.setAttribute('role', 'button');
    card.tabIndex = status === 'locked' ? -1 : 0;
    card.setAttribute('aria-label', this.i18n.resolveText(c.title));

    if (status === 'locked') {
      card.classList.add('gi-case-card--locked');
      card.setAttribute('aria-disabled', 'true');
    } else if (status === 'completed') {
      card.classList.add('gi-case-card--completed');
    }

    // Thumbnail
    const thumb = document.createElement('div');
    thumb.className = 'gi-case-card-thumb';
    const thumbSrc = this.resolveAssetSrc(c.thumbnail);
    if (thumbSrc) {
      const img = document.createElement('img');
      img.src = thumbSrc;
      img.alt = '';
      img.draggable = false;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      thumb.appendChild(img);
    }
    card.appendChild(thumb);

    // Body
    const body = document.createElement('div');
    body.className = 'gi-case-card-body';

    const titleEl = document.createElement('h3');
    titleEl.className = 'gi-case-card-title';
    titleEl.textContent = this.i18n.resolveText(c.title);
    body.appendChild(titleEl);

    const desc = document.createElement('p');
    desc.className = 'gi-case-card-desc';
    desc.textContent = this.i18n.resolveText(c.description);
    body.appendChild(desc);

    card.appendChild(body);

    // Badge
    if (status === 'locked') {
      const badge = document.createElement('span');
      badge.className = 'gi-case-card-badge gi-case-card-badge--locked';
      badge.textContent = this.i18n.resolveKey('ui.locked');
      card.appendChild(badge);
    } else if (status === 'completed') {
      const badge = document.createElement('span');
      badge.className = 'gi-case-card-badge gi-case-card-badge--completed';
      badge.textContent = this.i18n.resolveKey('ui.completed');
      card.appendChild(badge);
    }

    // Click handler
    if (status !== 'locked') {
      card.addEventListener('click', () => {
        this.dispatch({ type: 'SELECT_CASE', caseId: c.id });
      });
      card.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.dispatch({ type: 'SELECT_CASE', caseId: c.id });
        }
      });
    }

    return card;
  }

  private resolveAssetSrc(ref: string): string {
    const asset = this.assets.items[ref];
    if (!asset) return ref;
    if (asset.inline) return asset.inline;
    return asset.src;
  }
}
