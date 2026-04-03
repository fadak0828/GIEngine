import type { Word } from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface WordBankPanelRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
}

/**
 * Renders a collapsible word-bank panel during the exploring state.
 * Shows all collected words grouped by category; words already assigned
 * to a puzzle slot are rendered with the `--assigned` modifier class.
 */
export class WordBankPanelRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private rootEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private isExpanded = false;
  private previousWordIds: Set<string> = new Set();

  constructor(opts: WordBankPanelRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
  }

  render(words: Word[], assignedWordIds: Set<string>): void {
    this.destroy();

    const root = document.createElement('div');
    root.className = 'gi-word-bank-panel-wrapper';

    // Panel (initially collapsed)
    const panel = document.createElement('div');
    panel.className = 'gi-word-bank-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.style.display = 'none';
    this.buildPanelContent(panel, words, assignedWordIds);

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'gi-word-bank-panel-toggle';
    toggleBtn.setAttribute('aria-label', '수집 단어 패널 열기/닫기');
    toggleBtn.setAttribute('aria-expanded', 'false');
    this.updateToggleBtnContent(toggleBtn, words.length);

    toggleBtn.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      toggleBtn.setAttribute('aria-expanded', String(this.isExpanded));
      panel.setAttribute('aria-hidden', String(!this.isExpanded));
      panel.style.display = this.isExpanded ? '' : 'none';
    });

    root.appendChild(panel);
    root.appendChild(toggleBtn);

    this.rootEl = root;
    this.panelEl = panel;
    this.container.appendChild(root);
  }

  /**
   * Update word list in-place without destroying/recreating the wrapper.
   * Preserves the current expanded/collapsed state.
   */
  updateWords(words: Word[], assignedWordIds: Set<string>): void {
    if (!this.rootEl || !this.panelEl) return;

    const currentWordIds = new Set(words.map(w => w.id));
    const newWordIds = new Set<string>();
    for (const id of currentWordIds) {
      if (!this.previousWordIds.has(id)) {
        newWordIds.add(id);
      }
    }

    this.buildPanelContent(this.panelEl, words, assignedWordIds, newWordIds);

    this.previousWordIds = currentWordIds;

    const badge = this.rootEl.querySelector<HTMLElement>('.gi-word-bank-panel-count');
    if (badge) badge.textContent = String(words.length);
  }

  destroy(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
      this.panelEl = null;
    }
    this.isExpanded = false;
  }

  // ── private helpers ──────────────────────────────────────────────

  private updateToggleBtnContent(btn: HTMLElement, count: number): void {
    btn.innerHTML = '';

    const icon = document.createElement('span');
    icon.className = 'gi-word-bank-panel-icon';
    icon.textContent = '📖';
    btn.appendChild(icon);

    const badge = document.createElement('span');
    badge.className = 'gi-word-bank-panel-count';
    badge.textContent = String(count);
    btn.appendChild(badge);
  }

  private buildPanelContent(
    panel: HTMLElement,
    words: Word[],
    assignedWordIds: Set<string>,
    newWordIds?: Set<string>
  ): void {
    panel.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'gi-word-bank-panel-header';

    const title = document.createElement('span');
    title.className = 'gi-word-bank-panel-title';
    title.textContent = '수집한 단어';
    header.appendChild(title);

    const total = document.createElement('span');
    total.className = 'gi-word-bank-panel-total';
    total.textContent = `${words.length}개`;
    header.appendChild(total);

    panel.appendChild(header);

    if (words.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gi-word-bank-panel-empty';
      empty.textContent = '아직 수집한 단어가 없습니다';
      panel.appendChild(empty);
      return;
    }

    const grouped = this.groupByCategory(words);
    for (const [category, categoryWords] of grouped) {
      const group = document.createElement('div');
      group.className = 'gi-word-bank-panel-group';
      group.dataset.category = category;

      const catLabel = document.createElement('div');
      catLabel.className = 'gi-word-bank-panel-category';
      catLabel.textContent = this.getCategoryLabel(category);
      group.appendChild(catLabel);

      const list = document.createElement('div');
      list.className = 'gi-word-bank-panel-list';

      for (const word of categoryWords) {
        const item = document.createElement('div');
        item.className = 'gi-word-bank-panel-item';
        item.dataset.wordId = word.id;
        if (assignedWordIds.has(word.id)) {
          item.classList.add('gi-word-bank-panel-item--assigned');
        }
        if (newWordIds?.has(word.id)) {
          item.classList.add('gi-word-bank-panel-item--new');
        }
        item.textContent = this.i18n.resolveText(word.display);
        list.appendChild(item);
      }

      group.appendChild(list);
      panel.appendChild(group);
    }
  }

  private groupByCategory(words: Word[]): Map<string, Word[]> {
    const map = new Map<string, Word[]>();
    for (const word of words) {
      const cat = word.category ?? 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(word);
    }
    return map;
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      person: '인물',
      place: '장소',
      object: '사물',
      action: '행동',
      time: '시간',
      motive: '동기',
      evidence: '증거',
      other: '기타',
    };
    return labels[category] ?? category;
  }
}
