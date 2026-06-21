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

test('BaseLayout renders head slot content inside <head>', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
    slots: {head: '<meta name="test-head-slot" content="1">'},
  })
  const headEnd = html.indexOf('</head>')
  const slotIndex = html.indexOf('<meta name="test-head-slot" content="1">')
  expect(slotIndex).toBeGreaterThan(-1)
  expect(slotIndex).toBeLessThan(headEnd)
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

test('BaseLayout renders current year in footer', async () => {
  const html = await container.renderToString(BaseLayout, {
    props: {title: 'x'},
  })
  expect(html).toContain(String(new Date().getFullYear()))
})
