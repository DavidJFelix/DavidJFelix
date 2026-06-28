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
    // Framework is wired ahead of the first test; remove once one exists.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/observability/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
