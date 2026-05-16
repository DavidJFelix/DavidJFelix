// Dynamic Workflow loader: agent-authored TypeScript plans run through
// the Worker Loader binding. The plan source is persisted to R2 keyed by
// agent + plan id; this entrypoint hydrates the loaded module and
// dispatches its `run(event, step)` export.
//
// TODO: verify against the May 2026 Dynamic Workflows docs -- the
// loader protocol has shifted recently.

interface DynamicWorkflowEvent {
  readonly planId: string
  readonly payload: unknown
}
interface WorkflowStep {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>
}

export class DynamicPlanWorkflow {
  constructor(private env: { DYNAMIC_PLANS: unknown }) {}

  async run(event: DynamicWorkflowEvent, step: WorkflowStep) {
    return step.do(`load-${event.planId}`, async () => {
      // const mod = await this.env.DYNAMIC_PLANS.load(event.planId)
      // return mod.run(event, step)
      void this.env
      return { status: 'not-implemented', planId: event.planId }
    })
  }
}
