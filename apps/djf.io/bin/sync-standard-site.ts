// Syncs djf.io's blog to its AT Protocol (standard.site) records on bsky.social:
// one site.standard.publication (committed-constant TID rkey) plus one
// site.standard.document per post (server-assigned TID rkey, matched to the post
// by its `path`). Idempotent and non-destructive: it upserts the publication and
// creates missing / updates existing documents, but never deletes -- migrating
// or pruning legacy records is a manual step. Safe to run on every deploy.
// Reuses the helpers and reconcile planner the site renders with
// (../src/lib/standard-site.ts); writes nothing back to the repo.
//
// Auth uses ATPROTO_APP_PASSWORD (a Bluesky app password -- never committed);
// the DID is public and lives in the shared module.
// Run: mise run sync-standard-site.

import {readdir, readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {AtpAgent} from '@atproto/api'
import matter from 'gray-matter'
import {
  ATPROTO_DID,
  DOCUMENT_COLLECTION,
  documentPath,
  type ExistingRecord,
  PUBLICATION,
  PUBLICATION_COLLECTION,
  PUBLICATION_RKEY,
  planDocumentActions,
  rkeyFromUri,
} from '../src/lib/standard-site'

const BLOG_DIR = fileURLToPath(new URL('../src/content/blog', import.meta.url))

type Frontmatter = {
  title: string
  description: string
  date: string | Date
  tags?: Array<string>
}

async function loadPosts(): Promise<Array<{slug: string; data: Frontmatter}>> {
  const entries = await readdir(BLOG_DIR, {recursive: true})
  const posts: Array<{slug: string; data: Frontmatter}> = []
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const slug = entry.slice(0, -'.md'.length)
    const raw = await readFile(`${BLOG_DIR}/${entry}`, 'utf8')
    posts.push({slug, data: matter(raw).data as Frontmatter})
  }
  return posts
}

async function connect(): Promise<AtpAgent> {
  const password = process.env.ATPROTO_APP_PASSWORD
  if (!password) {
    throw new Error('ATPROTO_APP_PASSWORD is not set; cannot sync standard.site records.')
  }
  const agent = new AtpAgent({service: 'https://bsky.social'})
  await agent.login({identifier: 'djf.io', password})
  // Guard against a wrong account or a typo'd DID before any write.
  if (agent.session?.did !== ATPROTO_DID) {
    throw new Error(
      `Logged in as ${agent.session?.did}, expected ${ATPROTO_DID}; refusing to write.`,
    )
  }
  return agent
}

async function listExisting(agent: AtpAgent, collection: string): Promise<Array<ExistingRecord>> {
  const records: Array<ExistingRecord> = []
  let cursor: string | undefined
  do {
    const {data} = await agent.com.atproto.repo.listRecords({
      repo: ATPROTO_DID,
      collection,
      limit: 100,
      cursor,
    })
    for (const record of data.records) {
      const value = record.value as {path?: unknown; site?: unknown}
      records.push({
        rkey: rkeyFromUri(record.uri),
        path: typeof value.path === 'string' ? value.path : undefined,
        site: typeof value.site === 'string' ? value.site : undefined,
      })
    }
    cursor = data.cursor
  } while (cursor)
  return records
}

function documentRecord(slug: string, data: Frontmatter): Record<string, unknown> {
  return {
    $type: DOCUMENT_COLLECTION,
    // Reference the publication by its url (djf.io is the one publication with
    // this url), so ownership doesn't depend on the publication's record key.
    site: PUBLICATION.url,
    title: data.title,
    publishedAt: new Date(data.date).toISOString(),
    path: documentPath(slug),
    description: data.description,
    ...(data.tags ? {tags: data.tags} : {}),
  }
}

async function syncPublication(agent: AtpAgent): Promise<void> {
  // putRecord upserts at the committed-constant rkey; the legacy `self` record,
  // if any, is left for manual cleanup.
  await agent.com.atproto.repo.putRecord({
    repo: ATPROTO_DID,
    collection: PUBLICATION_COLLECTION,
    rkey: PUBLICATION_RKEY,
    record: {
      $type: PUBLICATION_COLLECTION,
      url: PUBLICATION.url,
      name: PUBLICATION.name,
      description: PUBLICATION.description,
      preferences: {showInDiscover: PUBLICATION.showInDiscover},
    },
  })
  console.log(`put publication '${PUBLICATION_RKEY}'`)
}

async function syncDocuments(agent: AtpAgent): Promise<number> {
  const posts = await loadPosts()
  const existing = await listExisting(agent, DOCUMENT_COLLECTION)
  const desired = posts.map(({slug, data}) => ({
    slug,
    path: documentPath(slug),
    record: documentRecord(slug, data),
  }))
  // Sequential on purpose: gentle on the PDS and keeps log output ordered.
  for (const action of planDocumentActions(existing, desired, PUBLICATION.url)) {
    if (action.kind === 'create') {
      // No rkey -> the PDS assigns a TID.
      await agent.com.atproto.repo.createRecord({
        repo: ATPROTO_DID,
        collection: DOCUMENT_COLLECTION,
        record: action.record,
      })
      console.log(`created document '${action.slug}'`)
    } else {
      await agent.com.atproto.repo.putRecord({
        repo: ATPROTO_DID,
        collection: DOCUMENT_COLLECTION,
        rkey: action.rkey,
        record: action.record,
      })
      console.log(`updated document '${action.slug}' ('${action.rkey}')`)
    }
  }
  return posts.length
}

const agent = await connect()
await syncPublication(agent)
const count = await syncDocuments(agent)
console.log(`done: 1 publication + ${count} document(s)`)
