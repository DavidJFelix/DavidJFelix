// Alchemy v2 stack for f311x. Effect-native -- infrastructure and runtime
// composed as Effects. See docs/projects/f311x/plan.md for the full layout.
//
// Run with `pnpm deploy` (which invokes `alchemy deploy`). This file is
// loaded by the Alchemy CLI, not by `tsc`, so it lives outside the
// project tsconfig include set.
//
// VectorizeIndex is provided by an in-repo custom Alchemy resource
// (src/alchemy/Vectorize/) since v2 doesn't yet ship a first-party
// Vectorize provider.

import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Vectorize from './src/alchemy/Vectorize/index.ts'

export default Alchemy.Stack(
  'f311x',
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Vectorize.providers()),
  },
  Effect.gen(function* () {
    // --- R2 -----------------------------------------------------------
    const uploads = yield* Cloudflare.R2Bucket('Uploads')
    const workspace = yield* Cloudflare.R2Bucket('AgentWorkspace')

    // --- Vectorize (custom provider) ----------------------------------
    const knowledge = yield* Vectorize.VectorizeIndex('Knowledge', {
      config: { dimensions: 768, metric: 'cosine' },
      description: 'Knowledge index for the f311x chat agent',
    })

    // --- AI Gateway ---------------------------------------------------
    const gateway = yield* Cloudflare.AiGateway('Gateway')

    // --- Worker Loader (Dynamic Workflows) ----------------------------
    const dynamicPlans = yield* Cloudflare.DynamicWorkerLoader('DynamicPlans')

    // --- Worker -------------------------------------------------------
    // DO classes (ChatAgent, Sandbox) and Workflow classes
    // (ResearchWorkflow, DynamicPlanWorkflow) are picked up from
    // `src/server.ts` exports.
    const worker = yield* Cloudflare.Worker('Worker', {
      main: './src/server.ts',
      compatibilityDate: '2026-05-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: {
        UPLOADS: uploads,
        WORKSPACE: workspace,
        KNOWLEDGE: knowledge,
        GATEWAY: gateway,
        DYNAMIC_PLANS: dynamicPlans,
        // Secrets (set via `alchemy secrets set` or env at deploy time)
        OPENROUTER_API_KEY: Cloudflare.secret('OPENROUTER_API_KEY'),
        ANTHROPIC_API_KEY: Cloudflare.secret('ANTHROPIC_API_KEY'),
        // TODO: AI (Workers AI), CHAT_AGENT + SANDBOX (DO namespaces),
        // RESEARCH_WORKFLOW (Workflow binding) -- wire once the
        // corresponding Alchemy v2 binding helpers are confirmed.
      },
    })

    return { uploads, workspace, knowledge, gateway, dynamicPlans, worker }
  }),
)
