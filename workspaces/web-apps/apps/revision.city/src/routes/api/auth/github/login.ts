import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubLoginRequest} from '@/diffs/lib/github-auth'

// Starts the GitHub App sign-in: sets the OAuth state cookie and redirects to
// GitHub's authorize page. On a per-PR preview it instead hands off to the dev
// worker, which runs the dance on its own GitHub App and brings the
// authorization code back here. Runs in the worker.
export const Route = createFileRoute('/api/auth/github/login')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubLoginRequest(request),
    },
  },
})
