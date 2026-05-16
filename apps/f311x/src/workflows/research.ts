// Static Workflow: research.
// Each `step.do` runs a small Effect via `Effect.runPromise`. Uses
// `step.sleep` and `step.waitForEvent` for pacing and approval gates.

import { Effect } from 'effect'

// TODO: import the real `WorkflowEntrypoint` from `cloudflare:workers`
// once the binding shape is verified.
interface WorkflowEvent<P> {
  readonly payload: P
}
interface WorkflowStep {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>
  sleep(name: string, duration: string): Promise<void>
  waitForEvent<T>(name: string, opts: { type: string }): Promise<T>
}

export class ResearchWorkflow {
  async run(
    event: WorkflowEvent<{ topic: string; depth: 'shallow' | 'medium' | 'deep' }>,
    step: WorkflowStep,
  ) {
    const sources = await step.do('discover-sources', () =>
      Effect.runPromise(discoverSources(event.payload.topic)),
    )

    const notes: string[] = []
    for (const source of sources) {
      const note = await step.do(`summarize-${source.id}`, () =>
        Effect.runPromise(summarize(source)),
      )
      notes.push(note)
    }

    if (event.payload.depth === 'deep') {
      await step.waitForEvent('await-human-approval', { type: 'approve' })
    }

    return step.do('synthesize', () =>
      Effect.runPromise(synthesize(event.payload.topic, notes)),
    )
  }
}

// --- placeholder Effects -----------------------------------------------

interface Source {
  id: string
  url: string
}

const discoverSources = (topic: string) =>
  Effect.succeed<ReadonlyArray<Source>>([
    { id: 'placeholder-1', url: `https://example.com/${encodeURIComponent(topic)}` },
  ])

const summarize = (source: Source) =>
  Effect.succeed(`summary of ${source.url}`)

const synthesize = (topic: string, notes: ReadonlyArray<string>) =>
  Effect.succeed({ topic, notes: [...notes] })
