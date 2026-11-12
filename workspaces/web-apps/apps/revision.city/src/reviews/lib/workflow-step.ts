import type {WorkflowStepConfig} from 'cloudflare:workers'
import type {RunStep} from './run-review'

// The part of the Workflow step that createRunStep calls. WorkflowStep satisfies it.
export interface DurableStep {
  do: <Result extends Rpc.Serializable<Result>>(
    name: string,
    config: WorkflowStepConfig,
    run: (context: {attempt: number}) => Promise<Result>,
  ) => Promise<Result>
}

export interface CreateRunStepParams {
  step: DurableStep
  config: WorkflowStepConfig & {retries: {limit: number}}
}

export const createRunStep =
  ({step, config}: CreateRunStepParams): RunStep =>
  (name, run) =>
    step.do(name, config, ({attempt}) =>
      // The first attempt is not a retry, so the last attempt is limit + 1.
      run({attempt, isLastAttempt: attempt > config.retries.limit}),
    )
