import {mkdir, readFile, writeFile} from 'node:fs/promises'
import type {MeasuredNode} from '@takumi-rs/wasm'
import initTakumi, {Renderer} from '@takumi-rs/wasm'
import {expect, test} from 'vitest'
import type {OgImageParams} from './image'
import {createOgRenderer, ogCardNode} from './image'
import {pngSize} from './png'
import {nodeRuntime} from './runtime/node'
import {ogImageSize} from './tags'

const runtime = await nodeRuntime()
const render = createOgRenderer(runtime)

// The tests' own Takumi renderer decodes PNGs to pixels and measures layouts.
// It shares the wasm instance with the card renderer, because a second init
// returns the instance that is already there.
await initTakumi({module_or_path: runtime.takumi})
const inspector = new Renderer()
await Promise.all(runtime.fonts.map((font) => inspector.registerFont(font)))

const dated: OgImageParams = {
  title: 'On Running',
  description: 'Thoughts on software, running, and life',
  siteName: 'djf.io',
  author: 'David J Felix',
  date: new Date('2025-12-07T00:00:00.000Z'),
}

const longTitle: OgImageParams = {
  title: 'A title well past fifty characters, long enough to take the smaller font branch',
  description: 'A default card with an empty footer',
  siteName: 'example.org',
}

// forzamonica.com's light paper theme, without an accent.
const paper: OgImageParams = {
  title: 'forzamonica art',
  description: 'Watercolors',
  siteName: 'forzamonica.com',
  theme: {background: '#f7f9fa', foreground: '#1e2a3a', muted: '#5b6a7c'},
}

const pixels = (png: Uint8Array): Promise<Uint8Array> =>
  inspector.render({type: 'image', src: png, ...ogImageSize}, {...ogImageSize, format: 'raw'})

// A pixel counts as changed when any RGBA channel moves by more than this.
const CHANNEL_TOLERANCE = 32

const changedShare = (actual: Uint8Array, expected: Uint8Array): number => {
  let changed = 0
  for (let index = 0; index < actual.length; index += 4) {
    const channels = [0, 1, 2, 3].map((channel) => index + channel)
    if (channels.some((at) => Math.abs(actual[at] - expected[at]) > CHANNEL_TOLERANCE)) {
      changed += 1
    }
  }
  return changed / (actual.length / 4)
}

// The same allowance as the apps' Playwright screenshots.
const MAX_CHANGED_SHARE = 0.01

const SNAPSHOTS = new URL('./image.test.ts-snapshots/', import.meta.url)

// The tolerances above let a Takumi update that moves antialiasing pass, and
// fail a change to the look of the card. The PNGs update by Vitest's rules:
// `vitest -u` writes them all, and a local run writes a missing one. In CI, a
// missing PNG fails the test.
const expectCardSnapshot = async (png: Uint8Array, name: string): Promise<void> => {
  const file = new URL(`${name}.png`, SNAPSHOTS)
  const update = expect.getState().snapshotState.snapshotUpdateState
  const committed = await readFile(file).catch(() => undefined)
  if (update === 'all' || (committed === undefined && update === 'new')) {
    await mkdir(SNAPSHOTS, {recursive: true})
    await writeFile(file, png)
    return
  }
  expect(committed, `${name}.png is missing; run vitest -u to write it`).toBeDefined()
  const share = changedShare(await pixels(png), await pixels(committed ?? png))
  expect(
    share,
    `${name}.png: ${(share * 100).toFixed(2)}% of the pixels changed`,
  ).toBeLessThanOrEqual(MAX_CHANGED_SHARE)
}

test.each([
  ['dated', dated],
  ['long-title', longTitle],
  ['paper', paper],
])('the %s card matches its snapshot at the shared OpenGraph size', async (name, params) => {
  const png = await render(params)
  expect(pngSize(png)).toEqual(ogImageSize)
  await expectCardSnapshot(png, name)
})

test('the pixel comparison flags a card drawn in another theme', async () => {
  const changed = await render({...dated, theme: paper.theme})
  expect(changedShare(await pixels(changed), await pixels(await render(dated)))).toBeGreaterThan(
    MAX_CHANGED_SHARE,
  )
})

