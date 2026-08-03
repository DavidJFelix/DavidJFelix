import {fauxAssistantMessage, fauxText, registerFauxProvider} from '@earendil-works/pi-ai/compat'
import {registerProvider} from '@flue/runtime'
import {type Fetchable, flue} from '@flue/runtime/routing'
import {Hono} from 'hono'
// The Astro app, prebuilt by `astro build` into a self-contained Cloudflare
// Worker (manifest baked in). `astro build` runs before `flue build`, so this
// exists at bundle time. It's a generated artifact with no type declarations
// (and absent before the first build), so the import is suppressed and the
// value is typed explicitly below.
// oxlint-disable-next-line typescript/ban-ts-comment, typescript/prefer-ts-expect-error -- @ts-expect-error reports "unused" when the artifact exists and resolves; only @ts-ignore tolerates both the present and pre-build states
// @ts-ignore -- generated build artifact, untyped and absent pre-build
import untypedAstroWorker from '../dist/server/entry.mjs'

const astroWorker = untypedAstroWorker as Fetchable

// ─── Model providers ────────────────────────────────────────────────────────
// Provider setup lives here in the app entrypoint (Flue convention), running at
// isolate load -- before any agent harness resolves a model. The "onvibes"
// provider is a keyless faux echo: no API key, deterministic output. Swap it
// for a real provider (e.g. Cloudflare's `AI` binding) once credentials are
// wired; agents reference it as "onvibes/assistant" (src/agents/assistant.ts).
const faux = registerFauxProvider({
  api: 'onvibes',
  provider: 'onvibes',
  models: [{id: 'assistant'}],
})
// registerFauxProvider only supplies the API *transport*; Flue resolves
// "onvibes/assistant" against its provider registry (then pi-ai's builtin
// catalog, which never contains faux models). Register the provider ID so
// resolveModel can find it and route to the faux transport above.
registerProvider('onvibes', {api: 'onvibes', baseUrl: ''})
// The faux provider consumes ONE queued response per model call (shift off a
// queue); a plain one-element queue would echo the first message and error
// ("No more faux responses queued") on every message after it. Re-queue the
// responder on each call so the echo answers indefinitely.
const echo: Parameters<typeof faux.setResponses>[0][number] = (context) => {
  faux.appendResponses([echo])
  const input = context.messages.at(-1)
  const text =
    input?.role === 'user'
      ? typeof input.content === 'string'
        ? input.content
        : input.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
      : ''
  return fauxAssistantMessage(fauxText(`You said: ${text}`))
}
faux.setResponses([echo])

// ─── Routing ────────────────────────────────────────────────────────────────
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
