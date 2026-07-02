import {defineConfig, devices} from '@playwright/test'

// onvibes.org's visual-regression suite. It runs against either:
//   - a deployed per-PR preview (PREVIEW_URL set by cd-preview-onvibes-org.yml), or
//   - a local production boot (no PREVIEW_URL) for writing/checking baselines.
//
// The local boot serves the built worker + assets via `wrangler dev` -- the same
// boot bin/smoke-local.ts uses, so the on-demand /diag and /bugs routes are
// reachable.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4324)
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
  // Nothing to boot when pointed at a deployed preview. The local boot uses the
  // Flue worker config -- the artifact CD deploys (Astro hosted inside it, /api
  // agent DOs included) -- so e2e exercises the same worker production runs.
  webServer: PREVIEW_URL
    ? undefined
    : {
        command: `node_modules/.bin/wrangler dev -c dist-flue/onvibes_org/wrangler.json --ip 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
