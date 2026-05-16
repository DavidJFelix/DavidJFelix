import { getSandbox, type ExecResult } from '@cloudflare/sandbox'
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
  readonly success: boolean
}

export interface Sandbox {
  readonly exec: (
    cmd: string,
    opts?: { cwd?: string; timeoutMs?: number; sessionId?: string },
  ) => Effect.Effect<SandboxExec, SandboxError>
}

export const Sandbox = Context.GenericTag<Sandbox>('@f311x/Sandbox')

// One sandbox instance per agent session by default. Callers can pin a
// different session via `opts.sessionId` -- e.g. to share state across
// multiple tool calls in the same chat turn.
const DEFAULT_SANDBOX_ID = 'default'

const normalize = (r: ExecResult): SandboxExec => ({
  stdout: r.stdout,
  stderr: r.stderr,
  exitCode: r.exitCode,
  success: r.success,
})

export const SandboxLive = (env: Env) =>
  Layer.succeed(
    Sandbox,
    Sandbox.of({
      exec: (cmd, opts) =>
        Effect.tryPromise({
          try: async () => {
            const sandbox = getSandbox(
              env.SANDBOX,
              opts?.sessionId ?? DEFAULT_SANDBOX_ID,
            )
            const res = await sandbox.exec(cmd, {
              cwd: opts?.cwd,
              timeout: opts?.timeoutMs,
            })
            return normalize(res)
          },
          catch: (cause) => new SandboxError({ cmd, cause }),
        }),
    }),
  )
