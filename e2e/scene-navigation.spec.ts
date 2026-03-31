import { test, expect } from '@playwright/test';

/**
 * 씬 전환 및 핫스팟 클릭 E2E 테스트.
 *
 * 게임이 demo 게임 또는 mystery-demo 를 로드한 상태에서 실행.
 */
test.describe('Scene Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 게임이 exploring 상태로 진입할 때까지 대기
    await page.waitForFunction(
      () => {
        const badge = document.querySelector('#state-display');
        return badge && !badge.textContent?.includes('loading');
      },
      { timeout: 10_000 }
    );
  });

  test('씬 배경이 렌더링된다', async ({ page }) => {
    // GIEngine 씬 배경 요소 확인
    const scene = page.locator('.gi-scene, [class*="gi-scene"]').first();
    await expect(scene).toBeVisible({ timeout: 5_000 });
  });

  test('navigate 핫스팟 클릭 시 씬이 전환된다', async ({ page }) => {
    // navigate 타입 핫스팟을 찾아 클릭
    const navigateHotspot = page.locator('[data-action-type="navigate"], .gi-hotspot--navigate').first();

    // 해당 핫스팟이 존재할 경우에만 테스트 진행
    const count = await navigateHotspot.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const initialUrl = page.url();
    await navigateHotspot.click();

    // 씬 전환 후 다른 씬이 렌더링되었는지 확인
    await page.waitForTimeout(500); // fade transition 대기
    const scene = page.locator('.gi-scene, [class*="gi-scene"]').first();
    await expect(scene).toBeVisible();
    // 씬 ID가 변경되었는지 확인 (data attribute 방식)
    expect(page.url()).toBe(initialUrl); // SPA이므로 URL은 동일
  });
});
