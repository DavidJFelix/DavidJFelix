import {getViteConfig} from 'astro/config'

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.e2e.test.ts', '**/node_modules/**'],
  },
})
