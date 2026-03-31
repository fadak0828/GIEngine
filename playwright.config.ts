import { defineConfig, devices } from '@playwright/test';

/**
 * GIEngine Playwright E2E 테스트 설정.
 * 실행: npm run test:e2e
 *
 * 브라우저 설치: npx playwright install
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * runtime 개발 서버를 E2E 테스트 실행 전에 자동 시작.
   * `npm run dev` 가 packages/runtime에서 Vite를 포트 5174로 실행한다고 가정.
   */
  webServer: {
    command: 'npm run dev --workspace=packages/runtime',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
