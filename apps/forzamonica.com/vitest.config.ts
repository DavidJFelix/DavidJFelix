import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the app's Start/devtools
// Vite plugins, so unit tests stay fast and isolated from the router runtime.
export default defineConfig({
  plugins: [react()],
  resolve: {tsconfigPaths: true},
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Playwright specs (*.e2e.test.ts) are driven by Playwright, not Vitest.
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate scoped to the tested pure logic: price formatting, the
    // observability relays (src/lib/{posthog-proxy,sentry-tunnel}), and the
    // client-config resolver. The route glue + client bootstrap are exercised by
    // build/smoke, not unit coverage.
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/format-price.ts',
        'src/lib/posthog-proxy.ts',
        'src/lib/sentry-tunnel.ts',
        'src/observability/config.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
