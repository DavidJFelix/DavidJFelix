### chore(web-apps): pin every Sentry package to an exact version

The Sentry SDKs in the web apps (`@sentry/astro`, `browser`, `cloudflare`, `react`) used `^11.0.0`.
`@sentry/cloudflare` in the Astro apps and `@sentry/vite-plugin` used exact pins. Each SDK depends
on one exact `@sentry/core`. When lock file maintenance moved only the ranged SDKs, bun installed
two `@sentry/core` copies, and the revision.city typecheck failed (#1111). Now every `@sentry`
package uses an exact 11.10.0 pin. The Renovate `sentry packages` rule sets `rangeStrategy: pin`, so
the Sentry group PR moves them all together.
