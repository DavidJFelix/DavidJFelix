// Typed Cloudflare bindings for the f311x Worker.
//
// Once `alchemy.run.ts` is wired up, prefer `typeof worker.Env` from the
// Alchemy v2 output so this stays in sync automatically.

import type { Sandbox as CfSandbox } from '@cloudflare/sandbox'

export type Env = {
  UPLOADS: R2Bucket
  WORKSPACE: R2Bucket
  KNOWLEDGE: VectorizeIndex
  AI: Ai
  GATEWAY: Fetcher
  DYNAMIC_PLANS: unknown
  CHAT_AGENT: DurableObjectNamespace
  SANDBOX: DurableObjectNamespace<CfSandbox>
  RESEARCH_WORKFLOW: WorkflowNamespace
  OPENROUTER_API_KEY: string
  ANTHROPIC_API_KEY: string
}

declare global {
  interface WorkflowNamespace {
    create(opts: { id?: string; params?: unknown }): Promise<WorkflowInstance>
    get(id: string): Promise<WorkflowInstance>
  }
  interface WorkflowInstance {
    id: string
    status(): Promise<{ status: string }>
  }
  interface VectorizeIndex {
    query(
      vector: number[],
      opts?: { topK?: number; filter?: Record<string, unknown> },
    ): Promise<{ matches: Array<{ id: string; score: number; metadata?: unknown }> }>
    upsert(
      vectors: Array<{ id: string; values: number[]; metadata?: unknown }>,
    ): Promise<{ count: number }>
  }
  interface Ai {
    run(model: string, input: unknown): Promise<unknown>
  }
}
