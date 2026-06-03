import react from '@vitejs/plugin-react'
import {defineConfig} from 'vitest/config'

// Standalone test config -- intentionally does not load the app's Start/devtools
// Vite plugins, so unit tests stay fast and isolated from the router runtime.
export default defineConfig({
  plugins: [react()],
  resolve: {tsconfigPaths: true},
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
