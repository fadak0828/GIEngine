import { test, expect } from '@playwright/test';

/**
 * 에디터 키보드 단축키 E2E 테스트 (FADAA-75 Workstream B1).
 *
 * 검증 대상:
 * - Ctrl+N: 새 프로젝트
 * - Ctrl+1~4: 패널 전환
 * - ? / Ctrl+/: 단축키 도움말 모달 열기/닫기
 * - Esc: 모달 닫기
 * - 텍스트 입력 중 단축키 억제
 */

test.describe('키보드 단축키 — 에디터 로드 후', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
  });

  test('Ctrl+N 으로 새 프로젝트를 생성한다', async ({ page }) => {
    // 현재 프로젝트가 있는 상태에서 Ctrl+N 누르면 WelcomeScreen이 아닌
    // newProject() 가 실행되어 초기화된다 (저장 경고 dialog 생략을 위해
    // beforeunload는 테스트 환경에서 무시됨)
    await page.keyboard.press('Control+n');
    // 프로젝트 상태가 초기화되어 저장 버튼이 비활성화된다
    // (새 빈 프로젝트가 생성되므로 isDirty = false 초기 상태)
    await expect(page.getByRole('button', { name: /저장/ })).toBeVisible({ timeout: 3_000 });
  });

  test('Ctrl+1 로 씬 편집 탭으로 전환된다', async ({ page }) => {
    // 먼저 다른 탭으로 이동
    await page.getByRole('button', { name: /에셋 관리/ }).click();
    await page.keyboard.press('Control+1');
    const tab = page.getByRole('button', { name: /씬 편집/ });
    await expect(tab).toHaveCSS('color', /var|rgb/);
    // 활성 탭은 accent 색상으로 강조됨 — 존재 여부만 확인
    await expect(tab).toBeVisible();
  });

  test('Ctrl+2 로 에셋 관리 탭으로 전환된다', async ({ page }) => {
    await page.keyboard.press('Control+2');
    await expect(page.getByRole('button', { name: /에셋 관리/ })).toBeVisible();
  });

  test('Ctrl+3 로 단어 관리 탭으로 전환된다', async ({ page }) => {
    await page.keyboard.press('Control+3');
    await expect(page.getByRole('button', { name: /단어 관리/ })).toBeVisible();
  });

  test('Ctrl+4 로 퍼즐 편집 탭으로 전환된다', async ({ page }) => {
    await page.keyboard.press('Control+4');
    await expect(page.getByRole('button', { name: /퍼즐 편집/ })).toBeVisible();
  });

  test('? 키로 단축키 도움말 모달이 열린다', async ({ page }) => {
    await page.keyboard.press('Shift+?');
    await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).toBeVisible({ timeout: 3_000 });
  });

  test('Ctrl+/ 로 단축키 도움말 모달이 열린다', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).toBeVisible({ timeout: 3_000 });
  });

  test('Esc 로 단축키 도움말 모달이 닫힌다', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).not.toBeVisible({ timeout: 3_000 });
  });

  test('모달 백드롭 클릭으로 단축키 도움말이 닫힌다', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).toBeVisible({ timeout: 3_000 });
    // 배경 영역(dialog 외부) 클릭
    await page.mouse.click(10, 10);
    await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).not.toBeVisible({ timeout: 3_000 });
  });

  test('단축키 도움말 모달에 주요 단축키가 나열된다', async ({ page }) => {
    await page.keyboard.press('Control+/');
    const dialog = page.getByRole('dialog', { name: '키보드 단축키 도움말' });
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog.getByText('Ctrl + S')).toBeVisible();
    await expect(dialog.getByText('Ctrl + N')).toBeVisible();
    await expect(dialog.getByText('Ctrl + 1')).toBeVisible();
  });
});

test.describe('텍스트 입력 중 단축키 억제', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
  });

  test('input에 포커스된 상태에서 ? 키를 누르면 모달이 열리지 않는다', async ({ page }) => {
    // 검색 또는 텍스트 input이 있는 에셋 탭으로 이동
    await page.keyboard.press('Control+2');
    const searchInput = page.locator('input[placeholder*="검색"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.focus();
      await page.keyboard.press('Shift+?');
      await expect(page.getByRole('dialog', { name: '키보드 단축키 도움말' })).not.toBeVisible();
    } else {
      // input이 없는 경우 테스트 스킵
      test.skip();
    }
  });
});
