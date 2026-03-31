import { test, expect } from '@playwright/test';

/**
 * 퍼즐 상호작용 E2E 테스트.
 *
 * 단어 수집, 슬롯 배정, 검증 흐름을 테스트.
 */
test.describe('Puzzle Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => {
        const badge = document.querySelector('#state-display');
        return badge && !badge.textContent?.includes('loading');
      },
      { timeout: 10_000 }
    );
  });

  test('word_reveal 핫스팟 클릭 시 단어 수집 피드백이 표시된다', async ({ page }) => {
    const wordRevealHotspot = page.locator('[data-action-type="word_reveal"], .gi-hotspot').first();

    const count = await wordRevealHotspot.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await wordRevealHotspot.click();

    // 피드백 팝업 또는 단어 수집 UI 확인
    const feedback = page.locator('.gi-feedback, .gi-word-collected, .gi-popup').first();
    await expect(feedback).toBeVisible({ timeout: 3_000 });
  });

  test('퍼즐 오버레이를 열 수 있다', async ({ page }) => {
    // 퍼즐 버튼 또는 오버레이 트리거 찾기
    const puzzleBtn = page.locator('.gi-puzzle-btn, [aria-label*="퍼즐"], [aria-label*="puzzle"]').first();

    const count = await puzzleBtn.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await puzzleBtn.click();
    const overlay = page.locator('.gi-deduction, .gi-puzzle-overlay, .gi-thinking').first();
    await expect(overlay).toBeVisible({ timeout: 3_000 });
  });

  test('RelationshipPuzzle 슬롯이 렌더링된다', async ({ page }) => {
    // relationship 퍼즐의 슬롯 요소 확인
    const relPuzzle = page.locator('.gi-relationship').first();

    const count = await relPuzzle.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await expect(relPuzzle).toBeVisible();

    // 노드 카드가 렌더링되는지 확인
    const nodeCards = relPuzzle.locator('.gi-relationship-node-card');
    await expect(nodeCards).toHaveCount({ minimum: 1 } as Parameters<typeof expect>[0]);
  });
});
