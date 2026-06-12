import vue from '@vitejs/plugin-vue'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {tsconfigPaths: true},
  test: {
    include: ['src/**/*.test.ts'],
    // Framework is wired ahead of the first test; remove once one exists.
    passWithNoTests: true,
  },
})
