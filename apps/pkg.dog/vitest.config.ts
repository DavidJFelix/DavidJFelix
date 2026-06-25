import {defineConfig} from 'vitest/config'

// Minimal standalone test config -- does not load the Nuxt environment, so unit
// tests stay fast. Switch to @nuxt/test-utils if tests need Nuxt auto-imports.
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'shared/**/*.test.ts'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic: the observability relays and the
    // client-config resolver (shared/). The Vue components, server routes, and
    // client plugin are exercised by smoke/e2e, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['shared/posthog-proxy.ts', 'shared/sentry-tunnel.ts', 'shared/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
