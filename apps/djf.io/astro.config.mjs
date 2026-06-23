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

// The Cloudflare adapter exists only so the on-demand endpoints -- src/pages/bugs.ts
// (the Sentry tunnel) and src/pages/ingest (the PostHog proxy), both
// `prerender = false` -- can run on demand; every page stays prerendered and is
// served straight from assets, so the worker is invoked only for those routes.
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
const adapter = process.env.VITEST
  ? undefined
  : cloudflare({imageService: 'custom', prerenderEnvironment: 'node'})

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
  integrations: [
    sentry({
      enabled: {client: Boolean(SENTRY_DSN), server: false},
      telemetry: false,
      ...sentrySourceMaps,
    }),
    mdx(),
    sitemap(),
    pagefindIntegration(),
  ],
})
