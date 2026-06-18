// Syncs djf.io's blog to its AT Protocol (standard.site) records on bsky.social:
// one site.standard.publication (rkey `self`) plus one site.standard.document
// per post (rkey = slug). Idempotent putRecord upserts, safe to run on every
// deploy. Reuses the URIs and metadata the site renders (../src/lib/
// standard-site.ts) so records and pages never drift, and writes nothing back
// to the repo.
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
  documentRkey,
  PUBLICATION,
  PUBLICATION_RKEY,
  publicationUri,
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

async function syncPublication(agent: AtpAgent): Promise<void> {
  await agent.com.atproto.repo.putRecord({
    repo: ATPROTO_DID,
    collection: 'site.standard.publication',
    rkey: PUBLICATION_RKEY,
    record: {
      $type: 'site.standard.publication',
      url: PUBLICATION.url,
      name: PUBLICATION.name,
      description: PUBLICATION.description,
      preferences: {showInDiscover: PUBLICATION.showInDiscover},
    },
  })
  console.log(`synced publication '${PUBLICATION_RKEY}'`)
}

async function syncDocuments(agent: AtpAgent): Promise<number> {
  const posts = await loadPosts()
  // Sequential on purpose: gentle on the PDS and keeps log output ordered.
  for (const {slug, data} of posts) {
    await agent.com.atproto.repo.putRecord({
      repo: ATPROTO_DID,
      collection: 'site.standard.document',
      rkey: documentRkey(slug),
      record: {
        $type: 'site.standard.document',
        site: publicationUri(),
        title: data.title,
        publishedAt: new Date(data.date).toISOString(),
        path: `/blog/${slug}/`,
        description: data.description,
        ...(data.tags ? {tags: data.tags} : {}),
      },
    })
    console.log(`synced document '${slug}'`)
  }
  return posts.length
}

const agent = await connect()
await syncPublication(agent)
const count = await syncDocuments(agent)
console.log(`done: 1 publication + ${count} document(s)`)
