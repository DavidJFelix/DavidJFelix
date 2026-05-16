import { Layer, ManagedRuntime } from 'effect'
import type { Env } from '#/lib/env'
import { liveLayer } from './layers'

// Cloudflare bindings are only available inside the `fetch` handler, so
// `ManagedRuntime` is constructed per request from env-derived live layers.
// Callers must dispose the runtime when the request ends (or pin it to the
// request lifetime via `using`).
export const makeFetchRuntime = (env: Env) =>
  ManagedRuntime.make(liveLayer(env))

export type FetchRuntime = ReturnType<typeof makeFetchRuntime>

// Convenience: run an Effect with the request's AbortSignal so client
// disconnects propagate as cancellation.
export const runWithSignal = <A, E>(
  runtime: FetchRuntime,
  program: import('effect').Effect.Effect<
    A,
    E,
    Layer.Layer.Success<ReturnType<typeof liveLayer>>
  >,
  signal: AbortSignal,
): Promise<A> => runtime.runPromise(program, { signal })
