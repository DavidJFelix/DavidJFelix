import {defineConfig, devices} from '@playwright/test'

// calendar-visualizer's visual-regression suite. It runs against either:
//   - a deployed per-PR preview (PREVIEW_URL set by cd-preview-calendar-visualizer.yml), or
//   - a local production boot (no PREVIEW_URL) for writing/checking baselines.
//
// The local boot serves the built worker + assets via `wrangler dev` -- the same
// boot bin/smoke-local.ts uses -- so the page matches what the preview deploy
// serves and the on-demand /diag and /bugs routes are reachable.
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
        // Spawn the wrangler binary directly (not via `pnpm exec`) so Playwright's
        // teardown kills workerd instead of a wrapper that outlives it and holds
        // the port. `astro preview` can't serve the adapter's worker routes.
        command: `node_modules/.bin/wrangler dev -c dist/server/wrangler.json --ip 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
