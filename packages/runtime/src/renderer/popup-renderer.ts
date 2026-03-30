import type {
  LocalizedText,
  AssetRef,
  AssetManifest,
  GameEvent,
  Hotspot,
  CollectibleWord,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface PopupRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

export class PopupRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private overlayEl: HTMLElement | null = null;

  constructor(opts: PopupRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  showTextPopup(
    content: LocalizedText,
    title?: LocalizedText,
    highlightedWords?: string[],
    collectibleWords?: CollectibleWord[],
    collectedWordIds?: string[],
    onWordCollect?: (wordId: string) => void
  ): void {
    this.dismiss();

    const overlay = this.createOverlay();
    const popup = document.createElement('div');
    popup.className = 'gi-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');

    // Close button
    popup.appendChild(this.createCloseButton());

    // Title
    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'gi-popup-title';
      titleEl.textContent = this.i18n.resolveText(title);
      popup.appendChild(titleEl);
      popup.setAttribute('aria-label', this.i18n.resolveText(title));
    }

    // Body
    const body = document.createElement('div');
    body.className = 'gi-popup-body';

    const text = this.i18n.resolveText(content);
    if (collectibleWords && collectibleWords.length > 0 && onWordCollect) {
      body.innerHTML = this.renderCollectibleText(
        text,
        collectibleWords,
        collectedWordIds ?? [],
        highlightedWords
      );
      // Bind click handlers for collectible word buttons
      const buttons = body.querySelectorAll<HTMLButtonElement>('.gi-collectible-word');
      buttons.forEach(btn => {
        const wordId = btn.dataset.wordId;
        if (wordId && !btn.classList.contains('gi-collectible-word--collected')) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onWordCollect(wordId);
            btn.classList.add('gi-collectible-word--collected');
          });
        }
      });
    } else if (highlightedWords && highlightedWords.length > 0) {
      body.innerHTML = this.highlightText(text, highlightedWords);
    } else {
      body.textContent = text;
    }

    popup.appendChild(body);
    overlay.appendChild(popup);

    // Focus the popup
    popup.tabIndex = -1;
    requestAnimationFrame(() => popup.focus());
  }

  showImagePopup(
    image: AssetRef,
    caption?: LocalizedText,
    innerHotspots?: Hotspot[],
    onInnerHotspotClick?: (hotspotId: string) => void
  ): void {
    this.dismiss();

    const overlay = this.createOverlay();
    const popup = document.createElement('div');
    popup.className = 'gi-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-label', caption ? this.i18n.resolveText(caption) : 'Image');

    popup.appendChild(this.createCloseButton());

    // Image container (relative for inner hotspot positioning)
    const imgContainer = document.createElement('div');
    imgContainer.className = 'gi-popup-image-container';
    imgContainer.style.position = 'relative';
    imgContainer.style.display = 'inline-block';

    const src = this.resolveAssetSrc(image);
    const img = document.createElement('img');
    img.className = 'gi-popup-image';
    img.src = src;
    img.alt = caption ? this.i18n.resolveText(caption) : '';
    img.draggable = false;
    imgContainer.appendChild(img);

    // Render inner hotspots on top of the image
    if (innerHotspots && innerHotspots.length > 0 && onInnerHotspotClick) {
      for (const hs of innerHotspots) {
        const hsEl = this.createInnerHotspot(hs, onInnerHotspotClick);
        imgContainer.appendChild(hsEl);
      }
    }

    popup.appendChild(imgContainer);

    if (caption) {
      const cap = document.createElement('p');
      cap.className = 'gi-popup-caption';
      cap.textContent = this.i18n.resolveText(caption);
      popup.appendChild(cap);
    }

    overlay.appendChild(popup);

    popup.tabIndex = -1;
    requestAnimationFrame(() => popup.focus());
  }

  private createInnerHotspot(
    hotspot: Hotspot,
    onClick: (hotspotId: string) => void
  ): HTMLElement {
    const el = document.createElement('button');
    el.className = 'gi-inner-hotspot';
    el.dataset.hotspotId = hotspot.id;
    el.setAttribute('aria-label', this.i18n.resolveText(hotspot.ariaLabel));
    el.style.cursor = hotspot.cursor || 'pointer';
    el.style.position = 'absolute';
    el.tabIndex = 0;

    // Position based on area (percentage-based relative to image)
    const area = hotspot.area;
    if (area.type === 'rect') {
      el.style.left = `${area.x}%`;
      el.style.top = `${area.y}%`;
      el.style.width = `${area.width}%`;
      el.style.height = `${area.height}%`;
    } else if (area.type === 'circle') {
      const diameter = area.radius * 2;
      el.style.left = `${area.cx - area.radius}%`;
      el.style.top = `${area.cy - area.radius}%`;
      el.style.width = `${diameter}%`;
      el.style.height = `${diameter}%`;
      el.style.borderRadius = '50%';
    }

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(hotspot.id);
    });

    return el;
  }

  dismiss(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
  }

  isOpen(): boolean {
    return this.overlayEl !== null;
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'gi-overlay';

    // Click outside popup to dismiss
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.dispatch({ type: 'CLOSE_POPUP' });
      }
    });

    this.overlayEl = overlay;
    this.container.appendChild(overlay);
    return overlay;
  }

  private createCloseButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'gi-popup-close';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML = '&times;';
    btn.addEventListener('click', () => {
      this.dispatch({ type: 'CLOSE_POPUP' });
    });
    return btn;
  }

  markWordCollected(wordId: string): void {
    if (!this.overlayEl) return;
    const btn = this.overlayEl.querySelector<HTMLElement>(
      `.gi-collectible-word[data-word-id="${wordId}"]`
    );
    if (btn) {
      btn.classList.add('gi-collectible-word--collected');
    }
  }

  private renderCollectibleText(
    text: string,
    collectibleWords: CollectibleWord[],
    collectedWordIds: string[],
    highlightedWords?: string[]
  ): string {
    // First escape HTML
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply highlighted words (cosmetic only, non-interactive)
    if (highlightedWords && highlightedWords.length > 0) {
      for (const word of highlightedWords) {
        const isCollectible = collectibleWords.some(
          cw => this.i18n.resolveText(cw.textMatch) === word
        );
        if (isCollectible) continue;

        const escapedWord = word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const regex = new RegExp(`(${this.escapeRegex(escapedWord)})`, 'gi');
        escaped = escaped.replace(regex, '<span class="gi-highlighted">$1</span>');
      }
    }

    // Replace collectible word text matches with interactive buttons
    for (const cw of collectibleWords) {
      const matchText = this.i18n.resolveText(cw.textMatch);
      const escapedMatch = matchText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const isCollected = collectedWordIds.includes(cw.wordId);
      const collectedClass = isCollected ? ' gi-collectible-word--collected' : '';
      const regex = new RegExp(`(${this.escapeRegex(escapedMatch)})`, 'gi');
      escaped = escaped.replace(
        regex,
        `<button class="gi-collectible-word${collectedClass}" data-word-id="${cw.wordId}">$1</button>`
      );
    }

    return escaped;
  }

  private highlightText(text: string, words: string[]): string {
    // Escape HTML entities
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Wrap each highlighted word
    for (const word of words) {
      const escapedWord = word
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const regex = new RegExp(`(${this.escapeRegex(escapedWord)})`, 'gi');
      escaped = escaped.replace(regex, '<span class="gi-highlighted">$1</span>');
    }

    return escaped;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private resolveAssetSrc(ref: string): string {
    const asset = this.assets.items[ref];
    if (!asset) return ref;
    if (asset.inline) {
      if (asset.inline.startsWith('data:')) return asset.inline;
      const mime = asset.mimeType || 'application/octet-stream';
      return `data:${mime};base64,${asset.inline}`;
    }
    return asset.src;
  }
}
