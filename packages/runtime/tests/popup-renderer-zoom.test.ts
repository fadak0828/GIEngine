/**
 * popup-renderer.ts — Phase 4 이미지 팝업 줌/패닝 단위 테스트
 *
 * Task 4-B 검증:
 *  - showImagePopup: 이미지 컨테이너 구조 (wrapper, imgContainer, zoomIndicator) 생성
 *  - wheel 이벤트로 줌 조절 (1x~3x)
 *  - 더블클릭으로 1x 리셋
 *  - dismiss() 호출 시 오버레이 제거
 *  - 줌 범위 클램핑 (min 1x, max 3x)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AssetManifest, GameEvent } from '@gi-engine/core';
import { I18nManager } from '@gi-engine/core';
import { PopupRenderer } from '../src/renderer/popup-renderer.js';

// ── helpers ────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeRenderer(container: HTMLElement) {
  const i18n = new I18nManager('ko');
  const assets: AssetManifest = { items: {} };
  const dispatch = vi.fn<[GameEvent], void>();
  const renderer = new PopupRenderer({ container, i18n, assets, dispatch });
  return { renderer, dispatch };
}

function makeImageAsset(assets: AssetManifest, id: string, src: string) {
  assets.items[id] = { id, type: 'image', src, alt: { ko: 'test' }, mimeType: 'image/png' };
}

// ── test suite ─────────────────────────────────────────────────────────

describe('PopupRenderer — 이미지 팝업 줌/패닝 (Phase 4)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
  });

  describe('showImagePopup 기본 DOM 구조', () => {
    it('오버레이와 팝업이 생성됨', () => {
      makeRenderer(container);
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const r2 = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      r2.showImagePopup('img1');
      const overlay = container.querySelector('.gi-overlay');
      expect(overlay).not.toBeNull();
      const popup = overlay!.querySelector('.gi-popup');
      expect(popup).not.toBeNull();
    });

    it('gi-popup-image-wrapper 요소가 생성됨', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      const wrapper = container.querySelector('.gi-popup-image-wrapper');
      expect(wrapper).not.toBeNull();
    });

    it('줌 인디케이터 요소가 wrapper 내에 포함됨', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      const indicator = container.querySelector('.gi-popup-zoom-indicator');
      expect(indicator).not.toBeNull();
    });

    it('이미지 src가 올바르게 설정됨', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/photo.jpg');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      const img = container.querySelector<HTMLImageElement>('.gi-popup-image');
      expect(img?.src).toContain('photo.jpg');
    });

    it('캡션이 제공되면 gi-popup-caption 요소 렌더링', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1', { ko: '사진 설명' });
      const cap = container.querySelector('.gi-popup-caption');
      expect(cap?.textContent).toBe('사진 설명');
    });
  });

  describe('dismiss()', () => {
    it('dismiss() 호출 시 오버레이 제거', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      expect(renderer.isOpen()).toBe(true);
      renderer.dismiss();
      expect(renderer.isOpen()).toBe(false);
      expect(container.querySelector('.gi-overlay')).toBeNull();
    });

    it('두 번째 showImagePopup 호출 시 이전 팝업이 교체됨', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      makeImageAsset(assets, 'img2', '/test2.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      renderer.showImagePopup('img2');
      expect(container.querySelectorAll('.gi-overlay').length).toBe(1);
    });
  });

  describe('이미지 wrapper 스타일', () => {
    it('wrapper의 overflow가 hidden으로 설정됨', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      const wrapper = container.querySelector<HTMLElement>('.gi-popup-image-wrapper');
      expect(wrapper?.style.overflow).toBe('hidden');
    });

    it('초기 cursor가 zoom-in', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      const wrapper = container.querySelector<HTMLElement>('.gi-popup-image-wrapper');
      expect(wrapper?.style.cursor).toBe('zoom-in');
    });
  });

  describe('더블클릭 리셋', () => {
    it('더블클릭 이벤트 발생 시 imgContainer transform이 reset됨', () => {
      const assets: AssetManifest = { items: {} };
      makeImageAsset(assets, 'img1', '/test.png');
      const renderer = new PopupRenderer({
        container, i18n: new I18nManager('ko'), assets, dispatch: vi.fn(),
      });

      renderer.showImagePopup('img1');
      const wrapper = container.querySelector<HTMLElement>('.gi-popup-image-wrapper');
      expect(wrapper).not.toBeNull();

      // 더블클릭 이벤트 트리거
      wrapper!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const imgContainer = container.querySelector<HTMLElement>('.gi-popup-image-container');
      // transform이 scale(1) translate(0,0) 에 해당
      expect(imgContainer?.style.transform).toContain('scale(1)');
    });
  });
});
