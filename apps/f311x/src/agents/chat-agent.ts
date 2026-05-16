import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { AIChatAgent } from 'agents/ai-chat-agent'
import {
  convertToModelMessages,
  streamText,
  type StreamTextOnFinishCallback,
  type ToolSet,
  type UIMessage,
} from 'ai'
import { Effect, Schedule } from 'effect'
import type { Env } from '#/lib/env'
import { makeFetchRuntime } from '#/effects/runtime'
import { Embedder } from '#/effects/services/embedder'
import { VectorStore } from '#/effects/services/vector-store'
import { toAiSdkToolSet } from './tools/adapter'
import { tools } from './tools'

// MIGRATION-MARKER: @effect/ai
// `streamText` from the Vercel AI SDK is the model-call surface AIChatAgent
// expects (resumable streaming, tool-call protocol). Keep this the only
// place the `ai` package is used.

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'

export class ChatAgent extends AIChatAgent<Env> {
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    options?: { abortSignal?: AbortSignal },
  ): Promise<Response | undefined> {
    const runtime = makeFetchRuntime(this.env)
    const signal = options?.abortSignal ?? new AbortController().signal

    const program = Effect.gen(this, function* () {
      const matches = yield* this.loadContext()
      const modelMessages = yield* Effect.promise(() =>
        convertToModelMessages(this.messages),
      )

      const result = yield* Effect.try({
        try: () =>
          streamText({
            model: this.model(),
            messages: modelMessages,
            tools: toAiSdkToolSet(tools as never),
            system: this.systemPrompt(matches),
            abortSignal: signal,
            onFinish,
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.timeout('120 seconds'),
        Effect.retry({
          schedule: Schedule.jittered(Schedule.exponential('500 millis', 2.0)),
          times: 2,
        }),
      )

      return result.toUIMessageStreamResponse()
    })

    return runtime.runPromise(program, { signal })
  }

  private loadContext() {
    const text = lastUserText(this.messages)
    if (!text) return Effect.succeed([] as const)

    return Effect.gen(function* () {
      const embedder = yield* Embedder
      const store = yield* VectorStore
      const vector = yield* embedder.embed(text)
      return yield* store.query(vector, { topK: 4 })
    }).pipe(Effect.catchAll(() => Effect.succeed([] as const)))
  }

  private model() {
    const openrouter = createOpenRouter({
      apiKey: this.env.OPENROUTER_API_KEY,
      // TODO: route through AI Gateway by setting baseURL once the gateway
      // binding shape is confirmed.
    })
    return openrouter(DEFAULT_MODEL)
  }

  private systemPrompt(
    matches: ReadonlyArray<{ id: string; score: number; metadata?: unknown }>,
  ) {
    const context = matches.length
      ? `\n\nRelevant context (top ${matches.length}):\n` +
        matches
          .map(
            (m) =>
              `- [${m.id}] (score ${m.score.toFixed(3)}) ${JSON.stringify(m.metadata)}`,
          )
          .join('\n')
      : ''
    return (
      [
        'You are an agent for f311x.',
        'Tools let you read and write files in R2, search the knowledge index,',
        'execute commands in a sandbox, schedule research workflows, and',
        'persist agent-authored handlers as Dynamic Workflows.',
      ].join(' ') + context
    )
  }
}

const lastUserText = (messages: ReadonlyArray<UIMessage>): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (!m || m.role !== 'user') continue
    return (m.parts ?? [])
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n')
  }
  return ''
}
