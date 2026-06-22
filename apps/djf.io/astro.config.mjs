import {fileURLToPath} from 'node:url'
import {unified} from '@astrojs/markdown-remark'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
// oxlint's import/default can't follow @sentry/astro's default export through its
// conditional exports; the default import is the documented entry and resolves at build.
// eslint-disable-next-line import/default
import sentry from '@sentry/astro'
import {defineConfig} from 'astro/config'
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

// Sentry build-time wiring. This is a static, client-only site, so the server
// SDK is never injected; the browser SDK is bundled only when a DSN is set
// (production deploy) and source maps upload only when fully configured -- so
// local, CI, and preview builds ship zero Sentry code and stay deterministic.
const SENTRY_DSN = process.env.PUBLIC_SENTRY_DSN
const {SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT} = process.env
const sentrySourceMaps =
  SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT
    ? {org: SENTRY_ORG, project: SENTRY_PROJECT, authToken: SENTRY_AUTH_TOKEN}
    : {sourcemaps: {disable: true}}

// https://astro.build/config
export default defineConfig({
  site: 'https://djf.io',
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
