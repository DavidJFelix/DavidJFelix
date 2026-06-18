import {defineConfig, devices} from '@playwright/test'

// monicandavid.com's visual-regression suite. It runs against either:
//   - a deployed per-PR preview (PREVIEW_URL set by cd-preview-monicandavid-com.yml), or
//   - a local production boot (no PREVIEW_URL) for writing/checking baselines.
//
// The local boot serves the built SvelteKit adapter worker under workerd via
// `wrangler dev` (config-driven from wrangler.toml) -- the same boot
// bin/smoke-local.ts uses, since `vite preview` would run the SSR app under Node
// rather than workerd. The spec lives in e2e/ (outside src/routes/) so neither
// SvelteKit nor Vitest picks it up.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4327)
const PREVIEW_URL = process.env.PREVIEW_URL
const BASE_URL = PREVIEW_URL ?? `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
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
        // teardown kills workerd instead of a wrapper that outlives it.
        command: `node_modules/.bin/wrangler dev --port ${PORT} --ip 127.0.0.1`,
        url: BASE_URL,
        env: {WRANGLER_SEND_METRICS: 'false'},
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
