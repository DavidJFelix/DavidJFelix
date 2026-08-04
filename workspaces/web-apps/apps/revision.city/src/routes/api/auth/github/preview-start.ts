import {createFileRoute} from '@tanstack/react-router'
import {handlePreviewSignInStart} from '@/diffs/lib/preview-auth-endpoints'

// Starts brokered sign-in from a per-PR preview: keeps a verifier here and sends only its hash to the broker.
export const Route = createFileRoute('/api/auth/github/preview-start')({
  server: {
    handlers: {
      GET: ({request}) => handlePreviewSignInStart(request),
    },
  },
})
