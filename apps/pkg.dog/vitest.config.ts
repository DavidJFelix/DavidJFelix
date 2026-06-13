import {defineConfig} from 'vitest/config'

// Minimal standalone test config -- does not load the Nuxt environment, so unit
// tests stay fast. Switch to @nuxt/test-utils if tests need Nuxt auto-imports.
export default defineConfig({
  test: {
    include: ['app/**/*.test.ts'],
    // Framework is wired ahead of the first test; remove once one exists.
    passWithNoTests: true,
  },
})
