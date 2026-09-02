import react from '@vitejs/plugin-react'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the app's Start/devtools
// Vite plugins, so tests stay fast and isolated from the router runtime.
//
// Two projects: `unit` runs the pure `.test.ts` modules under jsdom, and
// `browser` renders the `.test.tsx` component tests in real Chromium through
// Vitest browser mode (Playwright provider, vitest-browser-react), so layout,
// focus, and scrolling are the browser's, not a simulation.
export default defineConfig({
  plugins: [react()],
  resolve: {tsconfigPaths: true},
  test: {
    // Playwright specs (*.e2e.test.ts) are driven by Playwright, not Vitest.
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic: the conversation model, the
    // observability relays in src/lib, and the config resolution. Components,
    // routes, and the worker are exercised by the browser project, smoke, and
    // e2e rather than unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/observability/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.test.tsx'],
          // Loads the app stylesheet so Panda's generated CSS applies.
          setupFiles: ['./src/browser-test-setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{browser: 'chromium'}],
          },
        },
      },
    ],
  },
})
