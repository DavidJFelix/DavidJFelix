import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubLoginRequest} from '@/diffs/lib/github-auth'
import {handlePreviewSignInStart, shouldBrokerSignIn} from '@/diffs/lib/preview-auth-endpoints'

// Starts the GitHub App sign-in: sets the OAuth state cookie and redirects to
// GitHub's authorize page. Runs in the worker.
//
// A per-PR preview cannot do that itself -- GitHub rejects a redirect_uri it
// does not know, and no wildcard can be registered for per-PR hostnames -- so it
// hands off to a broker instead. Branching here rather than in the UI keeps one
// sign-in entry point: the button is the same everywhere.
export const Route = createFileRoute('/api/auth/github/login')({
  server: {
    handlers: {
      GET: ({request}) =>
        shouldBrokerSignIn(request)
          ? handlePreviewSignInStart(request)
          : handleGitHubLoginRequest(request),
    },
  },
})
