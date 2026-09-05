import {defineConfig, devices} from '@playwright/test'

// onvibes.org's visual-regression suite. It runs against either:
//   - a deployed per-PR preview (PREVIEW_URL set by cd-preview-web-apps.yml), or
//   - a local production boot (no PREVIEW_URL) for writing/checking baselines.
//
// The local boot serves the built SSR worker in workerd via `vite preview` (the
// @cloudflare/vite-plugin) -- the same boot bin/smoke-local.ts uses, so the page
// matches what the preview deploy serves.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4324)
const PREVIEW_URL = process.env.PREVIEW_URL
const BASE_URL = PREVIEW_URL ?? `http://127.0.0.1:${PORT}`

// onvibes.org's workers.dev previews sit behind Cloudflare Access. In CI the
// preview-wrangler action passes a service token, sent on every browser and
// API request so Access lets the suite through instead of serving its login
// page. Unset locally: the local boot has no Access in front of it.
const ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID
const ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET
const accessHeaders =
  ACCESS_CLIENT_ID && ACCESS_CLIENT_SECRET
    ? {'CF-Access-Client-Id': ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': ACCESS_CLIENT_SECRET}
    : undefined

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
    extraHTTPHeaders: accessHeaders,
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
  // Nothing to boot when pointed at a deployed preview.
  webServer: PREVIEW_URL
    ? undefined
    : {
        // Spawn the vite binary directly (not via `bun x`) so Playwright's
        // teardown kills workerd instead of a wrapper that outlives it.
        command: `node_modules/.bin/vite preview --host 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
