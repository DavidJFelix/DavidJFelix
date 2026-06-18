// Shared, framework-agnostic source of truth for djf.io's AT Protocol
// (standard.site) integration. Pure -- no `astro:` imports -- so the bun sync
// script in bin/ imports the same helpers the site renders, keeping records and
// pages in step from one place. Structurally simple and unit-tested, mirroring
// src/lib/blog.ts.

// The did:plc identity behind the @djf.io Bluesky handle. Public -- it's served
// at /.well-known/atproto-did and resolvable over DNS -- so it's a committed
// constant, not a secret (only the sync script's app password is). Verified:
// this DID's document lists alsoKnownAs ["at://djf.io"].
export const ATPROTO_DID = 'did:plc:nlbldots3jn3lk6mzca4rqzm'

// Singleton publication record key
export const PUBLICATION_RKEY = '3moldv46oucwc'

// Publication metadata. `name`/`description` reuse the RSS feed strings (see
// src/pages/rss.xml.ts) so the feed and the ATProto record never diverge.
export const PUBLICATION = {
  name: "David J. Felix's Blog",
  description: 'Thoughts on software, running, and life',
  url: 'https://djf.io',
  showInDiscover: true,
} as const

// AT Protocol record-key rules: 1-512 chars from [A-Za-z0-9._:~-], and never
// `.` or `..` (https://atproto.com/specs/record-key).
const RKEY_PATTERN = /^[a-zA-Z0-9.\-_:~]{1,512}$/

// A post's slug (its content-collection id, e.g. "2025-12-07-on-running") is
// already a valid rkey; validate so a malformed slug throws at build/sync time
// instead of writing a broken record.
export function documentRkey(postId: string): string {
  if (postId === '.' || postId === '..' || !RKEY_PATTERN.test(postId)) {
    throw new Error(`Invalid standard.site document rkey: ${JSON.stringify(postId)}`)
  }
  return postId
}

// at://<did>/<collection>/<rkey>. Fully determined by ATPROTO_DID, so the static
// build and the sync script compute identical URIs with no PDS round-trip.
export function publicationUri(): string {
  return `at://${ATPROTO_DID}/site.standard.publication/${PUBLICATION_RKEY}`
}

export function documentUri(postId: string): string {
  return `at://${ATPROTO_DID}/site.standard.document/${documentRkey(postId)}`
}
