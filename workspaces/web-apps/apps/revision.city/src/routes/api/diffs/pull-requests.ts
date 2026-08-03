import {createFileRoute} from '@tanstack/react-router'
import {handlePullRequestListRequest} from '@/diffs/lib/github-pull-requests'

// Lists open pull requests the signed-in visitor can reach, grouped by why
// they can reach them: assigned to them, then their own repositories, then
// repositories they are a member of, then ones they watch. GitHub auth comes
// from the session cookie, never from the client request. Runs in the worker.
export const Route = createFileRoute('/api/diffs/pull-requests')({
  server: {
    handlers: {
      GET: ({request}) => handlePullRequestListRequest(request),
    },
  },
})
