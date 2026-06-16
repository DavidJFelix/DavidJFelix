import tailwindcss from '@tailwindcss/vite'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// `cloudflare:workers` is the Workers runtime virtual import -- only the
// worker environment build resolves it. Mark it external for the SSR /
// client builds so they don't try to bundle it.
const WORKERS_VIRTUALS = ['cloudflare:workers', /^cloudflare:/]

const config = defineConfig({
  resolve: {tsconfigPaths: true},
  // Key order matters: alchemy's cloudflare vite plugin replaces TanStack
  // Start's buildApp with a naive loop over Object.values(environments), so
  // whichever environment is declared first builds first. The client build
  // must precede ssr or the start manifest falls back to the dev client
  // entry (/@id/virtual:tanstack-start-dev-client-entry) and the deployed
  // page never hydrates. See the 2026-06-11 progress note.
  environments: {
    client: {
      build: {
        rollupOptions: {external: WORKERS_VIRTUALS},
      },
    },
    ssr: {
      build: {
        rollupOptions: {external: WORKERS_VIRTUALS},
      },
    },
  },
  plugins: [
    devtools(),
    // Co-located Playwright specs (*.e2e.test.ts) live under src/ -- including
    // src/routes/ -- so keep the route generator from scanning them as routes
    // (any .ts file in src/routes otherwise becomes an endpoint, e.g. the chat
    // agent at src/routes/agents/chat-agent/default.ts).
    tanstackStart({router: {routeFileIgnorePattern: '\\.test\\.'}}),
    viteReact(),
    tailwindcss(),
  ],
})

export default config
