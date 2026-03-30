import type {
  SubPuzzle,
  CharacterIdPuzzle,
  TimelinePuzzle,
  RelationshipPuzzle,
  ScenarioPuzzle,
  PuzzleState,
  Word,
  ValidationResult,
  AssetManifest,
  GameEvent,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface SubPuzzleRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

/**
 * Renders sub-puzzle types (character_id, timeline, relationship, scenario)
 * inside the puzzle overlay.
 */
export class SubPuzzleRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private rootEl: HTMLElement | null = null;
  private slotElements: Map<string, HTMLElement> = new Map();
  private wordElements: Map<string, HTMLElement> = new Map();

  constructor(opts: SubPuzzleRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  render(
    puzzle: SubPuzzle,
    puzzleState: PuzzleState,
    collectedWords: Word[],
    assignedWordIds: Set<string>
  ): void {
    this.destroy();

    const root = document.createElement('div');
    root.className = 'gi-sub-puzzle';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', this.i18n.resolveText(puzzle.title));

    // Title
    const header = document.createElement('div');
    header.className = 'gi-sub-puzzle-header';
    const title = document.createElement('h3');
    title.textContent = this.i18n.resolveText(puzzle.title);
    header.appendChild(title);
    root.appendChild(header);

    // Content area — type-specific
    switch (puzzle.type) {
      case 'character_id':
        root.appendChild(this.renderCharacterId(puzzle, puzzleState, collectedWords));
        break;
      case 'timeline':
        root.appendChild(this.renderTimeline(puzzle, puzzleState, collectedWords));
        break;
      case 'relationship':
        root.appendChild(this.renderRelationship(puzzle, puzzleState, collectedWords));
        break;
      case 'scenario':
        root.appendChild(this.renderScenario(puzzle, puzzleState, collectedWords));
        break;
    }

    // Word bank
    root.appendChild(this.renderWordBank(collectedWords, assignedWordIds));

    // Controls
    const controls = document.createElement('div');
    controls.className = 'gi-sub-puzzle-controls';

    if (!puzzleState.solved) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'gi-btn';
      clearBtn.textContent = this.i18n.resolveKey('ui.clear_words');
      clearBtn.addEventListener('click', () => this.dispatch({ type: 'CLEAR_ALL_WORDS' }));
      controls.appendChild(clearBtn);

      const validateBtn = document.createElement('button');
      validateBtn.className = 'gi-btn gi-btn--primary';
      validateBtn.textContent = this.i18n.resolveKey('ui.validate');
      validateBtn.addEventListener('click', () => this.dispatch({ type: 'VALIDATE_PUZZLE' }));
      controls.appendChild(validateBtn);
    }

    root.appendChild(controls);

    this.rootEl = root;
    this.container.appendChild(root);
  }

  destroy(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
    this.slotElements.clear();
    this.wordElements.clear();
  }

  getSlotElements(): Map<string, HTMLElement> { return this.slotElements; }
  getWordElements(): Map<string, HTMLElement> { return this.wordElements; }

  showValidationResults(results: ValidationResult): void {
    for (const [slotId, result] of Object.entries(results.slotResults)) {
      const slotEl = this.slotElements.get(slotId);
      if (!slotEl) continue;
      slotEl.classList.remove('gi-slot--correct', 'gi-slot--partial', 'gi-slot--incorrect');
      slotEl.classList.add(`gi-slot--${result}`);
    }
  }

  updateSlotContent(slotId: string, wordId: string | null, words: Word[]): void {
    const slotEl = this.slotElements.get(slotId);
    if (!slotEl) return;
    slotEl.classList.remove('gi-slot--correct', 'gi-slot--partial', 'gi-slot--incorrect');

    if (wordId) {
      const word = words.find(w => w.id === wordId);
      slotEl.textContent = word ? this.i18n.resolveText(word.display) : wordId;
      slotEl.classList.remove('gi-slot--empty');
      slotEl.classList.add('gi-slot--filled');
      slotEl.dataset.wordId = wordId;
    } else {
      slotEl.textContent = slotEl.dataset.placeholder || '___';
      slotEl.classList.add('gi-slot--empty');
      slotEl.classList.remove('gi-slot--filled');
      delete slotEl.dataset.wordId;
    }
  }

  updateWordBankItem(wordId: string, assigned: boolean): void {
    const el = this.wordElements.get(wordId);
    if (el) el.classList.toggle('gi-word--assigned', assigned);
  }

  // --- Type-specific renderers ---

  private renderCharacterId(
    puzzle: CharacterIdPuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'gi-character-grid';

    for (const char of puzzle.characters) {
      const card = document.createElement('div');
      card.className = 'gi-character-card';

      // Portrait
      const portrait = document.createElement('div');
      portrait.className = 'gi-character-portrait';
      const src = this.resolveAssetSrc(char.portrait);
      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        portrait.appendChild(img);
      }
      card.appendChild(portrait);

      // Name slot
      const slot = document.createElement('span');
      slot.className = 'gi-slot gi-slot--empty';
      slot.dataset.slotId = char.nameSlotId;
      slot.dataset.placeholder = '???';
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;

      const assigned = state.slotAssignments[char.nameSlotId];
      if (assigned) {
        const word = words.find(w => w.id === assigned);
        slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
        slot.classList.remove('gi-slot--empty');
        slot.classList.add('gi-slot--filled');
        slot.dataset.wordId = assigned;
      } else {
        slot.textContent = '???';
      }

      slot.addEventListener('click', () => {
        if (slot.dataset.wordId) {
          this.dispatch({ type: 'UNASSIGN_WORD', slotId: char.nameSlotId });
        }
      });

      this.slotElements.set(char.nameSlotId, slot);
      card.appendChild(slot);
      grid.appendChild(card);
    }

    return grid;
  }

  private renderTimeline(
    puzzle: TimelinePuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const timeline = document.createElement('div');
    timeline.className = 'gi-timeline';

    for (const timeSlot of puzzle.slots) {
      const row = document.createElement('div');
      row.className = 'gi-timeline-row';

      const label = document.createElement('span');
      label.className = 'gi-timeline-label';
      label.textContent = this.i18n.resolveText(timeSlot.label);
      row.appendChild(label);

      const slot = document.createElement('span');
      slot.className = 'gi-slot gi-slot--empty';
      slot.dataset.slotId = timeSlot.slotId;
      slot.dataset.placeholder = '___';
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;

      const assigned = state.slotAssignments[timeSlot.slotId];
      if (assigned) {
        const word = words.find(w => w.id === assigned);
        slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
        slot.classList.remove('gi-slot--empty');
        slot.classList.add('gi-slot--filled');
        slot.dataset.wordId = assigned;
      } else {
        slot.textContent = '___';
      }

      slot.addEventListener('click', () => {
        if (slot.dataset.wordId) {
          this.dispatch({ type: 'UNASSIGN_WORD', slotId: timeSlot.slotId });
        }
      });

      this.slotElements.set(timeSlot.slotId, slot);
      row.appendChild(slot);
      timeline.appendChild(row);
    }

    return timeline;
  }

  private renderRelationship(
    puzzle: RelationshipPuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = 'gi-relationship';

    for (const edge of puzzle.edges) {
      const row = document.createElement('div');
      row.className = 'gi-relationship-edge';

      // From node
      const fromNode = puzzle.nodes.find(n => n.id === edge.fromNodeId);
      const fromLabel = document.createElement('span');
      fromLabel.className = 'gi-relationship-node';
      fromLabel.textContent = fromNode ? this.i18n.resolveText(fromNode.label) : edge.fromNodeId;
      row.appendChild(fromLabel);

      // Arrow
      const arrow = document.createElement('span');
      arrow.className = 'gi-relationship-arrow';
      arrow.textContent = '\u2192';
      row.appendChild(arrow);

      // Slot
      const slot = document.createElement('span');
      slot.className = 'gi-slot gi-slot--empty';
      slot.dataset.slotId = edge.slotId;
      slot.dataset.placeholder = '___';
      slot.setAttribute('role', 'button');
      slot.tabIndex = 0;

      const assigned = state.slotAssignments[edge.slotId];
      if (assigned) {
        const word = words.find(w => w.id === assigned);
        slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
        slot.classList.remove('gi-slot--empty');
        slot.classList.add('gi-slot--filled');
        slot.dataset.wordId = assigned;
      } else {
        slot.textContent = '___';
      }

      slot.addEventListener('click', () => {
        if (slot.dataset.wordId) {
          this.dispatch({ type: 'UNASSIGN_WORD', slotId: edge.slotId });
        }
      });

      this.slotElements.set(edge.slotId, slot);
      row.appendChild(slot);

      // Arrow
      const arrow2 = document.createElement('span');
      arrow2.className = 'gi-relationship-arrow';
      arrow2.textContent = '\u2192';
      row.appendChild(arrow2);

      // To node
      const toNode = puzzle.nodes.find(n => n.id === edge.toNodeId);
      const toLabel = document.createElement('span');
      toLabel.className = 'gi-relationship-node';
      toLabel.textContent = toNode ? this.i18n.resolveText(toNode.label) : edge.toNodeId;
      row.appendChild(toLabel);

      container.appendChild(row);
    }

    return container;
  }

  private renderScenario(
    puzzle: ScenarioPuzzle,
    state: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gi-puzzle-template';

    for (const segment of puzzle.template.segments) {
      switch (segment.type) {
        case 'text': {
          const span = document.createElement('span');
          span.className = 'gi-text-segment';
          span.textContent = this.i18n.resolveText(segment.content);
          el.appendChild(span);
          break;
        }
        case 'slot': {
          const slot = document.createElement('span');
          slot.className = 'gi-slot gi-slot--empty';
          slot.dataset.slotId = segment.slotId;
          slot.dataset.placeholder = segment.placeholder
            ? this.i18n.resolveText(segment.placeholder)
            : '___';
          slot.setAttribute('role', 'button');
          slot.tabIndex = 0;

          const assigned = state.slotAssignments[segment.slotId];
          if (assigned) {
            const word = words.find(w => w.id === assigned);
            slot.textContent = word ? this.i18n.resolveText(word.display) : assigned;
            slot.classList.remove('gi-slot--empty');
            slot.classList.add('gi-slot--filled');
            slot.dataset.wordId = assigned;
          } else {
            slot.textContent = slot.dataset.placeholder;
          }

          slot.addEventListener('click', () => {
            if (slot.dataset.wordId) {
              this.dispatch({ type: 'UNASSIGN_WORD', slotId: segment.slotId });
            }
          });

          this.slotElements.set(segment.slotId, slot);
          el.appendChild(slot);
          break;
        }
        case 'line_break': {
          el.appendChild(document.createElement('br'));
          break;
        }
      }
    }

    return el;
  }

  // --- Shared ---

  private renderWordBank(words: Word[], assignedWordIds: Set<string>): HTMLElement {
    const bank = document.createElement('div');
    bank.className = 'gi-word-bank';

    const title = document.createElement('div');
    title.className = 'gi-word-bank-title';
    title.textContent = this.i18n.resolveKey('ui.word_bank');
    bank.appendChild(title);

    const list = document.createElement('div');
    list.className = 'gi-word-bank-list';

    for (const word of words) {
      const wordEl = document.createElement('span');
      wordEl.className = 'gi-word';
      wordEl.dataset.wordId = word.id;
      wordEl.textContent = this.i18n.resolveText(word.display);
      wordEl.tabIndex = 0;

      if (word.category) wordEl.classList.add(`gi-word--category-${word.category}`);
      if (assignedWordIds.has(word.id)) wordEl.classList.add('gi-word--assigned');

      this.wordElements.set(word.id, wordEl);
      list.appendChild(wordEl);
    }

    bank.appendChild(list);
    return bank;
  }

  private resolveAssetSrc(ref: string): string {
    const asset = this.assets.items[ref];
    if (!asset) return ref;
    if (asset.inline) {
      if (asset.inline.startsWith('data:')) return asset.inline;
      return `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.inline}`;
    }
    return asset.src;
  }
}
