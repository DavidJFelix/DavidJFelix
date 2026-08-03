import {defineEventHandler, toWebRequest} from 'h3'
import {forwardEnvelope} from '../../shared/sentry-tunnel'

// The Sentry tunnel endpoint. The browser SDK POSTs error/trace envelopes here
// (a same-origin path ad/tracker blockers don't drop) and this forwards them to
// Sentry's ingest API. Runs in the Nitro worker. forwardEnvelope 405s anything
// but POST. Project-pinning (allowedDsn) is skipped here because the DSN is a
// runtime worker var rather than a build-time literal; the ingest-host guard
// still forwards only to genuine Sentry hosts, keeping it safe against open-proxy
// abuse.
export default defineEventHandler((event) => forwardEnvelope(toWebRequest(event)))
