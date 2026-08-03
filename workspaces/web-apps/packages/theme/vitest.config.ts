import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // The package is pure logic, so everything is unit-covered except the
    // React binding: like the apps' UI glue, react.tsx is proven by the
    // consuming apps' e2e suites, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/react.tsx', 'src/**/*.test.*'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
