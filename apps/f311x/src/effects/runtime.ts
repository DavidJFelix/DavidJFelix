import {type Layer, ManagedRuntime} from 'effect'
import type {Env} from '#/lib/env'
import {liveLayer} from './layers'

// Cloudflare bindings live inside `env`, which is stable for the lifetime
// of a Worker isolate / DO instance -- every request in that isolate gets
// back the same `env` reference. Memoize the per-Env runtime so we build
// the layer graph once instead of on every request / tool call, and so
// we never leak undisposed `ManagedRuntime` scopes.
const runtimes = new WeakMap<Env, FetchRuntime>()

export const makeFetchRuntime = (env: Env): FetchRuntime => {
  let runtime = runtimes.get(env)
  if (!runtime) {
    runtime = ManagedRuntime.make(liveLayer(env))
    runtimes.set(env, runtime)
  }
  return runtime
}

export type FetchRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof liveLayer>>,
  never
>
