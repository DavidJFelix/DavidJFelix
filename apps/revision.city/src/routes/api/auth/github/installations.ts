import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubManageAccessRequest} from '@/diffs/lib/github-auth'

// Redirects to GitHub's page for editing which repositories the app can read.
// Signing in with GitHub authorizes the app but grants it no repository, so this
// is the way to close that gap ahead of hitting a diff that needs it. Runs in
// the worker.
export const Route = createFileRoute('/api/auth/github/installations')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubManageAccessRequest(request),
    },
  },
})
