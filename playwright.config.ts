import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', channel: 'chromium', trace: 'retain-on-failure' },
  webServer: [{
    command: 'pnpm --filter @valixa/example-react preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30000
  }, {
    command: 'pnpm --filter @valixa/example-vue preview --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 30000
  }, {
    command: 'pnpm --filter @valixa/example-angular preview',
    url: 'http://127.0.0.1:4175', reuseExistingServer: false, timeout: 30000
  }]
});
