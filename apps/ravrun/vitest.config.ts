import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the app's router
// Vite plugin, so unit tests stay fast and isolated from the router runtime.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Framework is wired ahead of the first test; remove once one exists.
    passWithNoTests: true,
  },
})
