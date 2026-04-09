import type {
  ConversationDefinition,
  ConversationChoice,
  GameEvent,
  AssetManifest,
} from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';

export interface ConversationRendererOptions {
  container: HTMLElement;
  i18n: I18nManager;
  assets: AssetManifest;
  dispatch: (event: GameEvent) => void;
}

export class ConversationRenderer {
  private container: HTMLElement;
  private i18n: I18nManager;
  private assets: AssetManifest;
  private dispatch: (event: GameEvent) => void;
  private overlayEl: HTMLElement | null = null;
  private currentConversation: ConversationDefinition | null = null;
  private currentNodeId: string | null = null;

  constructor(opts: ConversationRendererOptions) {
    this.container = opts.container;
    this.i18n = opts.i18n;
    this.assets = opts.assets;
    this.dispatch = opts.dispatch;
  }

  startConversation(conversationId: string, def: Record<string, ConversationDefinition>): void {
    const conversation = def[conversationId];
    if (!conversation) {
      console.warn(`[GIEngine] Conversation not found: ${conversationId}`);
      return;
    }

    this.currentConversation = conversation;
    this.currentNodeId = conversation.nodes[0]?.id ?? null;
    this.renderCurrentNode();
  }

  private renderCurrentNode(): void {
    if (!this.currentConversation || !this.currentNodeId) return;

    const node = this.currentConversation.nodes.find(n => n.id === this.currentNodeId);
    if (!node) {
      this.dismiss();
      return;
    }

    this.dismiss();
    const overlay = this.createOverlay();
    const dialog = document.createElement('div');
    dialog.className = 'gi-conversation-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    // Speaker header
    const speakerEl = document.createElement('div');
    speakerEl.className = 'gi-conversation-speaker';
    speakerEl.textContent = this.i18n.resolveText(node.speaker);
    dialog.appendChild(speakerEl);

    // Content body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'gi-conversation-body';
    bodyEl.textContent = this.i18n.resolveText(node.content);
    dialog.appendChild(bodyEl);

    // Choices or "continue" button
    if (node.choices && node.choices.length > 0) {
      const choicesEl = document.createElement('div');
      choicesEl.className = 'gi-conversation-choices';
      for (const choice of node.choices) {
        const btn = this.createChoiceButton(choice);
        choicesEl.appendChild(btn);
      }
      dialog.appendChild(choicesEl);
    } else {
      const continueBtn = document.createElement('button');
      continueBtn.className = 'gi-conversation-continue';
      continueBtn.textContent = this.i18n.resolveText({ ko: '▶', en: '▶' });
      continueBtn.addEventListener('click', () => this.advance());
      dialog.appendChild(continueBtn);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'gi-conversation-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.dismiss());
    dialog.appendChild(closeBtn);

    overlay.appendChild(dialog);
    dialog.tabIndex = -1;
    requestAnimationFrame(() => dialog.focus());
  }

  private createChoiceButton(choice: ConversationChoice): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'gi-conversation-choice';
    btn.textContent = this.i18n.resolveText(choice.text);
    btn.addEventListener('click', () => {
      this.dispatch({
        type: 'CONVERSATION_CHOICE',
        conversationId: this.currentConversation?.id ?? '',
        nodeId: choice.targetNodeId,
      });
      this.currentNodeId = choice.targetNodeId;
      this.renderCurrentNode();
    });
    return btn;
  }

  private advance(): void {
    if (!this.currentConversation || !this.currentNodeId) return;

    const currentNode = this.currentConversation.nodes.find(n => n.id === this.currentNodeId);
    if (!currentNode) return;

    if (currentNode.next) {
      this.dispatch({
        type: 'CONVERSATION_ADVANCE',
        conversationId: this.currentConversation.id,
        nodeId: currentNode.next,
      });
      this.currentNodeId = currentNode.next;
      this.renderCurrentNode();
    } else {
      this.dismiss();
      this.dispatch({
        type: 'CONVERSATION_END',
        conversationId: this.currentConversation.id,
      });
    }
  }

  dismiss(): void {
    if (this.overlayEl) {
      this.overlayEl.remove();
      this.overlayEl = null;
    }
    this.currentConversation = null;
    this.currentNodeId = null;
  }

  isOpen(): boolean {
    return this.overlayEl !== null;
  }

  private createOverlay(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'gi-overlay';

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.dispatch({ type: 'CLOSE_POPUP' });
        this.dismiss();
      }
    });

    this.overlayEl = overlay;
    this.container.appendChild(overlay);
    return overlay;
  }
}
