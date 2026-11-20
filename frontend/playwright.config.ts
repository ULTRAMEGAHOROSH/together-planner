// E2E in a real browser (FD-88): only what jsdom cannot check — layout, scroll, sticky,
// responsive. Projects: desktop 1440×900 and mobile 375×812, both in the installed Chrome
// (`channel: 'chrome'`; the browser is not downloaded, see the journal of WEEK-08).
// The dev server is reused when it already runs on :4200, otherwise `npm start` is launched.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Parallel workers share one dev server and one backend: a screen can answer slower than 5 s.
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], channel: 'chrome', viewport: { width: 375, height: 812 } },
    },
  ],
});
