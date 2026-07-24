import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubLoginRequest} from '@/diffs/lib/github-auth'

// Starts the GitHub App sign-in: sets the OAuth state cookie and redirects to
// GitHub's authorize page. Runs in the worker.
export const Route = createFileRoute('/diffs/api/auth/login')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubLoginRequest(request),
    },
  },
})
