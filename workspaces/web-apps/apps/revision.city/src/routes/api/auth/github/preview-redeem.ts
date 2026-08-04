import {createFileRoute} from '@tanstack/react-router'
import {handlePreviewBrokerRedeem} from '@/diffs/lib/preview-auth-endpoints'

// Broker side: exchanges a sealed handoff plus its verifier for the session.
// POST because it is called server-to-server by the preview, never navigated to,
// and the verifier must not land in a URL.
export const Route = createFileRoute('/api/auth/github/preview-redeem')({
  server: {
    handlers: {
      POST: ({request}) => handlePreviewBrokerRedeem(request),
    },
  },
})
