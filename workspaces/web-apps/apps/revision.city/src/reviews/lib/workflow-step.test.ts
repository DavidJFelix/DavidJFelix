// @vitest-environment node

import type {WorkflowStepConfig} from 'cloudflare:workers'
import {expect, test} from 'vitest'
import type {StepAttempt} from './run-review'
import {createRunStep, type DurableStep} from './workflow-step'

const config = {retries: {limit: 3, delay: '30 seconds', backoff: 'exponential'}} as const

// Cloudflare calls the step body with attempt 1 first and adds 1 for each retry.
const retryingStep: DurableStep = {
  do: async <Result extends Rpc.Serializable<Result>>(
    _name: string,
    stepConfig: WorkflowStepConfig,
    run: (context: {attempt: number}) => Promise<Result>,
  ) => {
    const tryAttempt = async (attempt: number): Promise<Result> => {
      try {
        return await run({attempt})
      } catch (error) {
        if (attempt > (stepConfig.retries?.limit ?? 0)) throw error
        return tryAttempt(attempt + 1)
      }
    }
    return tryAttempt(1)
  },
}

test.each([
  {failures: 0, expected: [{attempt: 1, isLastAttempt: false}]},
  {
    failures: 3,
    expected: [
      {attempt: 1, isLastAttempt: false},
      {attempt: 2, isLastAttempt: false},
      {attempt: 3, isLastAttempt: false},
      {attempt: 4, isLastAttempt: true},
    ],
  },
])(
  'marks only attempt limit + 1 as last after $failures failures',
  async ({failures, expected}) => {
    const seen: StepAttempt[] = []
    const runStep = createRunStep({step: retryingStep, config})
    const result = await runStep('review 1 of 1', async (attempt) => {
      seen.push(attempt)
      if (seen.length <= failures) throw new Error('outage')
      return 'done'
    })
    expect(result).toBe('done')
    expect(seen).toEqual(expected)
  },
)
