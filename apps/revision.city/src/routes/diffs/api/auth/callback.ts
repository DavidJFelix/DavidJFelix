import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubOAuthCallbackRequest} from '@/diffs/lib/github-auth'

// GitHub redirects here after authorization. Verifies the state cookie,
// exchanges the code for a user access token, and stores the session in an
// HttpOnly cookie. Runs in the worker.
export const Route = createFileRoute('/diffs/api/auth/callback')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubOAuthCallbackRequest(request),
    },
  },
})
