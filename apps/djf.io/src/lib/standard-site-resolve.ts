// Build-time resolver for standard.site DOCUMENT URIs. Document record keys are
// server-assigned TIDs, so the site learns each post's at:// URI by reading the
// live repo from its PDS at build time. Gated behind STANDARD_SITE_RESOLVE so
// local/CI/e2e/preview builds stay offline and deterministic (links omitted);
// only the production deploy opts in. Every fetch degrades to warn + empty --
// never throws -- so a PDS hiccup can't fail a build. (Publication URIs need no
// lookup: the rkey is a committed constant -- see publicationUri in
// ./standard-site.) This is the only networked module, and is excluded from
// coverage in vitest.config.ts.

import {
  ATPROTO_DID,
  DOCUMENT_COLLECTION,
  documentPath,
  isTid,
  PUBLICATION,
  PUBLICATION_COLLECTION,
  rkeyFromUri,
} from './standard-site'

const PLC_DIRECTORY = 'https://plc.directory'
const FETCH_TIMEOUT_MS = 10_000

// Only the CD deploy's build step sets this; everything else resolves offline.
function resolutionEnabled(): boolean {
  return Boolean(process.env.STANDARD_SITE_RESOLVE)
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)})
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return response.json()
}

// Resolve a did:plc to its atproto PDS endpoint via the PLC directory DID doc.
export async function resolvePdsEndpoint(did: string): Promise<string> {
  const doc = (await getJson(`${PLC_DIRECTORY}/${did}`)) as {
    service?: Array<{id?: string; serviceEndpoint?: string}>
  }
  const endpoint = doc.service?.find((service) =>
    service.id?.endsWith('atproto_pds'),
  )?.serviceEndpoint
  if (!endpoint) throw new Error(`no #atproto_pds service in DID doc for ${did}`)
  return endpoint
}

type RepoRecord = {uri: string; value: Record<string, unknown>}

// Paginated, unauthenticated read of one collection from the repo's PDS,
// via the AT Protocol HTTP API path prefix. cSpell:words xrpc
async function listAllRecords(pdsBase: string, collection: string): Promise<Array<RepoRecord>> {
  const records: Array<RepoRecord> = []
  let cursor: string | undefined
  do {
    const url = new URL('/xrpc/com.atproto.repo.listRecords', pdsBase)
    url.searchParams.set('repo', ATPROTO_DID)
    url.searchParams.set('collection', collection)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('cursor', cursor)
    const page = (await getJson(url.toString())) as {cursor?: string; records?: Array<RepoRecord>}
    if (page.records) records.push(...page.records)
    cursor = page.cursor
  } while (cursor)
  return records
}

// Memoized so a whole build does one fetch for the document collection, not one
// per post. Maps documentPath -> at:// URI for every current document record.
let documentUriMapPromise: Promise<Map<string, string>> | null = null

export function documentUriMap(): Promise<Map<string, string>> {
  documentUriMapPromise ??= buildDocumentUriMap()
  return documentUriMapPromise
}

async function buildDocumentUriMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!resolutionEnabled()) return map
  try {
    const pds = await resolvePdsEndpoint(ATPROTO_DID)
    // djf.io's publication is the one whose url is PUBLICATION.url (found by url,
    // not by record key); its AT-URI is what djf.io's documents carry as `site`.
    const publications = await listAllRecords(pds, PUBLICATION_COLLECTION)
    const ownPublicationUri = publications.find(
      (record) => record.value.url === PUBLICATION.url,
    )?.uri
    if (!ownPublicationUri) return map
    const records = await listAllRecords(pds, DOCUMENT_COLLECTION)
    for (const record of records) {
      const {path, site} = record.value
      // Only djf.io's documents: those whose `site` is this publication's AT-URI.
      // Documents from any other publication sharing the repo are excluded.
      if (
        typeof path !== 'string' ||
        site !== ownPublicationUri ||
        map.has(path) ||
        !isTid(rkeyFromUri(record.uri))
      ) {
        continue
      }
      map.set(path, record.uri)
    }
    return map
  } catch (error) {
    console.warn(`standard.site: document URI resolution failed; omitting links (${String(error)})`)
    return new Map()
  }
}

// The site.standard.document at:// URI for a post slug, or null when no record is
// published / resolution is disabled (the <link> is then omitted).
export async function documentUri(slug: string): Promise<string | null> {
  return (await documentUriMap()).get(documentPath(slug)) ?? null
}
