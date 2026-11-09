import { defineConfig } from '@playwright/test';

// Live local API has CORS configured for localhost:5173. Fixture/preview gates
// stay on a separate port; enabling live checks never starts or seeds the DB.
const isLiveApi = process.env.MUSEUM_LIVE_TEST === '1';
// Explicit manual audit only. CI/regressions retain deterministic software WebGL.
const isHardwareAudit = process.env.MUSEUM_HARDWARE_AUDIT === '1';
const baseURL = isLiveApi ? 'http://localhost:5173' : 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    launchOptions: { args: isHardwareAudit ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: isHardwareAudit ? 'off' : 'retain-on-failure',
  },
});
