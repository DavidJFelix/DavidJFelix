import sharp from 'sharp'
import {expect, test} from 'vitest'
import {renderOgImage} from './image.ts'
import {ogImageSize} from './tags.ts'

test('renderOgImage renders a dated card at the shared OpenGraph size', async () => {
  const png = await renderOgImage({
    title: 'On Running',
    description: 'Thoughts on software, running, and life',
    siteName: 'djf.io',
    author: 'David J Felix',
    date: new Date('2025-12-07T00:00:00.000Z'),
  })
  const metadata = await sharp(png).metadata()
  expect(metadata.format).toBe('png')
  expect(metadata.width).toBe(ogImageSize.width)
  expect(metadata.height).toBe(ogImageSize.height)
})

test('renderOgImage renders an undated card with a long title', async () => {
  const png = await renderOgImage({
    title: 'A title well past fifty characters, long enough to take the smaller font branch',
    description: 'A default card with no date in the footer',
    siteName: 'example.org',
    author: 'Example Author',
  })
  const metadata = await sharp(png).metadata()
  expect(metadata.format).toBe('png')
  expect(metadata.width).toBe(ogImageSize.width)
  expect(metadata.height).toBe(ogImageSize.height)
})

// The endpoints that call this are prerendered, so byte-stable output is what
// lets build caching and snapshot comparisons hold still between runs.
test('renderOgImage is deterministic for identical params', async () => {
  const params = {
    title: 'Stable Bytes',
    description: 'Rendered twice',
    siteName: 'djf.io',
    author: 'David J Felix',
    date: new Date('2026-01-01T00:00:00.000Z'),
  }
  const [first, second] = await Promise.all([renderOgImage(params), renderOgImage(params)])
  expect(first.equals(second)).toBe(true)
})

test('renderOgImage renders params into the pixels, not just a fixed card', async () => {
  const base = {description: 'Same description', siteName: 'djf.io', author: 'David J Felix'}
  const one = await renderOgImage({...base, title: 'First Title'})
  const other = await renderOgImage({...base, title: 'Second Title'})
  expect(one.equals(other)).toBe(false)
})

// Titles flow into satori's SVG as text nodes; markup characters in
// frontmatter must come out as pixels, never as parsed markup or a crash.
test('renderOgImage renders titles containing markup characters', async () => {
  const png = await renderOgImage({
    title: 'Ampersands & <angles> and "quotes"',
    description: `It's fine <b>here</b> & there`,
    siteName: 'djf.io',
    author: 'David J Felix',
  })
  const metadata = await sharp(png).metadata()
  expect(metadata.format).toBe('png')
  expect(metadata.width).toBe(ogImageSize.width)
  expect(metadata.height).toBe(ogImageSize.height)
})
