import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubAuthConfigRequest} from '@/diffs/lib/github-auth'

// Reports whether this deploy has GitHub App credentials and the exact OAuth
// callback URL it will ask GitHub for. Open it on a preview to get the URL that
// has to be registered on the GitHub App before sign-in works there. Never
// returns a credential value.
export const Route = createFileRoute('/api/auth/github/config')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubAuthConfigRequest(request),
    },
  },
})
