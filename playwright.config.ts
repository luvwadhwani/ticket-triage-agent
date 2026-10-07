import { defineConfig, devices } from '@playwright/test';
import { TEST_PUBLIC_KEY } from './tests/fixtures/keys';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        url: 'http://localhost:3000/triage/api/run', // every page redirects to the hub; the gate answers API paths with a plain 401
        env: { GATE_PUBLIC_KEY: TEST_PUBLIC_KEY, NEXT_PUBLIC_HUB_URL: 'http://localhost:3100', PROJECT_ID: 'triage' },
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
