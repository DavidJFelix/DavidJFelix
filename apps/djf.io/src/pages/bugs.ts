import type {APIRoute} from 'astro'
import {forwardEnvelope} from '../lib/sentry-tunnel'

// The Sentry tunnel endpoint. The browser SDK POSTs error/trace envelopes here
// (a same-origin path ad/tracker blockers don't drop) and this route forwards
// them to Sentry's ingest API. One of two on-demand routes on the site (see also
// src/pages/ingest/[...path].ts) -- every page stays prerendered.
// Its filename must match SENTRY_TUNNEL_ROUTE in src/lib/sentry-tunnel.ts.
export const prerender = false

// All methods funnel through forwardEnvelope, which 405s anything but POST. The
// DSN is inlined at build (import.meta.env.PUBLIC_SENTRY_DSN -- the same value
// the client bundle uses), pinning the tunnel to djf.io's own project; unset in
// local/CI/preview builds, where the ingest-host guard still holds.
export const ALL: APIRoute = ({request}) =>
  forwardEnvelope(request, {allowedDsn: import.meta.env.PUBLIC_SENTRY_DSN})
