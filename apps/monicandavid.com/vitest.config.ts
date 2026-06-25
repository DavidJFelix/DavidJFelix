import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the SvelteKit Vite
// plugin, so unit tests stay fast and isolated from the framework runtime.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic: the observability relays and the
    // client-config resolver. The Svelte components + route glue are exercised by
    // smoke/e2e, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/observability/config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
