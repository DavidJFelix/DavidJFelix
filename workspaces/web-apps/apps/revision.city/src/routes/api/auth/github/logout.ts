import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubLogoutRequest} from '@/diffs/lib/github-auth'

// Revokes the GitHub token, clears the session cookie, and returns to the
// referring diffs page. POST only, so a link on another site cannot sign a
// visitor out. Runs in the worker.
export const Route = createFileRoute('/api/auth/github/logout')({
  server: {
    handlers: {
      POST: ({request}) => handleGitHubLogoutRequest(request),
    },
  },
})
