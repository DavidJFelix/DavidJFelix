// Standalone vitest config (no SvelteKit plugin): the unit-tested modules in
// src/lib are pure and framework-free; route/worker glue is covered by smoke.
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Logic only: .svelte components in src/lib are presentational and are
      // exercised by the smoke gate instead.
      include: ['src/lib/**/*.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
    },
  },
})
