import type {
  Puzzle,
  PuzzleTemplate,
  PuzzleSegment,
  PuzzleState,
  Word,
  ValidationResult,
  AssetManifest,
  GameEvent,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface DeductionRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

export class DeductionRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private rootEl: HTMLElement | null = null;
  private slotElements: Map<string, HTMLElement> = new Map();
  private wordElements: Map<string, HTMLElement> = new Map();

  constructor(opts: DeductionRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  render(
    puzzle: Puzzle,
    puzzleState: PuzzleState,
    collectedWords: Word[],
    assignedWordIds: Set<string>
  ): void {
    this.destroy();

    const root = document.createElement('div');
    root.className = 'gi-deduction';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', this.i18n.resolveText(puzzle.title));

    // Header
    const header = document.createElement('div');
    header.className = 'gi-deduction-header';
    const title = document.createElement('h2');
    title.className = 'gi-deduction-title';
    title.textContent = this.i18n.resolveText(puzzle.title);
    header.appendChild(title);

    if (puzzle.description) {
      const desc = document.createElement('p');
      desc.className = 'gi-deduction-desc';
      desc.textContent = this.i18n.resolveText(puzzle.description);
      header.appendChild(desc);
    }
    root.appendChild(header);

    // Template
    const templateEl = this.renderTemplate(puzzle.template, puzzleState, collectedWords);
    root.appendChild(templateEl);

    // Word bank
    const bankEl = this.renderWordBank(collectedWords, assignedWordIds, puzzle);
    root.appendChild(bankEl);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'gi-deduction-controls';

    const backBtn = document.createElement('button');
    backBtn.className = 'gi-btn';
    backBtn.textContent = this.i18n.resolveKey('ui.back');
    backBtn.addEventListener('click', () => this.dispatch({ type: 'CLOSE_PUZZLE' }));
    controls.appendChild(backBtn);

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

  showValidationResults(results: ValidationResult): void {
    for (const [slotId, result] of Object.entries(results.slotResults)) {
      const slotEl = this.slotElements.get(slotId);
      if (!slotEl) continue;

      // Remove old result classes
      slotEl.classList.remove('gi-slot--correct', 'gi-slot--partial', 'gi-slot--incorrect', 'gi-slot--animate', 'gi-slot--locked');

      slotEl.classList.add(`gi-slot--${result}`);
      if (result === 'incorrect') {
        slotEl.classList.add('gi-slot--animate');
      }
    }

    // Show segment result badges
    this.showSegmentBadges(results.segmentResults);

    // Show banner
    if (this.rootEl) {
      const existing = this.rootEl.querySelector('.gi-validation-banner');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.className = `gi-validation-banner gi-validation-banner--${results.allCorrect ? 'success' : 'failure'}`;
      banner.textContent = results.allCorrect
        ? this.i18n.resolveKey('ui.all_correct')
        : this.i18n.resolveKey('ui.try_again');
      this.rootEl.appendChild(banner);
    }

    // Lock animation if all correct
    if (results.allCorrect) {
      this.playLockAnimation();
    }
  }

  private showSegmentBadges(segmentResults?: Record<string, { correct: number; total: number }>): void {
    if (!segmentResults || !this.rootEl) return;

    for (const [segmentId, result] of Object.entries(segmentResults)) {
      const sectionEl = this.rootEl.querySelector(`[data-section-id="${segmentId}"]`);
      if (!sectionEl) continue;

      const existingBadge = sectionEl.querySelector('.gi-segment-badge');
      if (existingBadge) existingBadge.remove();

      const badge = document.createElement('span');
      badge.className = `gi-segment-badge ${result.correct === result.total ? 'gi-segment-badge--correct' : 'gi-segment-badge--partial'}`;
      badge.textContent = `${result.correct}/${result.total}`;
      sectionEl.appendChild(badge);
    }
  }

  private playLockAnimation(): void {
    const slots = Array.from(this.slotElements.entries());
    slots.forEach(([slotId, slotEl], index) => {
      setTimeout(() => {
        slotEl.classList.add('gi-slot--locked');
      }, index * 100);
    });
  }

  getSlotElement(slotId: string): HTMLElement | undefined {
    return this.slotElements.get(slotId);
  }

  getSlotElements(): Map<string, HTMLElement> {
    return this.slotElements;
  }

  getWordElements(): Map<string, HTMLElement> {
    return this.wordElements;
  }

  updateSlotContent(slotId: string, wordId: string | null, words: Word[]): void {
    const slotEl = this.slotElements.get(slotId);
    if (!slotEl) return;

    // Remove validation styling when assignment changes
    slotEl.classList.remove('gi-slot--correct', 'gi-slot--partial', 'gi-slot--partial-strong', 'gi-slot--incorrect', 'gi-slot--animate', 'gi-slot--locked');

    // Remove X icon if present
    const xIcon = slotEl.querySelector('.gi-slot-x-icon');
    if (xIcon) xIcon.remove();

    if (wordId) {
      const word = words.find(w => w.id === wordId);
      slotEl.textContent = word ? this.i18n.resolveText(word.display) : wordId;
      slotEl.classList.remove('gi-slot--empty');
      slotEl.classList.add('gi-slot--filled');
      slotEl.dataset.wordId = wordId;
    } else {
      const placeholder = slotEl.dataset.placeholder || '___';
      slotEl.textContent = placeholder;
      slotEl.classList.add('gi-slot--empty');
      slotEl.classList.remove('gi-slot--filled');
      delete slotEl.dataset.wordId;
    }
  }

  updateWordBankItem(wordId: string, assigned: boolean): void {
    const wordEl = this.wordElements.get(wordId);
    if (!wordEl) return;
    wordEl.classList.toggle('gi-word--assigned', assigned);
  }

  showSolvedCelebration(onContinue: () => void): void {
    if (!this.rootEl) return;
    if (this.rootEl.querySelector('.gi-solved-overlay')) return;

    this.spawnConfetti(this.rootEl);

    const overlay = document.createElement('div');
    overlay.className = 'gi-solved-overlay';

    const content = document.createElement('div');
    content.className = 'gi-solved-content';

    const icon = document.createElement('span');
    icon.className = 'gi-solved-icon';
    icon.textContent = '\u2728';
    content.appendChild(icon);

    const title = document.createElement('h2');
    title.className = 'gi-solved-title';
    title.textContent = this.i18n.resolveKey('ui.case_solved_msg');
    content.appendChild(title);

    const btn = document.createElement('button');
    btn.className = 'gi-btn gi-btn--primary gi-solved-btn';
    btn.textContent = this.i18n.resolveKey('ui.continue');
    btn.addEventListener('click', onContinue);
    content.appendChild(btn);

    overlay.appendChild(content);
    this.rootEl.appendChild(overlay);
  }

  private spawnConfetti(container: HTMLElement): void {
    const colors = ['#e8c874', '#7cd694', '#d47070', '#74b4d4', '#c874e8', '#74e8c8'];
    const count = 28;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'gi-confetti-particle';
      const color = colors[i % colors.length];
      particle.style.backgroundColor = color;
      particle.style.left = `${10 + Math.random() * 80}%`;
      particle.style.top = `${5 + Math.random() * 30}%`;
      const dx = (Math.random() - 0.5) * 100;
      particle.style.setProperty('--gi-cx', `${dx}px`);
      particle.style.animationDelay = `${Math.random() * 0.5}s`;
      particle.style.animationDuration = `${1.3 + Math.random() * 0.8}s`;
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 3000);
    }
  }

  destroy(): void {
    if (this.rootEl) {
      this.rootEl.remove();
      this.rootEl = null;
    }
    this.slotElements.clear();
    this.wordElements.clear();
  }

  private renderTemplate(
    template: PuzzleTemplate,
    puzzleState: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const el = document.createElement('div');
    el.className = 'gi-puzzle-template';

    // Group segments by section for badge display
    const sections = new Map<string, { segments: typeof template.segments; sectionLabel?: string }>();
    if (template.sections?.length) {
      for (const section of template.sections) {
        sections.set(section.id, { segments: [], sectionLabel: section.label ? this.i18n.resolveText(section.label) : undefined });
      }
    }

    for (const segment of template.segments) {
      if (segment.type === 'slot' && template.sections?.length && segment.sectionId) {
        const sectionId = segment.sectionId;
        if (!sections.has(sectionId)) {
          sections.set(sectionId, { segments: [] });
        }
        sections.get(sectionId)!.segments.push(segment);
      } else {
        // Non-sectioned content goes into a default group
        if (!sections.has('_default')) {
          sections.set('_default', { segments: [] });
        }
        sections.get('_default')!.segments.push(segment);
      }
    }

    for (const [sectionId, sectionData] of sections) {
      if (sectionId !== '_default' && sectionData.segments.some(s => s.type === 'slot')) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'gi-puzzle-section';
        sectionEl.dataset.sectionId = sectionId;

        if (sectionData.sectionLabel) {
          const label = document.createElement('span');
          label.className = 'gi-puzzle-section-label';
          label.textContent = sectionData.sectionLabel;
          sectionEl.appendChild(label);
        }

        for (const segment of sectionData.segments) {
          if (segment.type === 'text') {
            const span = document.createElement('span');
            span.className = 'gi-text-segment';
            span.textContent = this.i18n.resolveText(segment.content);
            sectionEl.appendChild(span);
          } else if (segment.type === 'slot') {
            const slotEl = this.createSlot(segment, puzzleState, words);
            sectionEl.appendChild(slotEl);
          } else if (segment.type === 'line_break') {
            const br = document.createElement('span');
            br.className = 'gi-line-break';
            sectionEl.appendChild(br);
          }
        }

        el.appendChild(sectionEl);
      } else {
        for (const segment of sectionData.segments) {
          switch (segment.type) {
            case 'text': {
              const span = document.createElement('span');
              span.className = 'gi-text-segment';
              span.textContent = this.i18n.resolveText(segment.content);
              el.appendChild(span);
              break;
            }
            case 'slot': {
              const slotEl = this.createSlot(segment, puzzleState, words);
              el.appendChild(slotEl);
              break;
            }
            case 'line_break': {
              const br = document.createElement('span');
              br.className = 'gi-line-break';
              el.appendChild(br);
              break;
            }
          }
        }
      }
    }

    return el;
  }

  private createSlot(
    segment: PuzzleSegment & { type: 'slot' },
    puzzleState: PuzzleState,
    words: Word[]
  ): HTMLElement {
    const el = document.createElement('span');
    el.className = 'gi-slot';
    el.dataset.slotId = segment.slotId;
    el.setAttribute('role', 'button');
    el.tabIndex = 0;

    const placeholder = segment.placeholder
      ? this.i18n.resolveText(segment.placeholder)
      : '___';
    el.dataset.placeholder = placeholder;

    if (segment.acceptCategory) {
      el.dataset.acceptCategory = segment.acceptCategory;
    }

    // Reserve width matching the longest word that could fill this slot,
    // so empty slots are as large as filled ones and easy to drag onto.
    const relevantWords = segment.acceptCategory
      ? words.filter(w => w.category === segment.acceptCategory)
      : words;
    if (relevantWords.length > 0) {
      const longestText = relevantWords.reduce((max, w) => {
        const text = this.i18n.resolveText(w.display);
        return text.length > max.length ? text : max;
      }, placeholder);
      // 1em per character approximates CJK width; add 2em for horizontal padding.
      el.style.minWidth = `${Math.max(5, longestText.length + 2)}em`;
    }

    const assignedWordId = puzzleState.slotAssignments[segment.slotId];

    if (assignedWordId) {
      const word = words.find(w => w.id === assignedWordId);
      el.textContent = word ? this.i18n.resolveText(word.display) : assignedWordId;
      el.classList.add('gi-slot--filled');
      el.dataset.wordId = assignedWordId;

      // Apply last validation result if any
      const lastResult = puzzleState.lastValidation?.[segment.slotId];
      if (lastResult) {
        el.classList.add(`gi-slot--${lastResult}`);
        if (lastResult === 'incorrect') {
          const xIcon = document.createElement('span');
          xIcon.className = 'gi-slot-x-icon';
          xIcon.textContent = '\u2715';
          el.appendChild(xIcon);
        } else if (lastResult === 'partial') {
          el.classList.add('gi-slot--partial-strong');
        }
      }
    } else {
      el.textContent = placeholder;
      el.classList.add('gi-slot--empty');
    }

    // Click to unassign
    el.addEventListener('click', () => {
      if (el.dataset.wordId) {
        this.dispatch({ type: 'UNASSIGN_WORD', slotId: segment.slotId });
      }
    });

    this.slotElements.set(segment.slotId, el);
    return el;
  }

  private renderWordBank(
    words: Word[],
    assignedWordIds: Set<string>,
    puzzle: Puzzle
  ): HTMLElement {
    const bank = document.createElement('div');
    bank.className = 'gi-word-bank';

    const title = document.createElement('div');
    title.className = 'gi-word-bank-title';
    title.textContent = this.i18n.resolveKey('ui.word_bank');
    bank.appendChild(title);

    const list = document.createElement('div');
    list.className = 'gi-word-bank-list';
    list.setAttribute('role', 'list');

    for (const word of words) {
      const wordEl = document.createElement('span');
      wordEl.className = 'gi-word';
      wordEl.dataset.wordId = word.id;
      wordEl.textContent = this.i18n.resolveText(word.display);
      wordEl.setAttribute('role', 'listitem');
      wordEl.tabIndex = 0;
      wordEl.setAttribute('aria-label', this.i18n.resolveText(word.display));

      if (word.category) {
        wordEl.classList.add(`gi-word--category-${word.category}`);
      }

      if (assignedWordIds.has(word.id)) {
        wordEl.classList.add('gi-word--assigned');
      }

      this.wordElements.set(word.id, wordEl);
      list.appendChild(wordEl);
    }

    bank.appendChild(list);
    return bank;
  }
}
