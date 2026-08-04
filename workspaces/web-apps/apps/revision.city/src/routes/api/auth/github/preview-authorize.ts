import {createFileRoute} from '@tanstack/react-router'
import {handlePreviewBrokerAuthorize} from '@/diffs/lib/preview-auth-endpoints'

// Broker side: seals this broker's session for an allowlisted preview origin, after requiring sign-in here.
export const Route = createFileRoute('/api/auth/github/preview-authorize')({
  server: {
    handlers: {
      GET: ({request}) => handlePreviewBrokerAuthorize(request),
    },
  },
})
