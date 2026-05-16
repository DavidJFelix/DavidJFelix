// Alchemy v2 stack for f311x. Effect-native -- infrastructure and runtime
// composed as Effects. See docs/projects/f311x/plan.md for the full layout.
//
// TODO: confirm the v2 API surface against https://v2.alchemy.run before
// fleshing this out -- the beta channel has moved recently. The structure
// below sketches intent.

import { Effect } from 'effect'

// Placeholder type-only shim. Replace with the real Alchemy v2 imports
// once the install is verified.
type ResourceHandle<T> = Effect.Effect<T, never, never>

const program = Effect.gen(function* () {
  // R2 buckets
  const uploads = yield* r2Bucket('f311x-uploads')
  const workspace = yield* r2Bucket('f311x-agent-workspace')

  // Vectorize
  const knowledge = yield* vectorize('f311x-knowledge', {
    dimensions: 1536,
    metric: 'cosine',
  })

  // AI Gateway (caching, rate-limiting, observability)
  const gateway = yield* aiGateway('f311x-gateway')

  // Worker Loader binding for Dynamic Workflows
  const workerLoader = yield* workerLoaderBinding('DYNAMIC_PLANS')

  // Main Worker
  yield* worker('f311x', {
    entrypoint: './src/server.ts',
    bindings: {
      UPLOADS: uploads,
      WORKSPACE: workspace,
      KNOWLEDGE: knowledge,
      GATEWAY: gateway,
      DYNAMIC_PLANS: workerLoader,
      // Durable Object namespaces -- ChatAgent + Sandbox
      CHAT_AGENT: durableObjectNamespace('ChatAgent'),
      SANDBOX: durableObjectNamespace('Sandbox'),
      // Static Workflow binding
      RESEARCH_WORKFLOW: workflow('research', './src/workflows/research.ts'),
      // Secrets
      OPENROUTER_API_KEY: secret('OPENROUTER_API_KEY'),
      ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
    },
  })
})

// --- TODO: replace these stubs with real Alchemy v2 resource constructors ---

declare function r2Bucket(name: string): ResourceHandle<unknown>
declare function vectorize(
  name: string,
  opts: { dimensions: number; metric: 'cosine' | 'dot' | 'euclidean' },
): ResourceHandle<unknown>
declare function aiGateway(name: string): ResourceHandle<unknown>
declare function workerLoaderBinding(name: string): ResourceHandle<unknown>
declare function worker(
  name: string,
  opts: { entrypoint: string; bindings: Record<string, unknown> },
): ResourceHandle<unknown>
declare function durableObjectNamespace(className: string): unknown
declare function workflow(name: string, entrypoint: string): unknown
declare function secret(name: string): unknown

export default program
