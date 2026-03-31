import { defineConfig, devices } from '@playwright/test';

/**
 * GIEngine 에디터 UI/UX E2E 테스트 설정.
 *
 * 실행: npm run test:e2e:editor
 * 스냅샷 갱신: npm run test:e2e:editor:update
 *
 * 런타임 E2E와 분리된 에디터 전용 Playwright 프로파일.
 * 에디터는 포트 5175로 실행 (런타임 5174와 충돌 방지).
 */
export default defineConfig({
  testDir: './e2e/editor',
  fullyParallel: false,   // 에디터 UI 상태가 있으므로 순차 실행
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report-editor', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // 스냅샷 갱신 시: PLAYWRIGHT_UPDATE_SNAPSHOTS=all npm run test:e2e:editor
    ignoreHTTPSErrors: true,
  },

  expect: {
    // 비주얼 스냅샷 비교 허용 오차 (픽셀 단위)
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  projects: [
    {
      name: 'editor-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],

  /**
   * 에디터 개발 서버 (포트 5175).
   * 런타임(5174)과 포트가 다르므로 동시에 실행 가능.
   */
  webServer: {
    command: 'npm run dev --workspace=packages/editor -- --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
