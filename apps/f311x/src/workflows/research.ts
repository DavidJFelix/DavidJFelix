// Static Workflow: research.
// Each `step.do` runs a small Effect via `Effect.runPromise`. Uses
// `step.sleep` and `step.waitForEvent` for pacing and approval gates.

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import { Effect } from 'effect'
import type { Env } from '#/lib/env'

interface ResearchPayload {
  topic: string
  depth: 'shallow' | 'medium' | 'deep'
}

interface ResearchResult {
  topic: string
  notes: string[]
}

export class ResearchWorkflow extends WorkflowEntrypoint<Env, ResearchPayload> {
  async run(
    event: Readonly<WorkflowEvent<ResearchPayload>>,
    step: WorkflowStep,
  ): Promise<ResearchResult> {
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
      await step.waitForEvent('await-human-approval', {
        type: 'approve',
        timeout: '24 hours',
      })
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
  Effect.succeed<Source[]>([
    { id: 'placeholder-1', url: `https://example.com/${encodeURIComponent(topic)}` },
  ])

const summarize = (source: Source) =>
  Effect.succeed(`summary of ${source.url}`)

const synthesize = (topic: string, notes: ReadonlyArray<string>): Effect.Effect<ResearchResult> =>
  Effect.succeed({ topic, notes: [...notes] })
