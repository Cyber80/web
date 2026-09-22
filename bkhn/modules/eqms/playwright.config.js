import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'ui.test.js',
  use: {
    baseURL: 'http://127.0.0.1:4173/bkhn/modules/eqms/',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure'
  },
  reporter: 'line'
});
