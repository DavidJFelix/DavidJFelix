import {createFileRoute} from '@tanstack/react-router'
import {dismissCheckRun} from '@/reviews/lib/dismiss-check-run'
import {createGitHubRequest} from '@/reviews/lib/github-api'
import {
  type CreateInstallationTokenSourceParams,
  createInstallationTokenSource,
} from '@/reviews/lib/github-app-auth'
import {syncCheckRunWithThreads} from '@/reviews/lib/resolved-threads'
import {handleReviewWebhook} from '@/reviews/lib/webhook'

const installationRequest = (params: CreateInstallationTokenSourceParams) =>
  createGitHubRequest({token: createInstallationTokenSource(params)})

// The GitHub App's webhook. A signed pull request event from an allowed
// repository can start a review (src/reviews/review-workflow.ts).
// `decideReviewRun` holds the trigger rules. A resolved or reopened thread of
// the app makes the check run agree with the threads again, and the dismiss
// button passes a failed check run. Runs in the worker.
export const Route = createFileRoute('/api/github/webhook')({
  server: {
    handlers: {
      POST: async ({request}) => {
        // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
        // environment.
        const {env} = await import('cloudflare:workers')
        const clientId = process.env.GITHUB_APP_CLIENT_ID
        const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
        return handleReviewWebhook({
          request,
          secret: process.env.GITHUB_WEBHOOK_SECRET,
          workflow: env.REVIEW_WORKFLOW,
          ...(clientId && privateKey
            ? {
                syncCheckRun: ({owner, name, pullNumber, ...installation}) =>
                  syncCheckRunWithThreads({
                    request: installationRequest({clientId, privateKey, ...installation}),
                    repository: {owner, name},
                    pullNumber,
                  }),
                dismissCheckRun: ({owner, name, checkRunId, login, ...installation}) =>
                  dismissCheckRun({
                    request: installationRequest({clientId, privateKey, ...installation}),
                    repository: {owner, name},
                    checkRunId,
                    clickedBy: login,
                  }),
              }
            : {}),
        })
      },
    },
  },
})
