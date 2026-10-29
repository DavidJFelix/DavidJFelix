import {createFileRoute} from '@tanstack/react-router'
import {createGitHubRequest} from '@/reviews/lib/github-api'
import {createInstallationTokenSource} from '@/reviews/lib/github-app-auth'
import {syncCheckRunWithThreads} from '@/reviews/lib/resolved-threads'
import {handleReviewWebhook, type ThreadSyncParams} from '@/reviews/lib/webhook'

// The GitHub App's webhook. A signed pull request event from an allowed
// repository can start a review (src/reviews/review-workflow.ts).
// `decideReviewRun` holds the trigger rules. A resolved or reopened thread of
// the app makes the check run agree with the threads again. Runs in the worker.
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
                syncCheckRun: ({
                  installationId,
                  repositoryId,
                  owner,
                  name,
                  pullNumber,
                }: ThreadSyncParams) =>
                  syncCheckRunWithThreads({
                    request: createGitHubRequest({
                      token: createInstallationTokenSource({
                        clientId,
                        privateKey,
                        installationId,
                        repositoryId,
                      }),
                    }),
                    repository: {owner, name},
                    pullNumber,
                  }),
              }
            : {}),
        })
      },
    },
  },
})
