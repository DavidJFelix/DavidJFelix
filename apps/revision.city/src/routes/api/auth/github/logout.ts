import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubLogoutRequest} from '@/diffs/lib/github-auth'

// Clears the GitHub session cookie and returns to the referring diffs page.
// Runs in the worker.
export const Route = createFileRoute('/api/auth/github/logout')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubLogoutRequest(request),
    },
  },
})
