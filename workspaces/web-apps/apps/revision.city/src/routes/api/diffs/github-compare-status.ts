import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubCompareStatusRequest} from '@/diffs/lib/github-compare-status-endpoint'

// Counts the commits a GitHub compare's base branch gained after the merge
// base, so the viewer can say that the base moved on. Runs in the worker.
export const Route = createFileRoute('/api/diffs/github-compare-status')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubCompareStatusRequest(request),
    },
  },
})
