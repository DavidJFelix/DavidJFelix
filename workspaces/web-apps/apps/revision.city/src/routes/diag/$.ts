import {createFileRoute} from '@tanstack/react-router'
import {proxyToPostHog} from '@/lib/posthog-proxy'

// Reverse-proxies /diag/* to PostHog at request time so analytics ride this
// first-party origin instead of *.posthog.com (which content blockers drop).
// Runs in the worker; the client SDK is pointed here in src/observability/client.
export const Route = createFileRoute('/diag/$')({
  server: {
    handlers: {
      ANY: ({request}) => proxyToPostHog(request),
    },
  },
})
