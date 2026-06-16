import {defineConfig, devices} from '@playwright/test'

// f311x's e2e + visual-regression suite. It runs against either:
//   - a deployed per-PR preview (PREVIEW_URL set by cd-preview-f311x.yml), or
//   - a local production boot (no PREVIEW_URL) for writing/checking baselines.
//
// The local boot serves the *built* worker under workerd via `wrangler dev` --
// the same boot bin/smoke-local.ts uses -- so the chat backend is live and the
// page matches prod. `vite preview` would serve only the static client and 404
// the agent endpoint.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4312)
const PREVIEW_URL = process.env.PREVIEW_URL
const BASE_URL = PREVIEW_URL ?? `http://127.0.0.1:${PORT}`

// Mirrors wrangler.toml. The bun smoke scripts import the .toml directly, but
// Playwright runs under node where that loader isn't available.
const COMPAT_DATE = '2026-05-01'
const COMPAT_FLAGS = 'nodejs_compat'

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
        // Spawn the wrangler binary directly (not via `pnpm exec`) so
        // Playwright's teardown kills workerd instead of a wrapper that
        // outlives it and holds the port -- the trap bin/smoke-local.ts notes.
        command: `node_modules/.bin/wrangler dev dist/server/server.js --port ${PORT} --ip 127.0.0.1 --assets dist/client --compatibility-date ${COMPAT_DATE} --compatibility-flags ${COMPAT_FLAGS}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
