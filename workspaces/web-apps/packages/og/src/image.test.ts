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
