import {cloudflare} from '@cloudflare/vite-plugin'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// The cloudflare() plugin runs the SSR environment in workerd and must come
// before tanstackStart() so the server build targets Workers.
const config = defineConfig({
  resolve: {tsconfigPaths: true},
  // CLOUDFLARE_ENV names the wrangler environment of this build ('dev' for the
  // dev worker, unset for production). Sentry tags each event with it.
  define: {
    'import.meta.env.VITE_PUBLIC_DEPLOY_ENV': JSON.stringify(process.env.CLOUDFLARE_ENV ?? ''),
  },
  plugins: [devtools(), cloudflare({viteEnvironment: {name: 'ssr'}}), tanstackStart(), viteReact()],
})

export default config
