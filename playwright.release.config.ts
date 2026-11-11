import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig(base, {
  workers: 2,
  use: { ...base.use, channel: undefined },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
