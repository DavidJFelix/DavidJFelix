// Dynamic Workflow loader: agent-authored TypeScript plans run through
// the Worker Loader binding. The plan source is persisted to R2 keyed by
// agent + plan id; this entrypoint hydrates the loaded module and
// dispatches its `run(event, step)` export.
//
// TODO: verify against the May 2026 Dynamic Workflows docs -- the
// loader protocol has shifted recently. The `env.DYNAMIC_PLANS` shape
// below is intentionally typed as `unknown` until the binding contract
// is confirmed.

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'
import type { Env } from '#/lib/env'

export interface DynamicPlanPayload {
  planId: string
  args?: unknown
}

export class DynamicPlanWorkflow extends WorkflowEntrypoint<Env, DynamicPlanPayload> {
  async run(
    event: Readonly<WorkflowEvent<DynamicPlanPayload>>,
    step: WorkflowStep,
  ) {
    return step.do(`load-${event.payload.planId}`, async () => {
      // const mod = await this.env.DYNAMIC_PLANS.load(event.payload.planId)
      // return mod.run(event, step)
      return { status: 'not-implemented', planId: event.payload.planId }
    })
  }
}
