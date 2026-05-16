import { toolDefinition } from '@tanstack/ai'
import { Effect } from 'effect'
import { runCommandInput } from '#/lib/schemas'
import { makeFetchRuntime } from '#/effects/runtime'
import { Sandbox } from '#/effects/services/sandbox'
import { getRequestEnv } from '#/server'

export const runCommandDef = toolDefinition({
  name: 'runCommand',
  description:
    'Execute a shell command inside the Cloudflare Sandbox DO. Output is captured.',
  inputSchema: runCommandInput,
})

export const runCommand = runCommandDef.server(async (input) => {
  const runtime = makeFetchRuntime(getRequestEnv())
  const program = Effect.gen(function* () {
    const sandbox = yield* Sandbox
    return yield* sandbox.exec(input.cmd, {
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
    })
  })
  return runtime.runPromise(program)
})
