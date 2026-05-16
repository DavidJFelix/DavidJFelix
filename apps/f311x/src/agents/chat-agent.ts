import { AIChatAgent } from 'agents/ai-chat-agent'
import { Effect, Schedule } from 'effect'
import type { StreamTextOnFinishCallback, ToolSet } from 'ai'
import type { Env } from '#/lib/env'
import { makeFetchRuntime } from '#/effects/runtime'
import { VectorStore } from '#/effects/services/vector-store'
import { tools } from './tools'

// MIGRATION-MARKER: @effect/ai
// `streamText` from the Vercel AI SDK is the model-call surface AIChatAgent
// expects (resumable streaming, tool-call protocol). Keep this the only
// place the `ai` package is used.

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal },
  ): Promise<Response | undefined> {
    const runtime = makeFetchRuntime(this.env)
    const signal = options?.abortSignal ?? new AbortController().signal

    const program = Effect.gen(this, function* () {
      // Pull conversation-relevant context from Vectorize.
      yield* VectorStore.pipe(
        Effect.flatMap((store) =>
          // TODO: embed the latest user message and pass the real vector.
          store.query(new Array(1536).fill(0), { topK: 4 }),
        ),
        Effect.catchAll(() => Effect.succeed([] as const)),
      )

      // TODO: call `streamText` from 'ai' here. Wrap in Effect.tryPromise,
      // pass the agent's messages + adapted tools, return the stream
      // response.
      void onFinish
      void this.adaptTools()
      return undefined
    }).pipe(
      Effect.timeout('120 seconds'),
      Effect.retry({
        schedule: Schedule.jittered(Schedule.exponential('500 millis', 2.0)),
        times: 2,
      }),
    )

    return runtime.runPromise(program, { signal })
  }

  private adaptTools() {
    // TODO: bridge `toolDefinition(...).server(...)` (TanStack AI) into the
    // Vercel AI SDK `tool({...})` shape. Both speak Zod -- this is a
    // wrapping exercise, not a translation.
    void tools
    return undefined
  }
}
