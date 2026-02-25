#!/usr/bin/env node

/**
 * Syncs blog posts to AT Protocol as site.standard.document records
 * and ensures a site.standard.publication record exists.
 *
 * Usage:
 *   BSKY_HANDLE=djf.io BSKY_APP_PASSWORD=xxxx node --experimental-strip-types scripts/standard-site-sync.ts
 *
 * Environment variables:
 *   BSKY_HANDLE       - Bluesky handle (e.g. djf.io)
 *   BSKY_APP_PASSWORD - App password from bsky.app/settings/app-passwords
 *   BSKY_PDS_URL      - PDS URL (default: https://bsky.social)
 *
 * @see https://standard.site/docs/quick-start/
 */

import {readFileSync, writeFileSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {
  STANDARD_SITE_DID,
  STANDARD_SITE_PUBLICATION_RKEY,
  publicationAtUri,
} from '../src/standard-site.ts'

const PDS_URL = process.env.BSKY_PDS_URL ?? 'https://bsky.social'
const HANDLE = process.env.BSKY_HANDLE
const APP_PASSWORD = process.env.BSKY_APP_PASSWORD
const CONTENT_DIR = join(import.meta.dirname, '../src/content/blog')
const SITE_URL = 'https://djf.io'

if (!HANDLE || !APP_PASSWORD) {
  console.error('Error: BSKY_HANDLE and BSKY_APP_PASSWORD are required')
  process.exit(1)
}

interface Session {
  did: string
  accessJwt: string
}

async function createSession(): Promise<Session> {
  const res = await fetch(
    `${PDS_URL}/xrpc/com.atproto.server.createSession`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({identifier: HANDLE, password: APP_PASSWORD}),
    }
  )
  if (!res.ok) {
    throw new Error(`Failed to authenticate: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<Session>
}

async function getRecord(
  session: Session,
  collection: string,
  rkey: string
): Promise<{uri: string; cid: string; value: Record<string, unknown>} | null> {
  const params = new URLSearchParams({
    repo: session.did,
    collection,
    rkey,
  })
  const res = await fetch(
    `${PDS_URL}/xrpc/com.atproto.repo.getRecord?${params}`,
    {headers: {Authorization: `Bearer ${session.accessJwt}`}}
  )
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) {
    throw new Error(`Failed to get record: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<{uri: string; cid: string; value: Record<string, unknown>}>
}

async function putRecord(
  session: Session,
  collection: string,
  rkey: string,
  record: Record<string, unknown>
): Promise<{uri: string; cid: string}> {
  const res = await fetch(
    `${PDS_URL}/xrpc/com.atproto.repo.putRecord`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection,
        rkey,
        record,
      }),
    }
  )
  if (!res.ok) {
    throw new Error(
      `Failed to put record ${collection}/${rkey}: ${res.status} ${await res.text()}`
    )
  }
  return res.json() as Promise<{uri: string; cid: string}>
}

interface PostFrontmatter {
  title: string
  description: string
  date: string
  tags?: string[]
  atUri?: string
  [key: string]: unknown
}

function parseFrontmatter(content: string): {
  frontmatter: PostFrontmatter
  body: string
  raw: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error('Invalid frontmatter')

  const frontmatterStr = match[1]
  const body = match[2]

  // Simple YAML parser for our frontmatter — handles scalars, arrays, and nested objects
  const frontmatter: Record<string, unknown> = {}
  const lines = frontmatterStr.split('\n')
  let currentKey = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(/^\S+:/)) {
      const colonIdx = line.indexOf(':')
      currentKey = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      if (value) {
        frontmatter[currentKey] = value.replace(/^['"]|['"]$/g, '')
      }
    } else if (line.match(/^\s+-\s/) && currentKey) {
      if (!Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = []
      }
      const item = line.replace(/^\s+-\s+/, '').trim()
      // Skip nested object items (like aiAssistants entries)
      if (!item.includes(':')) {
        ;(frontmatter[currentKey] as string[]).push(item)
      }
    }
  }

  return {frontmatter: frontmatter as PostFrontmatter, body, raw: frontmatterStr}
}

