// oxlint's import/default can't follow these adapters' default exports through
// their conditional exports; the default import is the documented entry and
// resolves at build.
// eslint-disable-next-line import/default
import cloudflare from '@astrojs/cloudflare'
// eslint-disable-next-line import/default
import sentry from '@sentry/astro'
import {defineConfig, sessionDrivers} from 'astro/config'

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

// The Cloudflare adapter exists only so the on-demand endpoints -- the PostHog
// reverse-proxy (src/pages/diag) and the Sentry tunnel (src/pages/bugs), both
// `prerender = false` -- can run on demand; every page stays prerendered and is
// served straight from assets, so the worker is invoked only for those routes.
// `imageService: 'passthrough'` skips the adapter's Cloudflare Images integration
// (no astro:assets images here), keeping the worker free of the IMAGES binding;
// `prerenderEnvironment: 'node'` prerenders in full Node rather than workerd.
//
// Skipped under Vitest: vitest.config.ts builds on getViteConfig, which would
// otherwise load the Cloudflare Vite plugin and reject Vitest's SSR config. Unit
// tests cover only pure src/lib, so they need no adapter.
const adapter = process.env.VITEST
  ? undefined
  : cloudflare({imageService: 'passthrough', prerenderEnvironment: 'node'})

// https://astro.build/config
export default defineConfig({
  site: 'https://davidjfelix.com',
  adapter,
  // The site has no sessions. Without this the Cloudflare adapter defaults to a
  // KV-backed session driver, which would require provisioning a SESSION KV
  // namespace; the no-op driver keeps the worker binding-free.
  session: {driver: sessionDrivers.null()},
  // The on-demand routes (src/pages/bugs.ts, src/pages/diag) are stateless
  // relays -- no cookies or session state, each doing its own validation. Astro's
  // CSRF origin check would otherwise 403 the SDKs' POSTs, so disable it.
  security: {checkOrigin: false},
  integrations: [
    sentry({
      enabled: {client: Boolean(SENTRY_DSN), server: false},
      telemetry: false,
      ...sentrySourceMaps,
    }),
  ],
})
