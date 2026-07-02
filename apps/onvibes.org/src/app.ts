import {type Fetchable, flue} from '@flue/runtime/routing'
import {Hono} from 'hono'
// The Astro app, prebuilt by `astro build` into a self-contained Cloudflare
// Worker (manifest baked in). `astro build` runs before `flue build`, so this
// exists at bundle time. It's a generated artifact with no type declarations
// (and absent before the first build), so the import is suppressed and the
// value is typed explicitly below.
// biome-ignore lint/suspicious/noTsIgnore: @ts-expect-error reports "unused" when the artifact exists and resolves; only @ts-ignore tolerates both the present and pre-build states
// @ts-ignore -- generated build artifact, untyped and absent pre-build
import untypedAstroWorker from '../dist/server/entry.mjs'

const astroWorker = untypedAstroWorker as Fetchable

// Flue is the Worker; Astro runs inside it. Flue's agent HTTP API is served
// under /api (the /chat React island points its client there); every other
// request falls through to the Astro Worker, which serves the prerendered pages
// and static assets.
const app = new Hono()

app.route('/api', flue())

// flue() registers only its specific routes and Hono doesn't merge a sub-app's
// notFound handler, so unmatched /api paths would otherwise fall through to the
// wildcard and render Astro's HTML 404 -- wrong shape (and wasted SSR) for API
// clients. Catch them here with a JSON 404.
app.all('/api/*', (c) => c.json({error: 'Not found.'}, 404))

app.all('*', (c) => astroWorker.fetch(c.req.raw, c.env, c.executionCtx))

export default app
