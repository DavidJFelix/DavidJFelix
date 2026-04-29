import type {CollectionEntry} from 'astro:content'
import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {beforeAll, describe, expect, test} from 'vitest'
import BlogPost from './BlogPost.astro'

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const fixturePost = (overrides: Partial<CollectionEntry<'blog'>['data']> = {}) =>
  ({
    id: 'fixture.md',
    slug: 'fixture',
    body: '',
    collection: 'blog' as const,
    data: {
      title: 'A Real Title',
      description: 'A real description',
      date: new Date('2025-12-07'),
      ...overrides,
    },
  }) as unknown as CollectionEntry<'blog'>

describe('BlogPost', () => {
  test('renders post title as H1', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost()},
    })
    expect(html).toMatch(/<h1[^>]*>\s*A Real Title\s*<\/h1>/)
  })

  test('formats date in long form', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost({date: new Date('2025-12-07')})},
    })
    expect(html).toContain('December 7, 2025')
  })

  test('renders author when provided', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost({author: 'DavidJFelix'})},
    })
    expect(html).toContain('by DavidJFelix')
  })

  test('omits author span when not provided', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost()},
    })
    expect(html).not.toContain('by ')
  })

  test('renders reading time when provided', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost({readingTime: '5m'})},
    })
    expect(html).toContain('5m read')
  })

  test('renders each tag as a link to its tag page', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost({tags: ['running', 'meta-blog']})},
    })
    expect(html).toMatch(/href="\/blog\/tags\/running"/)
    expect(html).toMatch(/href="\/blog\/tags\/meta-blog"/)
  })

  test('renders default slot for post body', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost()},
      slots: {default: '<p data-test="body">post body</p>'},
    })
    expect(html).toContain('<p data-test="body">post body</p>')
  })

  test('passes title and description through to BaseLayout', async () => {
    const html = await container.renderToString(BlogPost, {
      props: {post: fixturePost({description: 'This is the description'})},
    })
    expect(html).toContain('<title>A Real Title | djf.io</title>')
    expect(html).toMatch(/<meta name="description" content="This is the description"/)
  })
})
