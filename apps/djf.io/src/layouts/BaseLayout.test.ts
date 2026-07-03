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

// og:image:alt and twitter:image:alt render only alongside og:image, which
// needs Astro.site; the container omits it, so the alt tags are asserted
// against the real build in seo.e2e.test.ts.
test('BaseLayout renders locale and twitter creator', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(/<meta property="og:locale" content="en_US"/)
  expect(html).toMatch(/<meta name="twitter:creator" content="@davidjfelix"/)
})

test('BaseLayout renders article meta only when the article prop is given', async () => {
  const withArticle = await container.renderToString(BaseLayout, {
    props: {
      title: 'x',
      ogType: 'article',
      article: {
        publishedTime: '2025-12-07T00:00:00.000Z',
        author: 'DavidJFelix',
        tags: ['running', 'meta-blog'],
      },
    },
  })
  expect(withArticle).toMatch(
    /<meta property="article:published_time" content="2025-12-07T00:00:00.000Z"/,
  )
  expect(withArticle).toMatch(/<meta property="article:author" content="DavidJFelix"/)
  expect(withArticle).toMatch(/<meta property="article:tag" content="running"/)
  expect(withArticle).toMatch(/<meta property="article:tag" content="meta-blog"/)

  const withoutArticle = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(withoutArticle).not.toContain('article:published_time')
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

test('BaseLayout escapes angle brackets inside JSON-LD payloads', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', jsonLd: {headline: '</script><img>'}},
  })
  expect(html).toContain('{"headline":"\\u003c/script>\\u003cimg>"}')
})

test('BaseLayout renders one ld+json script per entry when jsonLd is an array', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x', jsonLd: [{'@type': 'WebSite'}, {'@type': 'Person'}]},
  })
  expect(html.match(/<script type="application\/ld\+json">/g)).toHaveLength(2)
  expect(html).toContain('{"@type":"WebSite"}')
  expect(html).toContain('{"@type":"Person"}')
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

test('BaseLayout renders GitHub and Twitter as icon links with accessible names', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toMatch(
    /<a href="https:\/\/github\.com\/davidjfelix" aria-label="GitHub"[^>]*>\s*<svg/,
  )
  expect(html).toMatch(
    /<a href="https:\/\/twitter\.com\/davidjfelix" aria-label="Twitter"[^>]*>\s*<svg/,
  )
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
