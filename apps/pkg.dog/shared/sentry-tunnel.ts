// The Sentry tunnel: a first-party relay for browser error/trace envelopes.
//
// The browser SDK normally POSTs envelopes straight to `*.ingest.sentry.io`,
// which ad/tracker blockers drop -- so a chunk of real-user errors never arrive.
// Setting the SDK's `tunnel` to a same-origin path makes it POST here instead;
// the on-demand /bugs endpoint (src/routes/bugs.ts) forwards the envelope on to
// Sentry's ingest API server-side, where no blocker can see it. Blockers match
// Sentry's ingest *hosts*, not arbitrary first-party paths, so the relay slips
// through.
//
// `forwardEnvelope` is the whole relay. It is the security boundary: it forwards
// only to a genuine Sentry ingest host (so a forged envelope DSN can't turn the
// route into an open proxy to arbitrary origins) and, when given the site's own
// DSN, only for that exact project (so nobody else can relay their telemetry
// through this domain).

// The path the SDK tunnels through and the endpoint serves. Single source of
// truth, imported by both the client bootstrap and src/routes/bugs.ts. Neutral
// on purpose -- it must not read as "sentry"/"telemetry", or blockers would match
// the path too. Keep it clear of real routes (no `/bugs` page exists).
export const SENTRY_TUNNEL_ROUTE = '/bugs'

// A Sentry SaaS ingest host: `o<org>.ingest.sentry.io` or a regional
// `o<org>.ingest.<region>.sentry.io`. Anchored end to end so only these hosts
// are ever forwarded to.
const SENTRY_INGEST_HOST = /^[a-z0-9-]+\.ingest\.(?:[a-z0-9-]+\.)?sentry\.io$/i

type DsnIdentity = {host: string; projectId: string}

export type TunnelOptions = {
  // The site's own public Sentry DSN. When set, envelopes are relayed only if
  // their DSN points at this exact project; omitted (e.g. local dev) leaves just
  // the ingest-host guard, which is still safe against open-proxy abuse.
  allowedDsn?: string
}

// When tunneling, the SDK puts the DSN in the envelope header -- the first line
// of the NDJSON body -- precisely so the relay knows where to forward.
function readEnvelopeDsn(envelope: string): string | undefined {
  const newline = envelope.indexOf('\n')
  const header = newline === -1 ? envelope : envelope.slice(0, newline)
  try {
    const parsed: unknown = JSON.parse(header)
    const dsn = (parsed as {dsn?: unknown})?.dsn
    return typeof dsn === 'string' ? dsn : undefined
  } catch {
    return undefined
  }
}

// Parse a DSN into the host + numeric project id used to build its ingest URL,
// or undefined if it is not a well-formed https Sentry ingest DSN.
function dsnIdentity(dsn: string): DsnIdentity | undefined {
  let url: URL
  try {
    url = new URL(dsn)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  if (!SENTRY_INGEST_HOST.test(url.hostname)) return undefined
  const projectId = url.pathname.replace(/^\/+/, '')
  if (!/^\d+$/.test(projectId)) return undefined
  return {host: url.hostname, projectId}
}

// Forward one tunneled Sentry envelope to its ingest endpoint. Returns the
// upstream response on success, or a bare status (405/400/403) when the request
// is rejected before any forward -- so a rejected call never touches Sentry.
// `fetchImpl` is injectable for tests; production uses global fetch.
export async function forwardEnvelope(
  request: Request,
  options: TunnelOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, {status: 405, headers: {allow: 'POST'}})

  const envelope = await request.text()
  const dsn = readEnvelopeDsn(envelope)
  if (!dsn) return new Response(null, {status: 400})

  const target = dsnIdentity(dsn)
  if (!target) return new Response(null, {status: 400})

  if (options.allowedDsn) {
    const allowed = dsnIdentity(options.allowedDsn)
    if (!allowed || allowed.host !== target.host || allowed.projectId !== target.projectId) {
      return new Response(null, {status: 403})
    }
  }

  return fetchImpl(`https://${target.host}/api/${target.projectId}/envelope/`, {
    method: 'POST',
    body: envelope,
    headers: {'content-type': 'application/x-sentry-envelope'},
  })
}
