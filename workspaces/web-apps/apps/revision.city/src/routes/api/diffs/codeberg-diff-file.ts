import {createFileRoute} from '@tanstack/react-router'
import {handleCodebergDiffFileRequest} from '@/diffs/lib/codeberg-diff-file-endpoint'

// Expands a Codeberg diff entry into full old/new file contents through the
// Codeberg API (public repositories only) so the viewer can show unchanged
// context. Runs in the worker.
export const Route = createFileRoute('/api/diffs/codeberg-diff-file')({
  server: {
    handlers: {
      GET: ({request}) => handleCodebergDiffFileRequest(request),
    },
  },
})
