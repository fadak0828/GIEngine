import type { LocalizedText, Hint } from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface HintRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  onHintRequest: (level: 1 | 2 | 3) => void;
  onClose: () => void;
}

export class HintRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private onHintRequest: (level: 1 | 2 | 3) => void;
  private onClose: () => void;
  private overlayEl: HTMLElement | null = null;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private remainingCooldownSec: number = 0;

  constructor(opts: HintRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.onHintRequest = opts.onHintRequest;
    this.onClose = opts.onClose;
  }

  showHintButton(puzzleId: string, hintsRemaining: number, cooldownSec: number): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'gi-hint-button';
    btn.setAttribute('aria-label', 'Request hint');
    btn.dataset.puzzleId = puzzleId;

    if (hintsRemaining <= 0 || cooldownSec > 0) {
      btn.disabled = true;
      if (cooldownSec > 0) {
        btn.title = `Hint available in ${cooldownSec}s`;
      } else {
        btn.title = 'No hints remaining';
      }
    } else {
      btn.title = `Request hint (${hintsRemaining} remaining)`;
      btn.addEventListener('click', () => {
        this.showHintLevelSelector(puzzleId, hintsRemaining);
      });
    }

    return btn;
  }

  showHintLevelSelector(puzzleId: string, hintsRemaining: number): void {
    this.dismiss();

    const overlay = this.createOverlay();
    const panel = document.createElement('div');
    panel.className = 'gi-hint-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Select hint level');

    const title = document.createElement('h3');
    title.className = 'gi-hint-panel-title';
    title.textContent = this.i18n.resolveText({ ko: '힌트 선택', en: 'Select Hint Level' });
    panel.appendChild(title);

    const hintLevels = [
      { level: 1 as const, label: { ko: '약한 힌트', en: 'Subtle Hint' }, description: { ko: '방향성을 살짝 알려줍니다', en: 'Gives a small direction' } },
      { level: 2 as const, label: { ko: '중간 힌트', en: 'Medium Hint' }, description: { ko: '더 구체적인 단서를 줍니다', en: 'Gives a more specific clue' } },
      { level: 3 as const, label: { ko: '직접적 힌트', en: 'Direct Hint' }, description: { ko: '거의 답을 알려줍니다', en: 'Almost gives the answer' } },
    ];

    for (const hintLevel of hintLevels) {
      const btn = document.createElement('button');
      btn.className = 'gi-hint-level-button';
      btn.dataset.level = String(hintLevel.level);

      const label = document.createElement('span');
      label.className = 'gi-hint-level-label';
      label.textContent = this.i18n.resolveText(hintLevel.label);

      const desc = document.createElement('span');
      desc.className = 'gi-hint-level-desc';
      desc.textContent = this.i18n.resolveText(hintLevel.description);

      btn.appendChild(label);
      btn.appendChild(desc);

      if (hintsRemaining <= 0) {
        btn.disabled = true;
      } else {
        btn.addEventListener('click', () => {
          this.dismiss();
          this.onHintRequest(hintLevel.level);
        });
      }

      panel.appendChild(btn);
    }

    panel.appendChild(this.createCloseButton());
    overlay.appendChild(panel);

    panel.tabIndex = -1;
    requestAnimationFrame(() => panel.focus());
  }

  showHint(hint: Hint, hintsRemaining: number, scorePenalty?: number): void {
    this.dismiss();

    const overlay = this.createOverlay();
    const panel = document.createElement('div');
    panel.className = 'gi-hint-display';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Hint');

    const levelLabels: Record<number, LocalizedText> = {
      1: { ko: '🔸 약한 힌트', en: '🔸 Subtle Hint' },
      2: { ko: '🔶 중간 힌트', en: '🔶 Medium Hint' },
      3: { ko: '🔴 직접적 힌트', en: '🔴 Direct Hint' },
    };

    const levelLabel = document.createElement('div');
    levelLabel.className = 'gi-hint-level-indicator';
    levelLabel.textContent = this.i18n.resolveText(levelLabels[hint.level] ?? levelLabels[1]);
    panel.appendChild(levelLabel);

    const hintText = document.createElement('p');
    hintText.className = 'gi-hint-text';
    hintText.textContent = this.i18n.resolveText(hint.text);
    panel.appendChild(hintText);

    if (scorePenalty && scorePenalty > 0) {
      const penalty = document.createElement('p');
      penalty.className = 'gi-hint-penalty';
      penalty.textContent = this.i18n.resolveText({
        ko: `점수 페널티: -${scorePenalty}`,
        en: `Score penalty: -${scorePenalty}`
      });
      panel.appendChild(penalty);
    }

    const remaining = document.createElement('p');
    remaining.className = 'gi-hint-remaining';
    remaining.textContent = this.i18n.resolveText({
      ko: `남은 힌트: ${hintsRemaining}회`,
      en: `Hints remaining: ${hintsRemaining}`
    });
    panel.appendChild(remaining);

    panel.appendChild(this.createCloseButton());
    overlay.appendChild(panel);

    panel.tabIndex = -1;
    requestAnimationFrame(() => panel.focus());
  }

  showCooldown(cooldownSec: number): void {
    this.remainingCooldownSec = cooldownSec;
    this.updateCooldownDisplay();

    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }

    this.cooldownTimer = setInterval(() => {
      this.remainingCooldownSec--;
      if (this.remainingCooldownSec <= 0) {
        this.clearCooldown();
      } else {
        this.updateCooldownDisplay();
      }
    }, 1000);
  }

  private updateCooldownDisplay(): void {
    const existing = this.container.querySelector('.gi-hint-cooldown');
    if (existing) {
      existing.textContent = this.i18n.resolveText({
        ko: `${this.remainingCooldownSec}초 후 힌트 사용 가능`,
        en: `Hint available in ${this.remainingCooldownSec}s`
      });
    }
  }

  private clearCooldown(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    const existing = this.container.querySelector('.gi-hint-cooldown');
    if (existing) {
      existing.remove();
    }
  }

  dismiss(): void {
    this.clearCooldown();
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

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.onClose();
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
      this.onClose();
    });
    return btn;
  }
}