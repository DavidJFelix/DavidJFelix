import {createFileRoute} from '@tanstack/react-router'
import {handleEntityDiffRequest} from '@/symbols/lib/entity-diff-endpoint'

// Streams the entities that changed in a batch of a diff's files, one
// newline-delimited JSON result per file as it lands. Parses both revisions in
// the worker, so the browser never loads a grammar and never issues one request
// per file.
export const Route = createFileRoute('/api/diffs/entity-diff')({
  server: {
    handlers: {
      POST: ({request}) => handleEntityDiffRequest(request),
    },
  },
})
