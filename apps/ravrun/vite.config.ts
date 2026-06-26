import {cloudflare} from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import {TanStackRouterVite} from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// The cloudflare() plugin builds src/worker.ts (wrangler.toml `main`) for workerd
// as part of `vite build`, so import.meta.env.VITE_PUBLIC_* is inlined into the
// worker exactly as it is into the client -- the same build env feeds both. It
// also makes `vite preview` serve the worker (relay routes + SPA assets).
export default defineConfig({
  plugins: [cloudflare(), TanStackRouterVite({}), react(), tailwindcss()],
})
