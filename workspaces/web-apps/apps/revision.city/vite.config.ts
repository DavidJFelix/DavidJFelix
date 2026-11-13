import {cloudflare} from '@cloudflare/vite-plugin'
import {sentryVitePlugin} from '@sentry/vite-plugin'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig, perEnvironmentPlugin} from 'vite'

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

// The client build makes hidden source maps and sends them to Sentry only when
// the token, the org and the project are all set. Without one of them, the
// build does not change. The plugin deletes the maps after the upload step, also
// when the upload fails, so the asset server never serves them. It skips the
// server build, which keeps its own maps.
const {SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT} = process.env
const uploadsSourceMaps = Boolean(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT)
const sentrySourceMaps = perEnvironmentPlugin(
  'sentry-client-source-maps',
  ({name}) =>
    uploadsSourceMaps &&
    name === 'client' &&
    sentryVitePlugin({
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      authToken: SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: {filesToDeleteAfterUpload: ['./dist/client/**/*.map']},
    }),
)

// The cloudflare() plugin runs the SSR environment in workerd and must come
// before tanstackStart() so the server build targets Workers.
const config = defineConfig({
  resolve: {tsconfigPaths: true},
  // CLOUDFLARE_ENV names the wrangler environment of this build ('dev' for the
  // dev worker, unset for production). Sentry tags each event with it.
  define: {
    'import.meta.env.VITE_PUBLIC_DEPLOY_ENV': JSON.stringify(process.env.CLOUDFLARE_ENV ?? ''),
  },
  environments: uploadsSourceMaps ? {client: {build: {sourcemap: 'hidden'}}} : {},
  plugins: [
    devtools(),
    cloudflare({viteEnvironment: {name: 'ssr'}}),
    tanstackStart({importProtection: {client: {files: serverOnlyFiles}}}),
    viteReact(),
    sentrySourceMaps,
  ],
})

export default config
