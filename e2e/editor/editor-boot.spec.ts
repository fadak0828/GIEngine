import { test, expect } from '@playwright/test';

/**
 * 에디터 기본 부팅 및 WelcomeScreen E2E 테스트.
 *
 * 프로젝트가 없을 때 표시되는 초기 화면을 검증.
 */
test.describe('Editor Boot', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('에디터 페이지가 로드된다', async ({ page }) => {
    await expect(page).toHaveTitle(/GIEngine/i);
  });

  test('WelcomeScreen이 렌더링된다', async ({ page }) => {
    await expect(page.getByText('GIEngine Editor')).toBeVisible({ timeout: 8_000 });
  });

  test('"새 프로젝트" 버튼이 표시된다', async ({ page }) => {
    const btn = page.getByRole('button', { name: '새 프로젝트' });
    await expect(btn).toBeVisible({ timeout: 8_000 });
  });

  test('"데모 시작" 버튼이 표시된다', async ({ page }) => {
    const btn = page.getByRole('button', { name: '데모 시작' });
    await expect(btn).toBeVisible({ timeout: 8_000 });
  });

  test('WelcomeScreen 설명 텍스트가 표시된다', async ({ page }) => {
    await expect(page.getByText('황금 우상 스타일 추리게임 비주얼 에디터')).toBeVisible({ timeout: 8_000 });
  });
});
