import { cloudflare } from '@cloudflare/vite-plugin'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import agents from 'agents/vite'
import { defineConfig } from 'vite'

// `cloudflare:workers` is the Workers runtime virtual import -- only the
// worker environment build resolves it. Mark it external for the SSR /
// client builds so they don't try to bundle it.
const WORKERS_VIRTUALS = ['cloudflare:workers', /^cloudflare:/]

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  environments: {
    ssr: {
      build: {
        rollupOptions: { external: WORKERS_VIRTUALS },
      },
    },
    client: {
      build: {
        rollupOptions: { external: WORKERS_VIRTUALS },
      },
    },
  },
  plugins: [
    devtools(),
    agents(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    cloudflare(),
  ],
})

export default config
