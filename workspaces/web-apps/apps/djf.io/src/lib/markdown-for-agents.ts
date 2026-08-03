// Markdown for Agents: content negotiation that serves pages as markdown.
//
// Agents ask for it with `Accept: text/markdown`; browsers never send that,
// so HTML stays the default. Cloudflare offers this conversion at the edge on
// paid plans (developers.cloudflare.com/fundamentals/reference/markdown-for-agents/);
// doing it in the worker keeps the behavior plan-independent and testable.
// The response mirrors Cloudflare's shape: `Content-Type: text/markdown`, an
// `x-markdown-tokens` estimate, YAML frontmatter carrying the page title and
// description, and the page body -- chrome outside <main> stripped -- as
// GitHub-flavored markdown.
//
// `negotiateMarkdown` is the whole feature: the worker entry (src/worker.ts)
// passes every response through it, and it converts only when the request
// explicitly prefers markdown and the response is an HTML page.

import type {Element, Nodes} from 'hast'
import {fromHtml} from 'hast-util-from-html'
import {toMdast} from 'hast-util-to-mdast'
import {gfmToMarkdown} from 'mdast-util-gfm'
import {toMarkdown} from 'mdast-util-to-markdown'

const MARKDOWN_TYPE = 'text/markdown'
const HTML_TYPE = 'text/html'

// The q parameter of a media range, e.g. `text/html;q=0.9`. Anything else
// after the `;` (charset, level) is irrelevant to preference.
const QUALITY_PARAM = /;\s*q\s*=\s*([0-9.]+)/i

type MediaRange = {type: string; quality: number}

function mediaRanges(accept: string): Array<MediaRange> {
  return accept.split(',').map((part) => {
    const semicolon = part.indexOf(';')
    const type = (semicolon === -1 ? part : part.slice(0, semicolon)).trim().toLowerCase()
    const match = QUALITY_PARAM.exec(part)
    const quality = match === null ? 1 : Number(match[1])
    // A malformed q (`q=1..`) parses to NaN; treat it as "not acceptable"
    // rather than guessing a preference.
    return {type, quality: Number.isNaN(quality) ? 0 : quality}
  })
}

function bestQuality(ranges: Array<MediaRange>, type: string): number | undefined {
  const qualities = ranges.filter((range) => range.type === type).map((range) => range.quality)
  return qualities.length === 0 ? undefined : Math.max(...qualities)
}

// True when the Accept header explicitly asks for text/markdown at least as
// strongly as text/html. Wildcards (`*/*`, `text/*`) do not count as asking --
// browsers send those on every navigation, and they must keep getting HTML.
export function prefersMarkdown(accept: string | null): boolean {
  if (accept === null) return false
  const ranges = mediaRanges(accept)
  const markdown = bestQuality(ranges, MARKDOWN_TYPE)
  if (markdown === undefined || markdown === 0) return false
  const html = bestQuality(ranges, HTML_TYPE)
  return html === undefined || markdown >= html
}

function findElement(node: Nodes, match: (element: Element) => boolean): Element | undefined {
  if (node.type === 'element' && match(node)) return node
  if ('children' in node) {
    for (const child of node.children) {
      const found = findElement(child, match)
      if (found !== undefined) return found
    }
  }
  return undefined
}

// <title> content parses as raw text, so its children are all text nodes.
function textContent(element: Element): string {
  return element.children.map((child) => (child.type === 'text' ? child.value : '')).join('')
}

const byTag = (tagName: string) => (element: Element) => element.tagName === tagName

// The common ~4-characters-per-token estimate. Cloudflare's x-markdown-tokens
// is also an estimate, so a heuristic beats bundling a real tokenizer.
const CHARS_PER_TOKEN = 4

export type MarkdownPage = {markdown: string; tokens: number}

// Convert an HTML page to its markdown representation: YAML frontmatter from
// <title> and <meta name="description">, then the <main> content -- header,
// nav, and footer live outside it on every page -- as GFM. JSON.stringify
// produces double-quoted strings, which are valid YAML scalars, so titles
// containing quotes or colons never break the frontmatter.
export function htmlPageToMarkdown(html: string): MarkdownPage {
  const tree = fromHtml(html)

  const titleElement = findElement(tree, byTag('title'))
  const title = titleElement === undefined ? '' : textContent(titleElement).trim()
  const descriptionMeta = findElement(
    tree,
    (element) => element.tagName === 'meta' && element.properties.name === 'description',
  )
  const description = descriptionMeta?.properties.content

  const frontmatterLines: Array<string> = []
  if (title !== '') frontmatterLines.push(`title: ${JSON.stringify(title)}`)
  if (typeof description === 'string') {
    frontmatterLines.push(`description: ${JSON.stringify(description)}`)
  }
  const frontmatter =
    frontmatterLines.length === 0 ? '' : `---\n${frontmatterLines.join('\n')}\n---\n\n`

  // fromHtml parses in document mode, which always synthesizes <body>; the
  // final fallback is unreachable today but keeps the function total.
  const content = findElement(tree, byTag('main')) ?? findElement(tree, byTag('body')) ?? tree
  const body = toMarkdown(toMdast(content), {extensions: [gfmToMarkdown()]}).trim()

  const markdown = `${frontmatter}${body}\n`
  return {markdown, tokens: Math.ceil(markdown.length / CHARS_PER_TOKEN)}
}

// Convert an HTML page response to markdown when the request asked for it;
// hand every other response back untouched. Only successful GETs of HTML are
// converted -- errors, redirects, and non-HTML assets pass through.
export async function negotiateMarkdown(request: Request, response: Response): Promise<Response> {
  if (request.method !== 'GET') return response
  if (!prefersMarkdown(request.headers.get('accept'))) return response
  if (!response.ok) return response
  const contentType = response.headers.get('content-type')
  if (contentType === null || !contentType.toLowerCase().includes(HTML_TYPE)) return response

  const {markdown, tokens} = htmlPageToMarkdown(await response.text())
  // Carry the page's headers through -- caching policy and anything upstream
  // middleware adds apply to the markdown rendition too -- but drop the ones
  // that describe the HTML bytes (ETag, Content-Length, Content-Encoding):
  // reusing those would let a cache serve one representation as the other.
  // Vary (appended, in case the page already varies) tells caches the same
  // URL splits on Accept.
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('etag')
  headers.set('content-type', `${MARKDOWN_TYPE}; charset=utf-8`)
  headers.set('x-markdown-tokens', String(tokens))
  headers.append('vary', 'accept')
  return new Response(markdown, {status: response.status, headers})
}
