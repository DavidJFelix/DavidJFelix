import {createFileRoute} from '@tanstack/react-router'
import {handleInboxListRequest} from '@/inbox/lib/inbox-list'

// Lists the open pull requests of the signed-in visitor for the inbox, each one time with all its
// reasons. GitHub auth comes from the session cookie, never from the client request. Runs in the
// worker.
export const Route = createFileRoute('/api/inbox')({
  server: {
    handlers: {
      GET: ({request}) => handleInboxListRequest(request),
    },
  },
})
