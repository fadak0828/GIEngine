import { test, expect } from '@playwright/test';

/**
 * 에디터 주요 UI 표면에 대한 비주얼 스냅샷 테스트.
 *
 * 스냅샷 갱신:
 *   PLAYWRIGHT_UPDATE_SNAPSHOTS=all npx playwright test --config=playwright.editor.config.ts
 * 또는:
 *   npm run test:e2e:editor:update
 *
 * 첫 실행 시 기준 스냅샷(baseline)이 생성됩니다.
 * CI에서는 기존 스냅샷과 비교하여 회귀를 감지합니다.
 */

test.describe('WelcomeScreen 스냅샷', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('GIEngine Editor')).toBeVisible({ timeout: 8_000 });
  });

  test('WelcomeScreen 전체 화면 스냅샷', async ({ page }) => {
    await expect(page).toHaveScreenshot('welcome-screen.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});

test.describe('Toolbar 스냅샷', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
  });

  test('Toolbar 컴포넌트 스냅샷', async ({ page }) => {
    const toolbar = page.getByRole('banner');
    await expect(toolbar).toHaveScreenshot('toolbar.png', {
      animations: 'disabled',
    });
  });
});

test.describe('MainLayout 스냅샷', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '데모 시작' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '데모 시작' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
    // 레이아웃이 안정화될 때까지 대기
    await page.waitForTimeout(500);
  });

  test('MainLayout 전체 화면 스냅샷', async ({ page }) => {
    await expect(page).toHaveScreenshot('main-layout.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('Toolbar (프로젝트 로드 상태) 스냅샷', async ({ page }) => {
    const toolbar = page.getByRole('banner');
    await expect(toolbar).toHaveScreenshot('toolbar-with-project.png', {
      animations: 'disabled',
    });
  });
});

test.describe('익스포트 모달 스냅샷', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /익스포트/ }).click();
    await expect(page.getByText('📤 HTML 익스포트')).toBeVisible({ timeout: 3_000 });
  });

  test('익스포트 모달 스냅샷', async ({ page }) => {
    await expect(page).toHaveScreenshot('export-modal.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});
