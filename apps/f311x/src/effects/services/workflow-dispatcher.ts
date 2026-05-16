import { Context, Data, Effect, Layer } from 'effect'
import type { Env } from '#/lib/env'

export class WorkflowDispatchError extends Data.TaggedError(
  'WorkflowDispatchError',
)<{
  readonly name: string
  readonly cause: unknown
}> {}

export interface WorkflowHandle {
  readonly id: string
  readonly status: () => Effect.Effect<{ status: string }, WorkflowDispatchError>
}

export interface WorkflowDispatcher {
  readonly startResearch: (
    params: unknown,
  ) => Effect.Effect<WorkflowHandle, WorkflowDispatchError>
  readonly startDynamicPlan: (
    planId: string,
    params: unknown,
  ) => Effect.Effect<WorkflowHandle, WorkflowDispatchError>
}

export const WorkflowDispatcher = Context.GenericTag<WorkflowDispatcher>(
  '@f311x/WorkflowDispatcher',
)

const toHandle = (
  name: string,
  instance: { id: string; status: () => Promise<{ status: string }> },
): WorkflowHandle => ({
  id: instance.id,
  status: () =>
    Effect.tryPromise({
      try: () => instance.status(),
      catch: (cause) => new WorkflowDispatchError({ name, cause }),
    }),
})

export const WorkflowDispatcherLive = (env: Env) =>
  Layer.succeed(
    WorkflowDispatcher,
    WorkflowDispatcher.of({
      startResearch: (params) =>
        Effect.tryPromise({
          try: () => env.RESEARCH_WORKFLOW.create({ params }),
          catch: (cause) => new WorkflowDispatchError({ name: 'research', cause }),
        }).pipe(Effect.map((i) => toHandle('research', i))),
      startDynamicPlan: (planId, params) =>
        Effect.tryPromise({
          // TODO: wire to Worker Loader-backed Dynamic Workflow once the
          // protocol is verified against current docs (the May 2026
          // Dynamic Workflows post).
          try: async () => {
            void env
            void planId
            void params
            return {
              id: 'pending',
              status: async () => ({ status: 'not-provisioned' }),
            }
          },
          catch: (cause) =>
            new WorkflowDispatchError({ name: 'dynamic-plan', cause }),
        }).pipe(Effect.map((i) => toHandle('dynamic-plan', i))),
    }),
  )
