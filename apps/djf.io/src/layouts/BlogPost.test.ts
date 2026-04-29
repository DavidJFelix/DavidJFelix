import type {CollectionEntry} from 'astro:content'
import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {expect, test} from 'vitest'
import BlogPost from './BlogPost.astro'

const container = await AstroContainer.create()

// `new Date('YYYY-MM-DD')` parses as UTC midnight, then `toLocaleDateString`
// uses the local zone — TZs west of UTC roll back a day. Construct in local
// time so assertions are stable across developer machines and CI.
const fixturePost = (overrides: Partial<CollectionEntry<'blog'>['data']> = {}) =>
  ({
    id: 'fixture.md',
    slug: 'fixture',
    body: '',
    collection: 'blog' as const,
    data: {
      title: 'A Real Title',
      description: 'A real description',
      date: new Date(2025, 11, 7),
      ...overrides,
    },
  }) as unknown as CollectionEntry<'blog'>

test('BlogPost renders post title as H1', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
  })
  expect(html).toMatch(/<h1[^>]*>\s*A Real Title\s*<\/h1>/)
})

test('BlogPost formats date in long form', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({date: new Date(2025, 11, 7)})},
  })
  expect(html).toContain('December 7, 2025')
})

test('BlogPost renders author when provided', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({author: 'DavidJFelix'})},
  })
  expect(html).toContain('by DavidJFelix')
})

test('BlogPost omits author span when not provided', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
  })
  expect(html).not.toContain('by ')
})

test('BlogPost renders reading time when provided', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({readingTime: '5m'})},
  })
  expect(html).toContain('5m read')
})

test('BlogPost renders each tag as a link to its tag page', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({tags: ['running', 'meta-blog']})},
  })
  expect(html).toMatch(/href="\/blog\/tags\/running"/)
  expect(html).toMatch(/href="\/blog\/tags\/meta-blog"/)
})

test('BlogPost renders default slot for post body', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
    slots: {default: '<p data-test="body">post body</p>'},
  })
  expect(html).toContain('<p data-test="body">post body</p>')
})

test('BlogPost passes title and description through to BaseLayout', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({description: 'This is the description'})},
  })
  expect(html).toContain('<title>A Real Title | djf.io</title>')
  expect(html).toMatch(/<meta name="description" content="This is the description"/)
})
