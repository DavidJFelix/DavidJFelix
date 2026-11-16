import {createFileRoute} from '@tanstack/react-router'
import {handleSymbolDiffRequest} from '@/symbols/lib/symbol-diff-endpoint'

// Streams the symbols that changed in a batch of a diff's files, one
// newline-delimited JSON result per file as it lands. Parses both revisions in
// the worker, so the browser never loads a grammar and never issues one request
// per file.
export const Route = createFileRoute('/api/diffs/entity-diff')({
  server: {
    handlers: {
      POST: ({request}) => handleSymbolDiffRequest(request),
    },
  },
})
