import {getCollection} from 'astro:content'
import type {APIContext} from 'astro'
import {expect, test} from 'vitest'
import {GET, getStaticPaths} from './[...slug].png.ts'

// The underscore prefix keeps Astro from treating this file as an endpoint;
// see docs/contributing/testing.md.

const paths = await getStaticPaths()
const posts = await getCollection('blog')

// Every PNG starts with a fixed-layout header: an 8-byte signature, then the
// image's big-endian width at byte 16 and height at byte 20. Reading those
// directly keeps image libraries out of the app.
const pngSize = (png: Uint8Array): {width: number; height: number} => {
  expect(Array.from(png.subarray(1, 4))).toEqual(Array.from('PNG').map((c) => c.charCodeAt(0)))
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return {width: view.getUint32(16), height: view.getUint32(20)}
}

const render = async (props: (typeof paths)[number]['props']): Promise<Uint8Array> => {
  const response = await GET({props} as APIContext<(typeof paths)[number]['props']>)
  expect(response.headers.get('Content-Type')).toBe('image/png')
  return new Uint8Array(await response.arrayBuffer())
}

test('og image routes cover the default card and every blog post', () => {
  const slugs = paths.map((path) => path.params.slug)
  expect(slugs).toContain('default')
  for (const post of posts) {
    expect(slugs).toContain(`blog/${post.id}`)
  }
  expect(slugs).toHaveLength(posts.length + 1)
})

test('each og image route carries its own post frontmatter as props', () => {
  for (const post of posts) {
    const path = paths.find((candidate) => candidate.params.slug === `blog/${post.id}`)
    expect(path?.props).toEqual({
      title: post.data.title,
      description: post.data.description,
      date: post.data.date,
    })
  }
})

test('GET renders the default card as a 1200x630 PNG', async () => {
  const defaultPath = paths.find((path) => path.params.slug === 'default')
  const png = await render(defaultPath?.props as (typeof paths)[number]['props'])
  expect(pngSize(png)).toEqual({width: 1200, height: 630})
})

test('GET renders different routes to different images', async () => {
  const [defaultCard, postCard] = await Promise.all([
    render({title: 'David J Felix', description: 'Default', date: undefined}),
    render({title: 'A Blog Post', description: 'Different', date: new Date(2025, 11, 7)}),
  ])
  expect(defaultCard).not.toEqual(postCard)
})
