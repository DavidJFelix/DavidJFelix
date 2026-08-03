import type {APIRoute} from 'astro'
import {ATPROTO_DID} from '../../lib/standard-site'

// AT Protocol HTTP handle verification: resolvers fetch
// https://djf.io/.well-known/atproto-did and expect the bare did:plc as plain
// text, tying the @djf.io handle to this identity. Complements the DNS
// _atproto.djf.io TXT record -- either method satisfies handle resolution.
export const GET: APIRoute = () =>
  new Response(ATPROTO_DID, {headers: {'content-type': 'text/plain; charset=utf-8'}})
