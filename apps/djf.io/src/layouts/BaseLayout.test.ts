import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {expect, test} from 'vitest'
import BaseLayout from './BaseLayout.astro'

// The container API does not carry `site` config through to `Astro.site`, so
// absolute-URL tags (canonical, og:url, og:image) are conditionally skipped
// here and asserted against the real build in seo.e2e.test.ts instead.
const container = await AstroContainer.create()

test('BaseLayout renders title prop suffixed with site name', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'About'},
  })
  expect(html).toContain('<title>About | djf.io</title>')
})

test('BaseLayout uses provided description in meta tag', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', description: 'A custom description'},
  })
  expect(html).toMatch(/<meta name="description" content="A custom description"/)
})

test('BaseLayout falls back to default description when omitted', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/<meta name="description" content="Personal blog of David J Felix"/)
})

test('BaseLayout renders Open Graph meta with website defaults', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'About', description: 'About me'},
  })
  expect(html).toMatch(/<meta property="og:title" content="About"/)
  expect(html).toMatch(/<meta property="og:description" content="About me"/)
  expect(html).toMatch(/<meta property="og:type" content="website"/)
  expect(html).toMatch(/<meta property="og:site_name" content="djf.io"/)
})

test('BaseLayout renders og:type article when overridden', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', ogType: 'article'},
  })
  expect(html).toMatch(/<meta property="og:type" content="article"/)
})

test('BaseLayout renders Twitter card meta', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'A Title', description: 'A description'},
  })
  expect(html).toMatch(/<meta name="twitter:card" content="summary_large_image"/)
  expect(html).toMatch(/<meta name="twitter:site" content="@davidjfelix"/)
  expect(html).toMatch(/<meta name="twitter:title" content="A Title"/)
  expect(html).toMatch(/<meta name="twitter:description" content="A description"/)
})

test('BaseLayout links the RSS feed and sitemap', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/<link rel="alternate" type="application\/rss\+xml"[^>]*href="\/rss\.xml"/)
  expect(html).toMatch(/<link rel="sitemap" href="\/sitemap-index\.xml"/)
})

// Head extras (JSON-LD, standard-site link) are passed as props and rendered
// directly in <head>, not forwarded through a `<slot name="head" />`: Astro 7
// does not render a named slot placed inside <head> in the real build, which
// silently dropped this content on every blog post (caught by seo.e2e.test.ts,
// not the container API — the container renders head slots even though the
// real build does not).
test('BaseLayout renders the jsonLd prop as a ld+json script inside <head>', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', jsonLd: {'@type': 'BlogPosting', headline: 'Hi'}},
  })
  const headEnd = html.indexOf('</head>')
  const scriptIndex = html.search(/<script type="application\/ld\+json">/)
  expect(scriptIndex).toBeGreaterThan(-1)
  expect(scriptIndex).toBeLessThan(headEnd)
  expect(html).toContain('{"@type":"BlogPosting","headline":"Hi"}')
})

test('BaseLayout omits the ld+json script when no jsonLd prop is given', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).not.toContain('application/ld+json')
})

test('BaseLayout renders the standard-site document link inside <head> when provided', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', standardDocumentUri: 'at://did:plc:abc/site.standard.document/xyz'},
  })
  const headEnd = html.indexOf('</head>')
  const linkIndex = html.indexOf(
    '<link rel="site.standard.document" href="at://did:plc:abc/site.standard.document/xyz">',
  )
  expect(linkIndex).toBeGreaterThan(-1)
  expect(linkIndex).toBeLessThan(headEnd)
})

test('BaseLayout omits the standard-site document link when the URI is null', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', standardDocumentUri: null},
  })
  expect(html).not.toContain('site.standard.document')
})

test('BaseLayout renders nav links to home, blog, github, twitter', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/href="\/"/)
  expect(html).toMatch(/href="\/blog"/)
  expect(html).toMatch(/href="https:\/\/github\.com\/davidjfelix"/)
  expect(html).toMatch(/href="https:\/\/twitter\.com\/davidjfelix"/)
})

test('BaseLayout renders the search trigger button in nav', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/<button type="button"[^>]*>Search/)
})

test('BaseLayout renders default slot content inside <main>', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
    slots: {default: '<p data-test="slot-content">hi</p>'},
  })
  expect(html).toContain('<p data-test="slot-content">hi</p>')
})

test('BaseLayout renders the signature footer', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/(©|&copy;) David J Felix/)
})
