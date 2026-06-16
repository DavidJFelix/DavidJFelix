/// <reference types="vitest/config" />
import {getViteConfig} from 'astro/config'

export default getViteConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic (the calendar state builder). The
    // React rendering in calendar.tsx is exercised by smoke, not unit coverage.
    coverage: {
      provider: 'v8',
      include: ['src/components/calendar-state.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
