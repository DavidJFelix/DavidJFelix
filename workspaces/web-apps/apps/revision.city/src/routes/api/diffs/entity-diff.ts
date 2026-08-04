import {createFileRoute} from '@tanstack/react-router'
import {handleEntityDiffRequest} from '@/symbols/lib/entity-diff-endpoint'

// Names the entities that changed in one file of a diff (GitHub sign-in
// required). Parses both revisions in the worker so the browser never loads a
// grammar, and so the answer can be cached per revision pair.
export const Route = createFileRoute('/api/diffs/entity-diff')({
  server: {
    handlers: {
      GET: ({request}) => handleEntityDiffRequest(request),
    },
  },
})
