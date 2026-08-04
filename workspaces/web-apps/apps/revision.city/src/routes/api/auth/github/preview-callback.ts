import {createFileRoute} from '@tanstack/react-router'
import {handlePreviewSignInCallback} from '@/diffs/lib/preview-auth-endpoints'

// Lands the sealed handoff from the broker and redeems it server-to-server, then writes this origin's session cookie.
export const Route = createFileRoute('/api/auth/github/preview-callback')({
  server: {
    handlers: {
      GET: ({request}) => handlePreviewSignInCallback(request),
    },
  },
})
