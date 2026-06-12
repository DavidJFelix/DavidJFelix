/// <reference types="vitest/config" />
import {getViteConfig} from 'astro/config'

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
    // Framework is wired ahead of the first test; remove once one exists.
    passWithNoTests: true,
  },
})
