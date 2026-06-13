import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the SvelteKit Vite
// plugin, so unit tests stay fast and isolated from the framework runtime.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Framework is wired ahead of the first test; remove once one exists.
    passWithNoTests: true,
  },
})
