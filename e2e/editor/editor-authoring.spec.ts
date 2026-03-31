import { test, expect } from '@playwright/test';

/**
 * 에디터 Authoring 스모크 테스트.
 *
 * 핵심 저작 흐름을 검증:
 * - 새 프로젝트 생성
 * - 데모 프로젝트 로드 및 씬 선택
 * - Undo/Redo 동작
 * - 익스포트 모달 열기/닫기
 */

test.describe('새 프로젝트 생성', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
  });

  test('WelcomeScreen에서 새 프로젝트를 생성하면 에디터 레이아웃이 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '새 프로젝트' }).click();

    // Toolbar가 나타나야 함
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });

    // 저장 버튼이 활성화되어야 함 (프로젝트가 로드된 상태)
    const saveBtn = page.getByRole('button', { name: /저장/ });
    await expect(saveBtn).not.toBeDisabled({ timeout: 5_000 });
  });

  test('Toolbar에 핵심 버튼들이 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });

    const toolbar = page.getByRole('banner');
    await expect(toolbar.getByRole('button', { name: /익스포트/ })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /취소/ })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /복구/ })).toBeVisible();
  });
});

test.describe('데모 프로젝트 로드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '데모 시작' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '데모 시작' }).click();
    // MainLayout이 렌더링될 때까지 대기
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
  });

  test('데모 시작 후 Toolbar가 표시된다', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('banner').getByText('GIEngine')).toBeVisible();
  });

  test('ProjectTree 패널이 표시된다', async ({ page }) => {
    // 왼쪽 패널에 씬 아이콘(🎬)이 있어야 함
    await expect(page.getByText('🎬').first()).toBeVisible({ timeout: 5_000 });
  });

  test('프로젝트 제목이 Toolbar에 표시된다', async ({ page }) => {
    // 데모 프로젝트 로드 후 프로젝트 ID 또는 제목이 표시됨
    const toolbar = page.getByRole('banner');
    await expect(toolbar.locator('span').last()).not.toBeEmpty({ timeout: 3_000 });
  });
});

test.describe('Undo/Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
  });

  test('초기 상태에서 Undo 버튼은 비활성화된다', async ({ page }) => {
    const undoBtn = page.getByTitle('실행 취소 (Ctrl+Z)');
    await expect(undoBtn).toBeDisabled();
  });

  test('초기 상태에서 Redo 버튼은 비활성화된다', async ({ page }) => {
    const redoBtn = page.getByTitle('다시 실행 (Ctrl+Y)');
    await expect(redoBtn).toBeDisabled();
  });

  test('Ctrl+Z 키보드 단축키가 동작한다', async ({ page }) => {
    // 단순히 단축키가 오류 없이 처리되는지 확인
    await page.keyboard.press('Control+z');
    // 오류가 없으면 성공 (UI 변화는 Undo 가능 상태에서만 발생)
    await expect(page.getByRole('banner')).toBeVisible();
  });
});

test.describe('익스포트 모달', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: '새 프로젝트' })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: '새 프로젝트' }).click();
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 5_000 });
  });

  test('익스포트 버튼 클릭 시 모달이 열린다', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /익스포트/ });
    await expect(exportBtn).not.toBeDisabled();
    await exportBtn.click();

    // 모달 헤더 확인
    await expect(page.getByText('📤 HTML 익스포트')).toBeVisible({ timeout: 3_000 });
  });

  test('익스포트 모달에 파일명이 표시된다', async ({ page }) => {
    await page.getByRole('button', { name: /익스포트/ }).click();
    await expect(page.getByText('출력 파일명')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/\.html/)).toBeVisible();
  });

  test('익스포트 모달에 빌드 모드 선택이 있다', async ({ page }) => {
    await page.getByRole('button', { name: /익스포트/ }).click();
    await expect(page.getByText('빌드 모드')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('combobox')).toBeVisible();
  });

  test('× 버튼으로 모달을 닫을 수 있다', async ({ page }) => {
    await page.getByRole('button', { name: /익스포트/ }).click();
    await expect(page.getByText('📤 HTML 익스포트')).toBeVisible({ timeout: 3_000 });

    // × 버튼 클릭
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByText('📤 HTML 익스포트')).not.toBeVisible({ timeout: 2_000 });
  });

  test('취소 버튼으로 모달을 닫을 수 있다', async ({ page }) => {
    await page.getByRole('button', { name: /익스포트/ }).click();
    await expect(page.getByText('📤 HTML 익스포트')).toBeVisible({ timeout: 3_000 });

    // 취소 버튼 (모달 하단)
    await page.getByRole('button', { name: '취소' }).click();
    await expect(page.getByText('📤 HTML 익스포트')).not.toBeVisible({ timeout: 2_000 });
  });

  test('배경 클릭으로 모달을 닫을 수 있다', async ({ page }) => {
    await page.getByRole('button', { name: /익스포트/ }).click();
    await expect(page.getByText('📤 HTML 익스포트')).toBeVisible({ timeout: 3_000 });

    // 배경(backdrop) 클릭 - 모달 바깥 좌상단
    await page.mouse.click(50, 50);
    await expect(page.getByText('📤 HTML 익스포트')).not.toBeVisible({ timeout: 2_000 });
  });
});
