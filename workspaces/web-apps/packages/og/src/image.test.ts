import {expect, test} from 'vitest'
import {createOgRenderer} from './image'
import {pngSize} from './png'
import {nodeRuntime} from './runtime/node'
import {ogImageSize} from './tags'

const render = createOgRenderer(await nodeRuntime())

test('renders a dated card at the shared OpenGraph size', async () => {
  const png = await render({
    title: 'On Running',
    description: 'Thoughts on software, running, and life',
    siteName: 'djf.io',
    author: 'David J Felix',
    date: new Date('2025-12-07T00:00:00.000Z'),
  })
  expect(pngSize(png)).toEqual(ogImageSize)
})

test('renders an undated card without an author and with a long title', async () => {
  const png = await render({
    title: 'A title well past fifty characters, long enough to take the smaller font branch',
    description: 'A default card with an empty footer',
    siteName: 'example.org',
  })
  expect(pngSize(png)).toEqual(ogImageSize)
})

// djf.io's endpoint is prerendered, so byte-stable output is what lets build
// caching and snapshot comparisons hold still between runs.
test('is deterministic for identical params', async () => {
  const params = {
    title: 'Stable Bytes',
    description: 'Rendered twice',
    siteName: 'djf.io',
    author: 'David J Felix',
    date: new Date('2026-01-01T00:00:00.000Z'),
  }
  const [first, second] = await Promise.all([render(params), render(params)])
  expect(first).toEqual(second)
})

test('renders params into the pixels, not just a fixed card', async () => {
  const base = {description: 'Same description', siteName: 'djf.io', author: 'David J Felix'}
  const one = await render({...base, title: 'First Title'})
  const other = await render({...base, title: 'Second Title'})
  expect(one).not.toEqual(other)
})

// Titles flow into satori's SVG as text nodes; markup characters in
// frontmatter must come out as pixels, never as parsed markup or a crash.
test('renders titles containing markup characters', async () => {
  const png = await render({
    title: 'Ampersands & <angles> and "quotes"',
    description: `It's fine <b>here</b> & there`,
    siteName: 'djf.io',
    author: 'David J Felix',
  })
  expect(pngSize(png)).toEqual(ogImageSize)
})

test('paints the theme into the pixels, with a foreground-to-muted bar when no accent is set', async () => {
  const card = {title: 'forzamonica art', description: 'Watercolors', siteName: 'forzamonica.com'}
  const paper = await render({
    ...card,
    theme: {background: '#f7f9fa', foreground: '#1e2a3a', muted: '#5b6a7c'},
  })
  const zinc = await render(card)
  expect(pngSize(paper)).toEqual(ogImageSize)
  expect(paper).not.toEqual(zinc)
})

// resvg refuses a second initWasm, so the engines are initialized once per
// process no matter how many renderers hand in a runtime.
test('a second renderer shares the initialized engines', async () => {
  const other = createOgRenderer(await nodeRuntime())
  const png = await other({title: 'Again', description: 'Second renderer', siteName: 'djf.io'})
  expect(pngSize(png)).toEqual(ogImageSize)
})
