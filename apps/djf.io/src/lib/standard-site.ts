// Shared, framework-agnostic source of truth for djf.io's AT Protocol
// (standard.site) integration. Pure -- no `astro:` imports, no I/O -- so the bun
// sync script (bin/sync-standard-site.ts) and the build-time resolver
// (standard-site-resolve.ts) share the same constants, helpers, and reconcile
// planner. Network reads live in the resolver module; writes in the sync script.

// The did:plc identity behind the @djf.io Bluesky handle. Public -- it's served
// at /.well-known/atproto-did and resolvable over DNS -- so it's a committed
// constant, not a secret (only the sync script's app password is). Verified:
// this DID's document lists alsoKnownAs ["at://djf.io"].
export const ATPROTO_DID = 'did:plc:nlbldots3jn3lk6mzca4rqzm'

export const PUBLICATION_COLLECTION = 'site.standard.publication'
export const DOCUMENT_COLLECTION = 'site.standard.document'

// Singleton publication record key: a server-assigned TID, committed once. The
// publication is a singleton, so (unlike per-post documents, whose TIDs are
// resolved live) its key can be a constant and publicationUri() stays offline.
export const PUBLICATION_RKEY = '3moldv46oucwc'

// Publication metadata. `name`/`description` reuse the RSS feed strings (see
// src/pages/rss.xml.ts) so the feed and the ATProto record never diverge.
export const PUBLICATION = {
  name: "David J. Felix's Blog",
  description: 'Thoughts on software, running, and life',
  url: 'https://djf.io',
  showInDiscover: true,
} as const

// The site.standard lexicons require record keys to be TIDs: 13 base32-sortable
// chars with a restricted first char so the high bit is 0 (https://atproto.com/
// specs/tid). Validity is purely syntactic, so this regex is the whole check.
export const TID_PATTERN = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/

export function isTid(rkey: string): boolean {
  return TID_PATTERN.test(rkey)
}

// The stable identifier tying a document record to a blog post. Record keys are
// server-assigned TIDs, so records are matched to posts by this path, not the key.
export function documentPath(slug: string): string {
  return `/blog/${slug}/`
}

// The record key is the last segment of an at:// URI.
export function rkeyFromUri(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1)
}

export function atUri(collection: string, rkey: string): string {
  return `at://${ATPROTO_DID}/${collection}/${rkey}`
}

// Publication URI is fully determined by the committed constant: synchronous,
// offline, deterministic (no PDS round-trip). Document URIs are resolved live --
// see documentUri() in ./standard-site-resolve.
export function publicationUri(): string {
  return atUri(PUBLICATION_COLLECTION, PUBLICATION_RKEY)
}

// --- Reconcile planner (pure; executed by bin/sync-standard-site.ts) ----------
//
// The sync is idempotent: it reuses an existing valid-TID record for a post
// (matched by its path) and updates it in place, otherwise creates one (the PDS
// assigns the TID). It is intentionally non-destructive -- deleting legacy or
// orphaned records is a manual step -- so a deploy can never wipe a record.

export type ExistingRecord = {rkey: string; path?: string; site?: string}

export type DesiredDocument = {slug: string; path: string; record: Record<string, unknown>}

export type DocumentAction =
  | {kind: 'create'; slug: string; record: Record<string, unknown>}
  | {kind: 'update'; rkey: string; slug: string; record: Record<string, unknown>}

export function planDocumentActions(
  existing: ReadonlyArray<ExistingRecord>,
  desired: ReadonlyArray<DesiredDocument>,
  ownerSite: string,
): Array<DocumentAction> {
  // First valid-TID record per path, among records that belong to this
  // publication (matched by `site`) -- documents from other publications sharing
  // the repo are never reused. Legacy non-TID records are ignored too, so the
  // post gets a fresh server-assigned TID instead of reusing a bad key.
  const tidByPath = new Map<string, string>()
  for (const record of existing) {
    if (
      record.site === ownerSite &&
      record.path &&
      isTid(record.rkey) &&
      !tidByPath.has(record.path)
    ) {
      tidByPath.set(record.path, record.rkey)
    }
  }
  return desired.map((doc) => {
    const rkey = tidByPath.get(doc.path)
    return rkey
      ? {kind: 'update', rkey, slug: doc.slug, record: doc.record}
      : {kind: 'create', slug: doc.slug, record: doc.record}
  })
}
