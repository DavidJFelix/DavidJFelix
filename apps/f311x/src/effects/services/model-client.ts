import { Context, Data, Effect, Layer } from 'effect'
import type { Env } from '#/lib/env'

// MIGRATION-MARKER: @effect/ai
// ModelClient is the call site where multi-provider fallback lives. If/when
// ExecutionPlan-style routing becomes essential, swap this Effect-flavored
// wrapper for @effect/ai's first-class abstractions.

export class ModelClientError extends Data.TaggedError('ModelClientError')<{
  readonly provider: 'openrouter' | 'anthropic'
  readonly cause: unknown
}> {}

export interface ModelClient {
  readonly openrouterApiKey: string
  readonly anthropicApiKey: string
  // The agent uses Vercel AI SDK's `streamText` directly inside
  // `AIChatAgent.onChatMessage`. Outside that path, prefer TanStack AI
  // calls that consume these credentials.
}

export const ModelClient = Context.GenericTag<ModelClient>('@f311x/ModelClient')

export const ModelClientLive = (env: Env) =>
  Layer.succeed(
    ModelClient,
    ModelClient.of({
      openrouterApiKey: env.OPENROUTER_API_KEY,
      anthropicApiKey: env.ANTHROPIC_API_KEY,
    }),
  )

// Surface kept for symmetry with the other services. Real Effect-wrapped
// model calls land here as the agent + tool surfaces stabilize.
export const _unusedKeepImports = Effect.void
