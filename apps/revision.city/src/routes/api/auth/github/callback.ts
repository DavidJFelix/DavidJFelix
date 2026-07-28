import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubOAuthCallbackRequest} from '@/diffs/lib/github-auth'

// GitHub redirects here after authorization. Verifies the state cookie,
// exchanges the code for a user access token, and stores the session in an
// HttpOnly cookie. Also where GitHub lands the browser after the app is
// installed (?setup_action=...), which carries no verifiable state and is
// answered with a redirect back into the app instead. Runs in the worker.
export const Route = createFileRoute('/api/auth/github/callback')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubOAuthCallbackRequest(request),
    },
  },
})
