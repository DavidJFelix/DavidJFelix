import {createFileRoute} from '@tanstack/react-router'
import {handleGitHubDiffFileRequest} from '@/diffs/lib/github-diff-file-endpoint'

// Expands a diff entry into full old/new file contents through the GitHub API
// (token required) so the viewer can show unchanged context. Runs in the
// worker.
export const Route = createFileRoute('/diffs/api/github-diff-file')({
  server: {
    handlers: {
      GET: ({request}) => handleGitHubDiffFileRequest(request),
    },
  },
})
