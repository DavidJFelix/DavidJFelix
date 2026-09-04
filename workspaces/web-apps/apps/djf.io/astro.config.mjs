import {copyFile, readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
// oxlint's import/default can't follow these adapters' default exports through
// their conditional exports; the default import is the documented entry and
// resolves at build.
// eslint-disable-next-line import/default
import cloudflare from '@astrojs/cloudflare'
import {unified} from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
// eslint-disable-next-line import/default
import sentry from '@sentry/astro'
import {defineConfig, sessionDrivers} from 'astro/config'
import * as pagefind from 'pagefind'

// Indexes the built site so /pagefind/pagefind.js is served alongside it for
// the Search island. Runs only on `astro build`; dev mode has no index.
function pagefindIntegration() {
  return {
    name: 'pagefind',
    hooks: {
      // Dev has no index, so serve the one from the last `astro build` (run it
      // once for search to work locally). Streams files from dist/client/pagefind
      // at /pagefind/* before the request reaches the workerd runner.
      'astro:server:setup': ({server}) => {
        const types = {
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.wasm': 'application/wasm',
        }
        server.middlewares.use('/pagefind', async (req, res, next) => {
          const file = fileURLToPath(
            new URL(
              `dist/client/pagefind${new URL(req.url, 'http://x').pathname}`,
              import.meta.url,
            ),
          )
          try {
            const data = await readFile(file)
            const ext = file.slice(file.lastIndexOf('.'))
            res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
            res.end(data)
          } catch {
            next()
          }
        })
      },
      'astro:build:done': async ({dir, logger}) => {
        const outDir = fileURLToPath(dir)
        try {
          const {index, errors: createErrors} = await pagefind.createIndex()
          if (!index) {
            throw new Error(`pagefind could not create an index: ${createErrors.join(', ')}`)
          }
          const {errors: addErrors, page_count: pageCount} = await index.addDirectory({
            path: outDir,
          })
          if (addErrors.length > 0) {
            throw new Error(`pagefind could not index ${outDir}: ${addErrors.join(', ')}`)
          }
          const {errors: writeErrors} = await index.writeFiles({outputPath: `${outDir}/pagefind`})
          if (writeErrors.length > 0) {
            throw new Error(`pagefind could not write the index: ${writeErrors.join(', ')}`)
          }
          logger.info(`indexed ${pageCount} pages`)
        } finally {
          // release the pagefind backing service even when indexing fails
          await pagefind.close()
        }
      },
    },
  }
}

// Copies the sitemap index to common alias locations crawlers probe, for
// coverage. Must sit after sitemap() so the index exists when this runs.
function sitemapAliasIntegration() {
  return {
    name: 'sitemap-alias',
    hooks: {
      'astro:build:done': async ({dir}) => {
        for (const alias of ['sitemap.xml', 'sitemap_index.xml']) {
          await copyFile(new URL('sitemap-index.xml', dir), new URL(alias, dir))
        }
      },
    },
  }
}

// Sentry build-time wiring. Sentry stays client-only -- the server SDK is never
// injected (it can't run on workerd anyway); the browser SDK is bundled only
// when a DSN is set (production deploy) and source maps upload only when fully
// configured -- so local, CI, and preview builds ship zero Sentry code and stay
// deterministic.
const SENTRY_DSN = process.env.PUBLIC_SENTRY_DSN
const {SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT} = process.env
const sentrySourceMaps =
  SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT
    ? {org: SENTRY_ORG, project: SENTRY_PROJECT, authToken: SENTRY_AUTH_TOKEN}
    : {sourcemaps: {disable: true}}

// The Cloudflare adapter runs the on-demand endpoints -- src/pages/bugs.ts
// (the Sentry tunnel) and src/pages/diag (the PostHog proxy), both
// `prerender = false`. Every page stays prerendered, but page requests reach
// the worker anyway (wrangler.toml `run_worker_first`) so src/worker.ts can
// negotiate them into markdown for agents; the HTML itself is still fetched
// from assets.
//
// `prerenderEnvironment: 'node'` keeps prerendering in Node rather than the
// adapter's default workerd, because the build optimizes images and renders OG
// cards with native `sharp` (src/pages/og), which can't load in workerd.
// `imageService: 'custom'` keeps Astro's default sharp service so astro:assets
// are optimized at build; the adapter's other modes (incl. 'compile') hand
// images off unoptimized, which shipped the blog banner at its 3.7MB source size.
//
// Skipped under Vitest: vitest.config.ts builds on getViteConfig, which would
// otherwise load the Cloudflare Vite plugin and reject Vitest's SSR config. Unit
// tests cover only pure src/lib logic + the content schema, so they need no
// adapter.
// In dev, requests run inside workerd where sharp can't load, so 'custom'
// leaves every astro:assets image 404ing at /_image. 'passthrough' serves the
// original files instead -- unresized previews, but visible. Builds keep sharp.
const isDev = process.argv.includes('dev')
const adapter = process.env.VITEST
  ? undefined
  : cloudflare({imageService: isDev ? 'passthrough' : 'custom', prerenderEnvironment: 'node'})

// https://astro.build/config
export default defineConfig({
  site: 'https://djf.io',
  adapter,
  // The site has no sessions. Without this the Cloudflare adapter defaults to a
  // KV-backed session driver, which would require provisioning a SESSION KV
  // namespace; the no-op driver keeps the worker binding-free.
  session: {driver: sessionDrivers.null()},
  // The on-demand routes (src/pages/bugs.ts, src/pages/ingest) are stateless
  // relays -- no cookies or session state, each doing its own validation. Astro's
  // CSRF origin check would otherwise 403 the SDKs' POSTs (the Sentry tunnel
  // sends envelopes as text/plain, a form content-type), so disable it.
  security: {checkOrigin: false},
  redirects: {
    '/blog/2024-4-26-on-positivity': '/blog/2024-04-26-on-positivity',
  },
  markdown: {
    processor: unified(),
  },
  vite: {
    ssr: {
      optimizeDeps: {
        // Vite discovers these lazily on the first dev-server request, which
        // triggers a mid-run re-optimization; the adapter's workerd runner then
        // requests the just-deleted chunk hashes and crashes the dev process.
        // Predeclaring them keeps optimization to startup.
        include: [
          'astro/app/manifest',
          'astro/assets/services/noop',
          'astro/assets/services/sharp',
          'astro/logger/json',
        ],
      },
    },
  },
  integrations: [
    sentry({
      enabled: {client: Boolean(SENTRY_DSN), server: false},
      telemetry: false,
      ...sentrySourceMaps,
    }),
    mdx(),
    sitemap(),
    sitemapAliasIntegration(),
    pagefindIntegration(),
  ],
})
