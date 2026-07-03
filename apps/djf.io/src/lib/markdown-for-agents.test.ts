import {expect, test} from 'vitest'
import {htmlPageToMarkdown, negotiateMarkdown, prefersMarkdown} from './markdown-for-agents'

const page = (head: string, body: string): string =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

const fullPage = page(
  '<title>On Running | djf.io</title><meta name="description" content="A post about running">',
  '<header><nav><a href="/blog">Blog</a></nav></header>' +
    '<main><h1>On Running</h1><p>I like to <em>run</em>.</p></main>' +
    '<footer>© David J Felix</footer>',
)

const markdownRequest = (init?: RequestInit): Request =>
  new Request('https://djf.io/', {headers: {accept: 'text/markdown'}, ...init})

const htmlResponse = (body: string, init?: ResponseInit): Response =>
  new Response(body, {headers: {'content-type': 'text/html; charset=utf-8'}, ...init})

test('prefersMarkdown is false without an Accept header', () => {
  expect(prefersMarkdown(null)).toBe(false)
})

test('prefersMarkdown accepts a bare text/markdown', () => {
  expect(prefersMarkdown('text/markdown')).toBe(true)
})

test('prefersMarkdown leaves browser and wildcard Accept headers on html', () => {
  expect(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(
    false,
  )
  expect(prefersMarkdown('*/*')).toBe(false)
})

test('prefersMarkdown respects an explicit preference for html', () => {
  expect(prefersMarkdown('text/markdown;q=0.5, text/html')).toBe(false)
})

test('prefersMarkdown converts when markdown outranks html', () => {
  expect(prefersMarkdown('text/html;q=0.4, text/markdown;q=0.8')).toBe(true)
})

test('prefersMarkdown treats an explicit tie as a markdown request', () => {
  expect(prefersMarkdown('text/html, text/markdown')).toBe(true)
})

test('prefersMarkdown treats q=0 as not acceptable', () => {
  expect(prefersMarkdown('text/markdown;q=0')).toBe(false)
})

test('prefersMarkdown ignores case and whitespace', () => {
  expect(prefersMarkdown(' TEXT/MARKDOWN ; Q=0.9 ')).toBe(true)
})

test('prefersMarkdown treats a malformed q as not acceptable', () => {
  expect(prefersMarkdown('text/markdown;q=1..')).toBe(false)
})

test('prefersMarkdown keeps the strongest of duplicate ranges', () => {
  expect(prefersMarkdown('text/markdown;q=0.1, text/markdown')).toBe(true)
})

test('htmlPageToMarkdown extracts frontmatter and converts only the main content', () => {
  const {markdown} = htmlPageToMarkdown(fullPage)
  expect(markdown.startsWith('---\n')).toBe(true)
  expect(markdown).toContain('title: "On Running | djf.io"')
  expect(markdown).toContain('description: "A post about running"')
  expect(markdown).toContain('# On Running')
  expect(markdown).toContain('*run*')
  expect(markdown).not.toContain('Blog')
  expect(markdown).not.toContain('©')
})

test('htmlPageToMarkdown escapes frontmatter values', () => {
  const title = 'He said "hi": twice | djf.io'
  const {markdown} = htmlPageToMarkdown(page(`<title>${title}</title>`, '<main>x</main>'))
  expect(markdown).toContain(`title: ${JSON.stringify(title)}`)
})

test('htmlPageToMarkdown renders GitHub-flavored tables and strikethrough', () => {
  const {markdown} = htmlPageToMarkdown(
    page(
      '',
      '<main><table><thead><tr><th>pace</th></tr></thead><tbody><tr><td>slow</td></tr></tbody></table><p><del>gone</del></p></main>',
    ),
  )
  expect(markdown).toContain('| pace |')
  expect(markdown).toContain('| slow |')
  expect(markdown).toContain('~~gone~~')
})

test('htmlPageToMarkdown falls back to the body when there is no main', () => {
  const {markdown} = htmlPageToMarkdown(page('', '<p>no landmarks here</p>'))
  expect(markdown).toContain('no landmarks here')
})

test('htmlPageToMarkdown omits frontmatter when the page has no title or description', () => {
  const {markdown} = htmlPageToMarkdown(page('<title></title>', '<main>bare</main>'))
  expect(markdown).not.toContain('---')
  expect(markdown).toBe('bare\n')
})

test('htmlPageToMarkdown skips a description meta without content', () => {
  const {markdown} = htmlPageToMarkdown(
    page('<title>t</title><meta name="description">', '<main>x</main>'),
  )
  expect(markdown).toContain('title: "t"')
  expect(markdown).not.toContain('description:')
})

test('htmlPageToMarkdown reports tokens at four characters per token', () => {
  const {markdown, tokens} = htmlPageToMarkdown(fullPage)
  expect(tokens).toBe(Math.ceil(markdown.length / 4))
  expect(tokens).toBeGreaterThan(0)
})

test('negotiateMarkdown converts an html page for a markdown request', async () => {
  const response = await negotiateMarkdown(markdownRequest(), htmlResponse(fullPage))
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
  expect(response.headers.get('vary')).toBe('accept')
  const body = await response.text()
  expect(response.headers.get('x-markdown-tokens')).toBe(String(Math.ceil(body.length / 4)))
  expect(body).toContain('# On Running')
})

test('negotiateMarkdown matches the content type case-insensitively', async () => {
  const response = await negotiateMarkdown(
    markdownRequest(),
    new Response(fullPage, {headers: {'content-type': 'TEXT/HTML'}}),
  )
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
})

test('negotiateMarkdown passes non-GET requests through untouched', async () => {
  const original = htmlResponse(fullPage)
  const response = await negotiateMarkdown(markdownRequest({method: 'POST'}), original)
  expect(response).toBe(original)
})

test('negotiateMarkdown passes requests without a markdown preference through', async () => {
  const original = htmlResponse(fullPage)
  const response = await negotiateMarkdown(new Request('https://djf.io/'), original)
  expect(response).toBe(original)
})

test('negotiateMarkdown passes error responses through', async () => {
  const original = htmlResponse('<html><body>missing</body></html>', {status: 404})
  const response = await negotiateMarkdown(markdownRequest(), original)
  expect(response).toBe(original)
})

test('negotiateMarkdown passes non-html responses through', async () => {
  const original = new Response('{}', {headers: {'content-type': 'application/json'}})
  const response = await negotiateMarkdown(markdownRequest(), original)
  expect(response).toBe(original)
})

test('negotiateMarkdown passes responses without a content type through', async () => {
  const original = new Response(null, {status: 200})
  const response = await negotiateMarkdown(markdownRequest(), original)
  expect(response).toBe(original)
})
