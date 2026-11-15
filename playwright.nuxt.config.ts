import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/nuxt', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4176', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: { command: 'pnpm --filter @valixa/example-nuxt preview', url: 'http://127.0.0.1:4176', timeout: 30000, reuseExistingServer: false }
});
