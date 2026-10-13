import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
  type WorkflowStepConfig,
} from 'cloudflare:workers'
import {drizzle} from 'drizzle-orm/d1'
import {z} from 'zod'
import {createSqliteChunkReviewStore} from './lib/chunk-review-store'
import {createGitHubRequest} from './lib/github-api'
import {createInstallationTokenSource} from './lib/github-app-auth'
import {createOpenRouterChat} from './lib/openrouter'
import {runReview} from './lib/run-review'
import type {ReviewRunParams} from './lib/webhook'

const reviewWorkflowEnvSchema = z.object({
  DB: z.custom<D1Database>((value) => typeof value === 'object' && value !== null),
  GITHUB_APP_CLIENT_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  REVIEW_MODEL: z.string().min(1),
})

// The retries let a step succeed after a short GitHub or OpenRouter outage. A
// review step runs several tool loops, so it can take minutes.
const STEP_CONFIG = {
  retries: {limit: 3, delay: '30 seconds', backoff: 'exponential'},
  timeout: '15 minutes',
} satisfies WorkflowStepConfig

// One instance reviews one head of one pull request. The webhook route
// (src/routes/api/github/webhook.ts) starts the instances.
export class ReviewWorkflow extends WorkflowEntrypoint<Env, ReviewRunParams> {
  async run(event: Readonly<WorkflowEvent<ReviewRunParams>>, step: WorkflowStep): Promise<void> {
    const env = reviewWorkflowEnvSchema.parse(this.env)
    const {payload} = event
    await runReview({
      ...payload,
      step: (name, run) =>
        step.do(name, STEP_CONFIG, ({attempt}) =>
          // The first attempt is not a retry, so the last attempt is limit + 1.
          run({isLastAttempt: attempt > STEP_CONFIG.retries.limit}),
        ),
      request: createGitHubRequest({
        token: createInstallationTokenSource({
          clientId: env.GITHUB_APP_CLIENT_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY,
          installationId: payload.installationId,
          repositoryId: payload.repositoryId,
        }),
      }),
      chat: createOpenRouterChat({apiKey: env.OPENROUTER_API_KEY}),
      store: createSqliteChunkReviewStore(drizzle(env.DB)),
      model: env.REVIEW_MODEL,
    })
  }
}
