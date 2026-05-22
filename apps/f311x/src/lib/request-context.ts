// Per-request Env propagation.
//
// `envStorage` lives at module scope so the Worker `fetch` handler and
// each `AIChatAgent` Durable Object can populate it independently.
//
// Two execution contexts need this:
//   1. The Worker `fetch` handler -- so TanStack Start server functions
//      (which don't receive `env`) can read Cloudflare bindings on
//      requests routed through the top-level fetch.
//   2. Each `AIChatAgent` Durable Object -- the DO runs in its own
//      execution context with an empty ALS store, so the agent has to
//      re-seed `envStorage` itself before invoking tools. Otherwise
//      `getRequestEnv()` throws on every LLM tool call.

import {AsyncLocalStorage} from 'node:async_hooks'
import type {Env} from '@/lib/env'

const envStorage = new AsyncLocalStorage<Env>()

export const getRequestEnv = (): Env => {
  const env = envStorage.getStore()
  if (!env) {
    throw new Error('getRequestEnv() called outside of a request scope')
  }
  return env
}

export const runWithEnv = <T>(env: Env, fn: () => T | Promise<T>): Promise<T> =>
  Promise.resolve(envStorage.run(env, fn))
