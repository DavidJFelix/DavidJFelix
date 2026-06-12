import {cloudflare} from '@cloudflare/vite-plugin'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// The cloudflare() plugin runs the SSR environment in workerd and must come
// before tanstackStart() so the server build targets Workers.
const config = defineConfig({
  resolve: {tsconfigPaths: true},
  plugins: [devtools(), cloudflare({viteEnvironment: {name: 'ssr'}}), tanstackStart(), viteReact()],
})

export default config
