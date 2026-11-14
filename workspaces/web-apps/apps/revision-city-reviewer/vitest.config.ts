import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    // The coverage gate is for the logic in src/lib. The smoke test covers the
    // Worker and the Durable Object.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
