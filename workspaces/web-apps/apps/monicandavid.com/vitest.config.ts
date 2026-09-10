import {svelte} from '@sveltejs/vite-plugin-svelte'
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the SvelteKit Vite
// plugin, so unit tests stay fast and isolated from the framework runtime.
//
// Two projects: `unit` runs the pure `.test.ts` modules under Node, and
// `browser` renders the `.svelte.test.ts` component tests in real Chromium
// through Vitest browser mode (Playwright provider, vitest-browser-svelte), so
// layout, focus, and persisted state are the browser's, not a simulation. The
// Svelte plugin alone (not SvelteKit) compiles the components for it.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    // Mirrors the SvelteKit alias in svelte.config.js for the components'
    // Panda imports; there is no kit plugin here to supply it.
    alias: {'styled-system': new URL('./styled-system', import.meta.url).pathname},
  },
  test: {
    // Playwright specs (*.e2e.test.ts) are driven by Playwright, not Vitest.
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic: the observability relays, the
    // client-config resolver, and the server-side session and database
    // modules. The Svelte components + route glue are exercised by the browser
    // project, smoke, and e2e, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/observability/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.svelte.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['src/**/*.svelte.test.ts'],
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
