// Alchemy v2 stack for f311x. Effect-native -- infrastructure and runtime
// composed as Effects. See docs/projects/f311x/plan.md for the full layout.
//
// Run with `bun run deploy` (which invokes `alchemy deploy`). The CLI loads
// this file, never the app build -- but it is still in the project tsconfig
// so `bun run typecheck` gates it. It was excluded until 2026-08-03, which
// let alchemy beta.66's reshaped `domain` prop typecheck clean in CI; the
// deploy is the only thing that would have caught it.
//
// VectorizeIndex is provided by an in-repo custom Alchemy resource
// (src/alchemy/vectorize/) since v2 doesn't yet ship a first-party
// Vectorize provider.

import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

// const UploadsBucket = Cloudflare.R2Bucket('Uploads')
// const WorkspaceBucket = Cloudflare.R2Bucket('AgentWorkspace')
// const Gateway = Cloudflare.AiGateway('Gateway')

export const Website = Cloudflare.Website.Vite(
  'Website',
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    return {
      compatibility: {
        date: '2026-05-01',
        flags: ['nodejs_compat'],
      },
      // Alchemy attaches the custom domains on deploy and Cloudflare
      // materializes the DNS records. The f311x.com zone must already exist in
      // this account. Prod-only: binding them unconditionally let a local
      // `alchemy deploy` (stage dev_${USER}) steal the public domains onto the
      // dev worker (2026-06-12). `www` is an alias, not a redirect: both
      // hostnames serve the Worker, matching the flat array this replaced
      // (alchemy beta.66 reshaped `domain` into canonical name + aliases).
      ...(stage === 'prod' ? {domain: {name: 'f311x.com', aliases: ['www.f311x.com']}} : {}),
    }
  }),
)

export default Alchemy.Stack(
  'f311x',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website
    return {website}
  }),
)
