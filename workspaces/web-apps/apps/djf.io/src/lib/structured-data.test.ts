import {expect, test} from 'vitest'
import {breadcrumbs, PROFILE_URLS, person, webSite} from './structured-data'

const site = new URL('https://djf.io')

test('person carries the site url and the profile links', () => {
  expect(person(site)).toEqual({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'David J Felix',
    url: 'https://djf.io/',
    sameAs: PROFILE_URLS,
  })
})

test('person leaves url undefined without a site', () => {
  expect(person().url).toBeUndefined()
})

test('webSite names the site and carries its url', () => {
  expect(webSite(site)).toEqual({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'djf.io',
    url: 'https://djf.io/',
  })
})

test('webSite leaves url undefined without a site', () => {
  expect(webSite().url).toBeUndefined()
})

test('breadcrumbs numbers the trail and resolves absolute urls', () => {
  const list = breadcrumbs(site, [
    {name: 'Home', path: '/'},
    {name: 'Blog', path: '/blog/'},
    {name: 'A Post', path: '/blog/a-post/'},
  ])
  expect(list['@type']).toBe('BreadcrumbList')
  expect(list.itemListElement).toEqual([
    {'@type': 'ListItem', position: 1, name: 'Home', item: 'https://djf.io/'},
    {'@type': 'ListItem', position: 2, name: 'Blog', item: 'https://djf.io/blog/'},
    {'@type': 'ListItem', position: 3, name: 'A Post', item: 'https://djf.io/blog/a-post/'},
  ])
})

test('breadcrumbs leaves items undefined without a site', () => {
  const list = breadcrumbs(undefined, [{name: 'Home', path: '/'}])
  expect(list.itemListElement).toEqual([
    {'@type': 'ListItem', position: 1, name: 'Home', item: undefined},
  ])
})
