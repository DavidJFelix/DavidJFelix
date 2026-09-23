import {expect, test} from 'vitest'
import {ogImageSize, ogSite, ogTags} from './tags'

test('ogSite bundles the site defaults: absolute url and image, locale, large twitter card', () => {
  const params = ogSite({
    origin: 'https://startchi.com',
    siteName: 'startchi.com',
    title: 'startchi.com',
    description: 'The Midwest startup ecosystem.',
  })
  expect(params).toEqual({
    title: 'startchi.com',
    description: 'The Midwest startup ecosystem.',
    type: 'website',
    siteName: 'startchi.com',
    locale: 'en_US',
    url: new URL('https://startchi.com/'),
    image: {
      url: new URL('https://startchi.com/og/default.png'),
      alt: 'Title card for startchi.com',
      ...ogImageSize,
    },
    twitter: {card: 'summary_large_image'},
  })
})

test('ogSite resolves page and image paths on the origin and keeps twitter extras', () => {
  const params = ogSite({
    origin: new URL('https://djf.io'),
    siteName: 'djf.io',
    title: 'About',
    description: 'Bio',
    path: '/about/',
    image: '/og/about.png',
    twitter: {site: '@davidjfelix'},
  })
  expect(String(params.url)).toBe('https://djf.io/about/')
  expect(String(params.image?.url)).toBe('https://djf.io/og/about.png')
  expect(params.twitter).toEqual({card: 'summary_large_image', site: '@davidjfelix'})
})

test('ogSite output renders through ogTags with absolute url and image tags', () => {
  const tags = ogTags(
    ogSite({
      origin: 'https://pkg.dog',
      siteName: 'pkg.dog',
      title: 'pkg.dog',
      description: 'Parts.',
    }),
  )
  expect(tags).toContainEqual({property: 'og:url', content: 'https://pkg.dog/'})
  expect(tags).toContainEqual({property: 'og:image', content: 'https://pkg.dog/og/default.png'})
  expect(tags).toContainEqual({property: 'og:image:width', content: '1200'})
  expect(tags).toContainEqual({name: 'twitter:card', content: 'summary_large_image'})
})

test('ogTags emits nothing when no fields are provided', () => {
  expect(ogTags({})).toEqual([])
})

test('ogTags renders every field of a fully specified page', () => {
  const tags = ogTags({
    title: 'A Post',
    description: 'About things',
    type: 'article',
    siteName: 'djf.io',
    locale: 'en_US',
    url: 'https://djf.io/blog/a-post/',
    image: {
      url: 'https://djf.io/og/blog/a-post.png',
      alt: 'Title card for A Post',
      ...ogImageSize,
    },
    article: {
      publishedTime: '2025-12-07T00:00:00.000Z',
      author: 'David J Felix',
      tags: ['running', 'meta-blog'],
    },
    twitter: {card: 'summary_large_image', site: '@davidjfelix', creator: '@davidjfelix'},
  })
  expect(tags).toEqual([
    {property: 'og:title', content: 'A Post'},
    {property: 'og:description', content: 'About things'},
    {property: 'og:type', content: 'article'},
    {property: 'og:site_name', content: 'djf.io'},
    {property: 'og:locale', content: 'en_US'},
    {property: 'og:url', content: 'https://djf.io/blog/a-post/'},
    {property: 'og:image', content: 'https://djf.io/og/blog/a-post.png'},
    {property: 'og:image:width', content: '1200'},
    {property: 'og:image:height', content: '630'},
    {property: 'og:image:alt', content: 'Title card for A Post'},
    {property: 'article:published_time', content: '2025-12-07T00:00:00.000Z'},
    {property: 'article:author', content: 'David J Felix'},
    {property: 'article:tag', content: 'running'},
    {property: 'article:tag', content: 'meta-blog'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:site', content: '@davidjfelix'},
    {name: 'twitter:creator', content: '@davidjfelix'},
    {name: 'twitter:title', content: 'A Post'},
    {name: 'twitter:description', content: 'About things'},
    {name: 'twitter:image', content: 'https://djf.io/og/blog/a-post.png'},
    {name: 'twitter:image:alt', content: 'Title card for A Post'},
  ])
})

test('ogTags mirrors title and description into the twitter variants', () => {
  expect(ogTags({title: 'Home', description: 'A site'})).toEqual([
    {property: 'og:title', content: 'Home'},
    {property: 'og:description', content: 'A site'},
    {name: 'twitter:title', content: 'Home'},
    {name: 'twitter:description', content: 'A site'},
  ])
})

test('ogTags stringifies URL objects for og:url and og:image', () => {
  const tags = ogTags({
    url: new URL('/about/', 'https://djf.io'),
    image: {url: new URL('/og/default.png', 'https://djf.io')},
  })
  expect(tags).toEqual([
    {property: 'og:url', content: 'https://djf.io/about/'},
    {property: 'og:image', content: 'https://djf.io/og/default.png'},
    {name: 'twitter:image', content: 'https://djf.io/og/default.png'},
  ])
})

test('ogTags omits image size and alt tags when the image carries none', () => {
  const tags = ogTags({image: {url: '/og/default.png'}})
  expect(tags).toEqual([
    {property: 'og:image', content: '/og/default.png'},
    {name: 'twitter:image', content: '/og/default.png'},
  ])
})

test('ogTags renders an article without tags as published_time and author only', () => {
  const tags = ogTags({
    article: {publishedTime: '2026-01-01T00:00:00.000Z', author: 'DavidJFelix'},
  })
  expect(tags).toEqual([
    {property: 'article:published_time', content: '2026-01-01T00:00:00.000Z'},
    {property: 'article:author', content: 'DavidJFelix'},
  ])
})

test('ogTags emits only the twitter fields provided', () => {
  expect(ogTags({twitter: {card: 'summary'}})).toEqual([{name: 'twitter:card', content: 'summary'}])
})

test('ogTags keeps empty strings, matching what an empty frontmatter field renders', () => {
  expect(ogTags({description: ''})).toEqual([
    {property: 'og:description', content: ''},
    {name: 'twitter:description', content: ''},
  ])
})