/** Derive a stable rkey from the blog post filename */
function filenameToRkey(filename: string): string {
  // e.g. "2023-12-30-shipposting.md" -> "2023-12-30-shipposting"
  return filename.replace(/\.(md|mdx)$/, '')
}

/** Derive the blog URL path from the filename (matches Astro slug) */
function filenameToPath(filename: string): string {
  const slug = filename.replace(/\.(md|mdx)$/, '')
  return `/blog/${slug}/`
}

/** Strip markdown to get plain text for textContent */
function stripMarkdown(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '') // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links
    .replace(/#{1,6}\s+/g, '') // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // code
    .replace(/^\s*[-*+]\s+/gm, '') // list markers
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
    .replace(/>\s+/g, '') // blockquotes
    .replace(/\[?\^.*?\]?/g, '') // footnotes
    .replace(/\n{3,}/g, '\n\n') // excessive newlines
    .trim()
}

async function main() {
  console.log('Authenticating with PDS...')
  const session = await createSession()
  console.log(`Authenticated as ${session.did}`)

  if (session.did !== STANDARD_SITE_DID) {
    console.error(
      `Warning: Authenticated DID (${session.did}) does not match configured DID (${STANDARD_SITE_DID})`
    )
    console.error('Update src/standard-site.ts if your DID has changed.')
  }

  // Ensure publication record exists
  console.log('\nChecking publication record...')
  const existingPub = await getRecord(
    session,
    'site.standard.publication',
    STANDARD_SITE_PUBLICATION_RKEY
  )

  const publicationRecord = {
    $type: 'site.standard.publication',
    url: SITE_URL,
    name: "David J. Felix's Blog",
    description: 'Thoughts on software, running, and life',
  }

  if (existingPub) {
    console.log(`Publication record exists: ${existingPub.uri}`)
  }

  const pubResult = await putRecord(
    session,
    'site.standard.publication',
    STANDARD_SITE_PUBLICATION_RKEY,
    publicationRecord
  )
  console.log(`Publication record: ${pubResult.uri}`)

  // Sync blog posts
  const files = readdirSync(CONTENT_DIR).filter((f) =>
    f.match(/\.(md|mdx)$/)
  )

  console.log(`\nFound ${files.length} blog posts to sync...\n`)

  for (const filename of files) {
    const filepath = join(CONTENT_DIR, filename)
    const content = readFileSync(filepath, 'utf-8')
    const {frontmatter, body} = parseFrontmatter(content)
    const rkey = filenameToRkey(filename)
    const path = filenameToPath(filename)

    const documentRecord: Record<string, unknown> = {
      $type: 'site.standard.document',
      site: publicationAtUri,
      title: frontmatter.title,
      path,
      publishedAt: new Date(frontmatter.date).toISOString(),
    }

    if (frontmatter.description) {
      documentRecord.description = frontmatter.description
    }
    if (frontmatter.tags && frontmatter.tags.length > 0) {
      documentRecord.tags = frontmatter.tags
    }

    const textContent = stripMarkdown(body)
    if (textContent) {
      documentRecord.textContent = textContent
    }

    try {
      const result = await putRecord(
        session,
        'site.standard.document',
        rkey,
        documentRecord
      )
      console.log(`  ✓ ${frontmatter.title}`)
      console.log(`    ${result.uri}`)

      // Write atUri back to frontmatter if missing or changed
      if (frontmatter.atUri !== result.uri) {
        const atUriLine = `atUri: ${result.uri}`
        let updatedContent: string

        if (frontmatter.atUri) {
          // Replace existing atUri
          updatedContent = content.replace(/^atUri:.*$/m, atUriLine)
        } else {
          // Add atUri before closing ---
          updatedContent = content.replace(
            /\n---\n/,
            `\n${atUriLine}\n---\n`
          )
        }
        writeFileSync(filepath, updatedContent)
        console.log(`    Updated frontmatter with atUri`)
      }
    } catch (err) {
      console.error(`  ✗ ${frontmatter.title}: ${err}`)
    }
  }

  console.log('\nSync complete!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
