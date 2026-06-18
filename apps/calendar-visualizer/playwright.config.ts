import {defineConfig, devices} from '@playwright/test'

// calendar-visualizer's visual-regression suite. It runs against either:
//   - a deployed per-PR preview (PREVIEW_URL set by cd-preview-calendar-visualizer.yml), or
//   - a local production boot (no PREVIEW_URL) for writing/checking baselines.
//
// The local boot serves the built static site via `astro preview` -- the same
// boot bin/smoke-local.ts uses -- so the page matches what the preview deploy
// serves.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4322)
const PREVIEW_URL = process.env.PREVIEW_URL
const BASE_URL = PREVIEW_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.test.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
  // Nothing to boot when pointed at a deployed preview.
  webServer: PREVIEW_URL
    ? undefined
    : {
        // Spawn the astro binary directly (not via `pnpm exec`) so Playwright's
        // teardown kills the server instead of a wrapper that outlives it and
        // holds the port -- the trap bin/smoke-local.ts notes.
        command: `node_modules/.bin/astro preview --host 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
