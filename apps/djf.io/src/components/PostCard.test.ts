import type {CollectionEntry} from 'astro:content'
import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {expect, test} from 'vitest'
import PostCard from './PostCard.astro'

const container = await AstroContainer.create()

// Construct dates in local time so toLocaleDateString assertions are stable
// across developer machines and CI (see BlogPost.test.ts).
const fixturePost = (overrides: Partial<CollectionEntry<'blog'>['data']> = {}) =>
  ({
    id: 'fixture',
    body: '',
    collection: 'blog' as const,
    data: {
      title: 'A Real Title',
      description: 'A real description',
      date: new Date(2025, 11, 7),
      ...overrides,
    },
  }) as unknown as CollectionEntry<'blog'>

test('PostCard renders the title as an h2 link to the post by default', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost()},
  })
  expect(html).toMatch(/<a href="\/blog\/fixture"[^>]*>\s*<h2[^>]*>\s*A Real Title\s*<\/h2>/)
})

test('PostCard renders the heading at the requested level', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost(), headingLevel: 'h3'},
  })
  expect(html).toMatch(/<h3[^>]*>\s*A Real Title\s*<\/h3>/)
  expect(html).not.toContain('<h2')
})

test('PostCard renders the description, formatted date, and reading time', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost({readingTime: '5m'})},
  })
  expect(html).toContain('A real description')
  expect(html).toContain('December 7, 2025')
  expect(html).toContain('5m read')
})

test('PostCard omits the reading time when the post has none', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost()},
  })
  expect(html).not.toContain('read')
})

test('PostCard renders each tag as a link to its tag page', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost({tags: ['running', 'meta-blog']})},
  })
  expect(html).toMatch(/href="\/blog\/tags\/running"/)
  expect(html).toMatch(/href="\/blog\/tags\/meta-blog"/)
})

test('PostCard hides tags when showTags is false', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost({tags: ['running']}), showTags: false},
  })
  expect(html).not.toContain('/blog/tags/')
})

test('PostCard marks the current tag with aria-current', async () => {
  const html = await container.renderToString(PostCard, {
    props: {post: fixturePost({tags: ['running', 'meta-blog']}), currentTag: 'running'},
  })
  expect(html).toMatch(/aria-current="page"[^>]*>\s*running/)
  expect(html).not.toMatch(/aria-current="page"[^>]*>\s*meta-blog/)
})
