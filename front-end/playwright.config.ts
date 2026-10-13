import { defineConfig } from '@playwright/test';

// Live local API has CORS configured for localhost:5173. Fixture/preview gates
// stay on a separate port; enabling live checks never starts or seeds the DB.
const isLiveApi = process.env.MUSEUM_LIVE_TEST === '1';
const baseURL = isLiveApi ? 'http://localhost:5173' : 'http://127.0.0.1:4173';
const host = isLiveApi ? 'localhost' : '127.0.0.1';
const port = isLiveApi ? 5173 : 4173;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run ${process.env.PLAYWRIGHT_PREVIEW === '1' ? 'preview' : 'dev'} -- --host ${host} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
