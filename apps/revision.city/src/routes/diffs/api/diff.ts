import {createFileRoute} from '@tanstack/react-router'
import {handleDiffRequest} from '@/diffs/lib/diff-endpoint'

// Streaming proxy for upstream patch text: validates the requested GitHub (or
// allow-listed alternate) diff URL, follows authenticated fallbacks when the
// client supplies a token, and streams the diff through so files render as
// they arrive. Runs in the worker.
export const Route = createFileRoute('/diffs/api/diff')({
  server: {
    handlers: {
      GET: ({request}) => handleDiffRequest(request),
    },
  },
})
