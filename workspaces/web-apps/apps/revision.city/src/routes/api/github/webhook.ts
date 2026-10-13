import {createFileRoute} from '@tanstack/react-router'
import {handleReviewWebhook} from '@/reviews/lib/webhook'

// The GitHub App's webhook. A signed pull request event from an allowed
// repository can start a review (src/reviews/review-workflow.ts).
// `decideReviewRun` holds the trigger rules. Runs in the worker.
export const Route = createFileRoute('/api/github/webhook')({
  server: {
    handlers: {
      POST: async ({request}) => {
        // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
        // environment.
        const {env} = await import('cloudflare:workers')
        return handleReviewWebhook({
          request,
          secret: process.env.GITHUB_WEBHOOK_SECRET,
          workflow: env.REVIEW_WORKFLOW,
        })
      },
    },
  },
})
