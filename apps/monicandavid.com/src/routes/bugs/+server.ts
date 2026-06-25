import {forwardEnvelope} from '$lib/sentry-tunnel'
import type {RequestHandler} from './$types'

// The Sentry tunnel endpoint. The browser SDK POSTs error/trace envelopes here
// (a same-origin path ad/tracker blockers don't drop) and this forwards them to
// Sentry's ingest API. Runs in the SvelteKit worker. forwardEnvelope 405s
// anything but POST, so the `fallback` handler covers the SDK's POSTs and rejects
// the rest. The DSN is inlined at build (VITE_PUBLIC_SENTRY_DSN -- the same value
// the client bundle uses), pinning the tunnel to this app's project; unset in
// dev/preview, where the ingest-host guard still holds.
export const fallback: RequestHandler = ({request}) =>
  forwardEnvelope(request, {allowedDsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN})
