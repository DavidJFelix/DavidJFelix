import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubSessionRequest} from '@/diffs/lib/github-auth'

// Reports the signed-in GitHub login (never the token) so the client can
// render sign-in state. Refreshes expiring sessions as a side effect. Runs in
// the worker.
export const Route = createFileRoute('/diffs/api/auth/session')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubSessionRequest(request),
    },
  },
})
