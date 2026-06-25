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
    // Playwright specs share the .test.ts suffix but run under their own runner.
    exclude: ['**/*.e2e.test.{ts,tsx}', '**/node_modules/**'],
    // Coverage gate for the app's pure logic (the chat agent + the observability
    // relays and config resolver). The UI / route / worker glue is exercised by
    // smoke + e2e, not unit coverage, so it is not included here.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/observability/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
