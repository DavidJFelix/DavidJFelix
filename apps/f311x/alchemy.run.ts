// Alchemy v2 stack for f311x. Effect-native -- infrastructure and runtime
// composed as Effects. See docs/projects/f311x/plan.md for the full layout.
//
// Run with `pnpm deploy` (which invokes `alchemy deploy`). This file is
// loaded by the Alchemy CLI, not by `tsc`, so it lives outside the
// project tsconfig include set.
//
// VectorizeIndex is provided by an in-repo custom Alchemy resource
// (src/alchemy/vectorize/) since v2 doesn't yet ship a first-party
// Vectorize provider.

import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'

const UploadsBucket = Cloudflare.R2Bucket('Uploads')
const WorkspaceBucket = Cloudflare.R2Bucket('AgentWorkspace')
const Gateway = Cloudflare.AiGateway('Gateway')


export const Website = Cloudflare.Vite("Website", {
  compatibility: {
    date: '2026-05-01',
    flags: ['nodejs_compat'],
  },
  bindings: {
    UPLOADS: UploadsBucket,
    WORKSPACE: WorkspaceBucket,
    GATEWAY: Gateway,
  },
})

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
