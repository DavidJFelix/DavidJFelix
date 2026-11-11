### fix(revision.city): tag Sentry events with the deploy environment

Sentry events from the dev worker now carry `environment: dev`. Before, the client tagged each event
with the Vite build mode and the worker used the Sentry default, and both are `production` on both
workers. The build now reads `CLOUDFLARE_ENV`. A production build has none, so it stays `production`.
