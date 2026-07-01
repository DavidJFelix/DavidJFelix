import {flue} from '@flue/runtime/routing'
import {Hono} from 'hono'
// The Astro app, prebuilt by `astro build` into a self-contained Cloudflare
// Worker (manifest baked in). `astro build` runs before `flue build`, so this
// exists at bundle time. It's an untyped build artifact, so this module is
// excluded from `astro check` (see tsconfig.json) -- Flue's build owns it.
import astroWorker from '../dist/server/entry.mjs'

// Flue is the Worker; Astro runs inside it. Flue's agent HTTP API is served
// under /api (the /chat React island points its client there); every other
// request falls through to the Astro Worker, which serves the prerendered pages
// and static assets.
const app = new Hono()

app.route('/api', flue())

app.all('*', (c) => astroWorker.fetch(c.req.raw, c.env, c.executionCtx))

export default app
