/// <reference types="vitest/config" />
import {getViteConfig} from 'astro/config'

export default getViteConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
  },
})
