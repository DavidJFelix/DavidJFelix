/// <reference types="vitest/config" />
import {getViteConfig} from 'astro/config'

export default getViteConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic: the calendar state builder and the
    // observability relays (src/lib). The React rendering in calendar.tsx and the
    // on-demand routes are exercised by smoke/e2e, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/components/calendar-state.ts', 'src/lib/**'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
