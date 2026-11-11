import {cloudflare} from '@cloudflare/vite-plugin'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

// Server-only modules. The client build fails when one of these modules is in
// a client chunk after tree shaking. This list replaces the plugin default, so
// the default pattern is the first item. Give a new server-only module a name
// that one of these patterns matches.
const serverOnlyFiles = [
  '**/*.server.*',
  'src/reviews/**',
  'src/symbols/lib/languages/**',
  'src/**/*-endpoint.ts',
  'src/**/*-server.ts',
  'src/diffs/lib/github-pull-request{s,-search}.ts',
  'src/diffs/lib/github-auth.ts',
]

// The cloudflare() plugin runs the SSR environment in workerd and must come
// before tanstackStart() so the server build targets Workers.
const config = defineConfig({
  resolve: {tsconfigPaths: true},
  // CLOUDFLARE_ENV names the wrangler environment of this build ('dev' for the
  // dev worker, unset for production). Sentry tags each event with it.
  define: {
    'import.meta.env.VITE_PUBLIC_DEPLOY_ENV': JSON.stringify(process.env.CLOUDFLARE_ENV ?? ''),
  },
  plugins: [
    devtools(),
    cloudflare({viteEnvironment: {name: 'ssr'}}),
    tanstackStart({importProtection: {client: {files: serverOnlyFiles}}}),
    viteReact(),
  ],
})

export default config
