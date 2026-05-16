import { Context, Data, Effect, Layer } from 'effect'
import type { Env } from '#/lib/env'

export class SandboxError extends Data.TaggedError('SandboxError')<{
  readonly cmd: string
  readonly cause: unknown
}> {}

export interface SandboxExec {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface Sandbox {
  readonly exec: (
    cmd: string,
    opts?: { cwd?: string; timeoutMs?: number },
  ) => Effect.Effect<SandboxExec, SandboxError>
}

export const Sandbox = Context.GenericTag<Sandbox>('@f311x/Sandbox')

export const SandboxLive = (env: Env) =>
  Layer.succeed(
    Sandbox,
    Sandbox.of({
      exec: (cmd, opts) =>
        Effect.tryPromise({
          // TODO: wire to @cloudflare/sandbox SDK once Alchemy v2 resource
          // surface is confirmed. Stub returns a non-zero exit so callers
          // know the sandbox is not provisioned yet.
          try: async () => {
            void env
            void opts
            return {
              stdout: '',
              stderr: 'sandbox not provisioned',
              exitCode: 127,
            } satisfies SandboxExec
          },
          catch: (cause) => new SandboxError({ cmd, cause }),
        }),
    }),
  )
