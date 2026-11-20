// E2E in a real browser (FD-88): only what jsdom cannot check — layout, scroll, sticky,
// responsive. Projects: desktop 1440×900 and mobile 375×812, both in the installed Chrome
// (`channel: 'chrome'`; the browser is not downloaded, see the journal of WEEK-08).
// The dev server is reused when it already runs on :4200, otherwise `npm start` is launched.
import { defineConfig, devices } from '@playwright/test';

// Node's `process` (the project has no @types/node): only the environment is read.
declare const process: { env: Record<string, string | undefined> };

// `E2E_BASE_URL` points the specs at a running app (the nginx image, http://localhost:8081):
// then no dev server is started. Without it the dev server on :4200 is used.
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const external = process.env['E2E_BASE_URL'] !== undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Parallel workers share one dev server and one backend: a screen can answer slower than 5 s.
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: external
    ? undefined
    : {
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
