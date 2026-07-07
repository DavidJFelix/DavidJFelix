import type {CollectionEntry} from 'astro:content'
import {experimental_AstroContainer as AstroContainer} from 'astro/container'
import {expect, test} from 'vitest'
import BlogPost from './BlogPost.astro'

// The container API does not carry `site` config through to `Astro.site`, so
// JSON-LD url/image and og:image absolute URLs are asserted against the real
// build in seo.e2e.test.ts instead.
const container = await AstroContainer.create()

// `new Date('YYYY-MM-DD')` parses as UTC midnight, then `toLocaleDateString`
// uses the local zone — TZs west of UTC roll back a day. Construct in local
// time so assertions are stable across developer machines and CI.
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

test('BlogPost sets og:type article', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
  })
  expect(html).toMatch(/<meta property="og:type" content="article"/)
})

test('BlogPost emits article meta for the post', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({author: 'DavidJFelix', tags: ['running']})},
  })
  const publishedTime = new Date(2025, 11, 7).toISOString()
  expect(html).toContain(`<meta property="article:published_time" content="${publishedTime}"`)
  expect(html).toMatch(/<meta property="article:author" content="DavidJFelix"/)
  expect(html).toMatch(/<meta property="article:tag" content="running"/)
})

test('BlogPost article meta falls back to David J Felix as author', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
  })
  expect(html).toMatch(/<meta property="article:author" content="David J Felix"/)
})

const jsonLdFrom = (html: string) => {
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
  expect(match).not.toBeNull()
  // oxlint-disable-next-line typescript/no-non-null-assertion -- asserted non-null above
  return JSON.parse(match![1])
}

test('BlogPost embeds BlogPosting JSON-LD with headline and publish date', async () => {
  const date = new Date(2025, 11, 7)
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost({date})},
  })
  const jsonLd = jsonLdFrom(html)
  expect(jsonLd['@context']).toBe('https://schema.org')
  expect(jsonLd['@type']).toBe('BlogPosting')
  expect(jsonLd.headline).toBe('A Real Title')
  expect(jsonLd.description).toBe('A real description')
  expect(jsonLd.datePublished).toBe(date.toISOString())
})

test('BlogPost JSON-LD uses the post author and falls back to David J Felix', async () => {
  const withAuthor = jsonLdFrom(
    await container.renderToString(BlogPost, {
      props: {post: fixturePost({author: 'DavidJFelix'})},
    }),
  )
  expect(withAuthor.author).toEqual({'@type': 'Person', name: 'DavidJFelix'})

  const withoutAuthor = jsonLdFrom(
    await container.renderToString(BlogPost, {
      props: {post: fixturePost()},
    }),
  )
  expect(withoutAuthor.author).toEqual({'@type': 'Person', name: 'David J Felix'})
})

const neighbor = (id: string, title: string) =>
  ({...fixturePost({title}), id}) as unknown as CollectionEntry<'blog'>

test('BlogPost embeds a BreadcrumbList after the BlogPosting', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
  })
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
  expect(scripts).toHaveLength(2)
  const breadcrumb = JSON.parse(scripts[1][1])
  expect(breadcrumb['@type']).toBe('BreadcrumbList')
  expect(breadcrumb.itemListElement.map((item: {name: string}) => item.name)).toEqual([
    'Home',
    'Blog',
    'A Real Title',
  ])
})

test('BlogPost links its chronological neighbors when provided', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {
      post: fixturePost(),
      prev: neighbor('older-post', 'The Older One'),
      next: neighbor('newer-post', 'The Newer One'),
    },
  })
  expect(html).toMatch(/<a href="\/blog\/older-post"[^>]*>[^<]*The Older One/)
  expect(html).toMatch(/<a href="\/blog\/newer-post"[^>]*>[^<]*The Newer One/)
})

test('BlogPost omits the neighbor nav when there are no neighbors', async () => {
  const html = await container.renderToString(BlogPost, {
    props: {post: fixturePost()},
  })
  expect(html).not.toContain('More posts')
})

test('BlogPost JSON-LD joins tags into keywords and omits them when absent', async () => {
  const withTags = jsonLdFrom(
    await container.renderToString(BlogPost, {
      props: {post: fixturePost({tags: ['running', 'meta-blog']})},
    }),
  )
  expect(withTags.keywords).toBe('running, meta-blog')

  const withoutTags = jsonLdFrom(
    await container.renderToString(BlogPost, {
      props: {post: fixturePost()},
    }),
  )
  expect(withoutTags).not.toHaveProperty('keywords')
})
