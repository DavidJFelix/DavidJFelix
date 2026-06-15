import {getViteConfig} from 'astro/config'

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Coverage gate for the app's pure logic (blog helpers + content schema).
    // Components / pages / layouts are exercised by Playwright e2e, not unit
    // coverage, so they are not included here.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/content.config.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {statements: 100, branches: 90, functions: 100, lines: 100},
    },
  },
})
