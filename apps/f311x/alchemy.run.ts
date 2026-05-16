// Alchemy v2 stack for f311x. Effect-native -- infrastructure and runtime
// composed as Effects. See docs/projects/f311x/plan.md for the full layout.
//
// Run with `pnpm deploy` (which invokes `alchemy deploy`). This file is
// loaded by the Alchemy CLI, not by `tsc`, so it lives outside the
// project tsconfig include set.
//
// TODO: Vectorize is not (yet) a first-class Alchemy v2 resource. Until
// it is, provision the index out-of-band (via `wrangler vectorize create`
// or the Cloudflare API) and bind it through wrangler.toml.
// TODO: Confirm the CLI entry contract once v2 stabilizes -- exporting a
// `Stack.make(...)` value or a default `Effect` are both candidates.

import * as Cloudflare from 'alchemy/Cloudflare'
import { Effect } from 'effect'

export default Effect.gen(function* () {
  // --- R2 -----------------------------------------------------------
  const uploads = yield* Cloudflare.R2Bucket('f311x-uploads')
  const workspace = yield* Cloudflare.R2Bucket('f311x-agent-workspace')

  // --- AI Gateway ---------------------------------------------------
  const gateway = yield* Cloudflare.AiGateway('f311x-gateway')

  // --- Worker Loader (Dynamic Workflows) ----------------------------
  const dynamicPlans = yield* Cloudflare.DynamicWorkerLoader('f311x-dynamic-plans')

  // --- Worker -------------------------------------------------------
  // DO classes (ChatAgent, Sandbox) and Workflow classes (ResearchWorkflow,
  // DynamicPlanWorkflow) are picked up from `src/server.ts` exports.
  const worker = yield* Cloudflare.Worker('f311x-worker', {
    main: './src/server.ts',
    compatibilityDate: '2026-05-01',
    compatibilityFlags: ['nodejs_compat'],
    bindings: {
      UPLOADS: uploads,
      WORKSPACE: workspace,
      GATEWAY: gateway,
      DYNAMIC_PLANS: dynamicPlans,
      // Secrets (set via `alchemy secrets set` or env at deploy time)
      OPENROUTER_API_KEY: Cloudflare.secret('OPENROUTER_API_KEY'),
      ANTHROPIC_API_KEY: Cloudflare.secret('ANTHROPIC_API_KEY'),
      // TODO: KNOWLEDGE (Vectorize), AI (Workers AI), CHAT_AGENT + SANDBOX
      // (DO namespaces), RESEARCH_WORKFLOW (Workflow binding) -- wire once
      // the corresponding Alchemy v2 resources / patterns are confirmed.
    },
  })

  return { uploads, workspace, gateway, dynamicPlans, worker }
})

export type WorkerEnv = Cloudflare.InferEnv<typeof Cloudflare.Worker>
