import { test, expect } from '@playwright/test';

/**
 * 에디터 반응형 디자인 E2E 테스트 (FADAA-152 QA 검토).
 *
 * 검증 대상:
 * - mobile viewport (375x667): PropertiesPanel drawer 토글 동작
 * - tablet viewport (768x1024): AssetManagerPanel tab/drawer 적응
 * - Touch target size: 최소 44x44px 버튼/입력 검증
 * - Viewport 설정: user-scalable=no 스케일링 방지
 * - ESC 키: 모바일 PropertiesDrawer 닫기
 */

test.describe('반응형 — mobile viewport (375x667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start New Project' })).toBeVisible({ timeout: 8_000 });
  });

  test('프로젝트 로드 후 mobile 레이아웃이 정상 렌더링된다', async ({ page }) => {
    // Try Demo Case
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 10_000 });
    // 씬 편집 탭이 보임 (tablist의 탭이 최소 1개 이상)
    const tabs = page.locator('[role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 5_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
  });

  test('Properties 토글 버튼이 표시되고, 클릭하면 drawer가 열린다', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });

    // Properties 토글 버튼 확인 (mobile에서만 표시됨)
    const toggleBtn = page.getByRole('button', { name: /Properties/i });
    await expect(toggleBtn).toBeVisible({ timeout: 3_000 });

    // Drawer 열기
    await toggleBtn.click();
    const drawer = page.locator('#properties-drawer');
    await expect(drawer).toBeVisible({ timeout: 3_000 });
  });

  test('ESC 키로 Properties drawer가 닫힌다', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });

    // Drawer 열기
    await page.getByRole('button', { name: /Properties/i }).click();
    await expect(page.locator('#properties-drawer')).toBeVisible({ timeout: 3_000 });

    // ESC로 닫기
    await page.keyboard.press('Escape');
    await expect(page.locator('#properties-drawer')).not.toBeVisible({ timeout: 3_000 });
  });

  test('Drawer 열린 상태에서 backdrop 클릭하면 닫힌다', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Properties/i }).click();
    await expect(page.locator('#properties-drawer')).toBeVisible({ timeout: 3_000 });

    // backdrop 영역 클릭 (drawer 외部的)
    await page.mouse.click(10, 300);
    await expect(page.locator('#properties-drawer')).not.toBeVisible({ timeout: 3_000 });
  });

  test('Drawer Close 버튼으로 닫기', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /Properties/i }).click();
    await expect(page.locator('#properties-drawer')).toBeVisible({ timeout: 3_000 });

    await page.getByRole('button', { name: /Close/i }).click();
    await expect(page.locator('#properties-drawer')).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe('반응형 — tablet viewport (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start New Project' })).toBeVisible({ timeout: 8_000 });
  });

  test('프로젝트 로드 후 tablet 레이아웃이 정상 렌더링된다', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 10_000 });
    // 탭이 렌더링될 때까지 대기
    await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('AssetManagerPanel toolbar가 tablet 레이아웃에 적응한다', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 10_000 });
    // AssetManager 탭은 aria-controls="panel-assets"로 안정적으로 선택
    await page.getByRole('tab', { name: /에셋 관리/ }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 5_000 });
    // AssetManager panel이 실제로 렌더링될 때까지 대기
    await expect(page.locator('#panel-assets')).toBeVisible({ timeout: 5_000 });
    const filterBtn = page.getByRole('button', { name: /Filter \/ View/ });
    await expect(filterBtn).toBeVisible({ timeout: 10_000 });
  });

  test('Properties 토글 버튼이 tablet에서 정상 동작한다', async ({ page }) => {
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 10_000 });

    const toggleBtn = page.getByRole('button', { name: /Properties/i });
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 });

    await toggleBtn.click();
    await expect(page.locator('#properties-drawer')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Touch target size 검증', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    // Force correct mobile viewport recognition before navigation
    await page.setViewportSize({ width: 375, height: 667 });
    // Trigger resize so React's useViewportBreakpoint picks up the new size
    await page.evaluate(() => {
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 667, writable: true, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start New Project' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Try Demo Case' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 8_000 });
  });

  test('Properties 토글 버튼이 최소 44x44px touch target을 만족한다', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Properties/i });
    await expect(btn).toBeVisible({ timeout: 3_000 });
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('AssetManagerPanel Filter/View 버튼이 최소 44x44px touch target을 만족한다', async ({ page }) => {
    await page.getByRole('tab', { name: /에셋 관리/ }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#panel-assets')).toBeVisible({ timeout: 5_000 });

    const filterBtn = page.getByRole('button', { name: /Filter \/ View/ });
    await expect(filterBtn).toBeVisible({ timeout: 10_000 });
    const box = await filterBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('AssetManagerPanel type filter 버튼이 최소 44px 높이를 만족한다', async ({ page }) => {
    // Filter/View 토글 → expanded controls
    await page.getByRole('tab', { name: /에셋 관리/ }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#panel-assets')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Filter \/ View/ }).click();
    // #asset-compact-controls 안에서만 "전체" 버튼을 선택 (페이지에 버튼이 2개 있음)
    const allFilter = page.locator('#asset-compact-controls button', { hasText: /전체/ });
    await expect(allFilter).toBeVisible({ timeout: 5_000 });
    const box = await allFilter.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('AssetManagerPanel view mode 버튼(Grid)이 최소 44x44px touch target을 만족한다', async ({ page }) => {
    await page.getByRole('tab', { name: /에셋 관리/ }).click();
    await expect(page.locator('[role="tabpanel"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#panel-assets')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /Filter \/ View/ }).click();
    const gridBtn = page.locator('button', { hasText: /^Grid$/ });
    await expect(gridBtn).toBeVisible({ timeout: 5_000 });
    const box = await gridBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('Properties drawer Close 버튼이 최소 44x44px touch target을 만족한다', async ({ page }) => {
    await page.getByRole('button', { name: /Properties/i }).click();
    await expect(page.locator('#properties-drawer')).toBeVisible({ timeout: 3_000 });

    const closeBtn = page.getByRole('button', { name: /Close/i });
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Viewport meta 설정 검증', () => {
  test('index.html에 user-scalable=no 또는 maximum-scale이 설정되어 있다', async ({ page }) => {
    // 에디터 앱의 viewport meta 태그에서 스케일링 방지 설정 확인
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toBeAttached({ timeout: 10_000 });
    const content = await viewportMeta.getAttribute('content');

    // maximum-scale=1 또는 user-scalable=no이 포함되어 있어야 스케일링 방지
    const hasScalableRestriction =
      content?.includes('maximum-scale=1') ||
      content?.includes('user-scalable=no');
    expect(hasScalableRestriction).toBeTruthy();
  });
});
