import { test, expect } from '@playwright/test';

/**
 * GIEngine 기본 부팅 및 UI 렌더링 E2E 테스트.
 *
 * 전제 조건:
 * - `npm run dev --workspace=packages/runtime` 이 실행 중이어야 함
 * - playwright.config.ts 의 webServer 설정이 서버를 자동 시작함
 */
test.describe('GIEngine Boot', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('게임 컨테이너가 렌더링된다', async ({ page }) => {
    const gameContainer = page.locator('#game-container');
    await expect(gameContainer).toBeVisible();
  });

  test('GIEngine 루트 요소가 마운트된다', async ({ page }) => {
    // GIEngine은 #game-container 내부에 .gi-root 또는 .gi-scaler 를 마운트함
    const root = page.locator('#game-container > [class*="gi-"]').first();
    await expect(root).toBeVisible({ timeout: 5_000 });
  });

  test('게임이 case_select 또는 exploring 상태로 진입한다', async ({ page }) => {
    // 상태 표시 배지 확인 (개발 툴바)
    const stateBadge = page.locator('#state-display');
    await expect(stateBadge).not.toHaveText('loading…', { timeout: 5_000 });
  });
});
