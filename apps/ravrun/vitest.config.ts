import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the app's router
// Vite plugin, so unit tests stay fast and isolated from the router runtime.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Playwright specs (*.e2e.test.ts) are driven by Playwright, not Vitest.
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic: the observability relays and the
    // client-config resolver (src/lib + src/observability/config). The SPA render
    // and the worker glue are exercised by e2e/smoke, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/observability/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