interface TextLine {
  text: string
  x: number
  y: number
  width: number
  height: number
}

// Takumi gives each node an absolute transform on the card and each line a
// position inside its node, so a line's card position is the sum of the two.
const textLines = ({transform, runs, children}: MeasuredNode): Array<TextLine> => [
  ...runs.map((run) => ({...run, x: transform[4] + run.x, y: transform[5] + run.y})),
  ...children.flatMap(textLines),
]

const measure = async (params: OgImageParams): Promise<Array<TextLine>> =>
  textLines(await inspector.measure(ogCardNode(params), ogImageSize))

// A line box uses the ascent and descent of the font, which go a fraction of
// a pixel past the node box, so the tests compare edges in whole pixels.
const right = (line?: TextLine) => Math.round((line?.x ?? 0) + (line?.width ?? 0))
const bottom = (line?: TextLine) => Math.round((line?.y ?? 0) + (line?.height ?? 0))

const PADDING = 64
const BAR_HEIGHT = 12

test('every line stays inside the padding, with the footer on its bottom edge', async () => {
  const lines = await measure(dated)
  for (const line of lines) {
    expect(line.x).toBeGreaterThanOrEqual(PADDING)
    expect(right(line)).toBeLessThanOrEqual(ogImageSize.width - PADDING)
    expect(bottom(line)).toBeLessThanOrEqual(ogImageSize.height - PADDING)
  }
  const [badge, , , author, date] = lines
  expect(badge).toMatchObject({text: 'djf.io', x: PADDING, y: BAR_HEIGHT + PADDING})
  expect(author).toMatchObject({text: 'David J Felix', x: PADDING, y: date?.y})
  expect(right(date)).toBe(ogImageSize.width - PADDING)
  expect(bottom(author)).toBe(ogImageSize.height - PADDING)
})

test('a title past fifty characters drops to the smaller size and wraps to two lines', async () => {
  const short = await measure(dated)
  const long = await measure(longTitle)
  const titleLines = long.filter((line) => longTitle.title.includes(line.text))
  expect(titleLines.map((line) => line.text).join(' ')).toBe(longTitle.title)
  expect(titleLines).toHaveLength(2)
  expect(titleLines[0]?.height).toBeLessThan(short[1]?.height ?? 0)
})

// Each field goes to Takumi as a text node, which it draws as it is. Markup in
// frontmatter or in a pull request title shows as characters, not as parsed
// markup or a crash.
test('markup characters in every field come out as the same characters', async () => {
  const params = {
    title: '<b>Bold</b> & "quoted"',
    description: `It's fine <b>here</b> & there`,
    siteName: '<site>',
    author: '<img src=x onerror=alert(1)>',
    date: new Date('2026-01-01T00:00:00.000Z'),
  }
  const lines = await measure(params)
  expect(lines.map((line) => line.text)).toEqual([
    params.siteName,
    params.title,
    params.description,
    params.author,
    'January 1, 2026',
  ])
  expect(pngSize(await render(params))).toEqual(ogImageSize)
})

// djf.io's endpoint is prerendered, so byte-stable output is what lets build
// caching and snapshot comparisons hold still between runs.
test('is deterministic for identical params', async () => {
  const [first, second] = await Promise.all([render(dated), render(dated)])
  expect(first).toEqual(second)
})

test('renders params into the pixels, not just a fixed card', async () => {
  const base = {description: 'Same description', siteName: 'djf.io', author: 'David J Felix'}
  const one = await render({...base, title: 'First Title'})
  const other = await render({...base, title: 'Second Title'})
  expect(one).not.toEqual(other)
})

// The first card renderer sets up the wasm module and the Takumi renderer once
// per process. A second card renderer uses them again, whatever runtime it gets.
test('a second renderer shares the initialized engine', async () => {
  const other = createOgRenderer(await nodeRuntime())
  const png = await other({title: 'Again', description: 'Second renderer', siteName: 'djf.io'})
  expect(pngSize(png)).toEqual(ogImageSize)
})
