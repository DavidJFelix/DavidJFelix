import {expect, test} from 'vitest'
import {createOgRenderer} from '../image'
import {pngSize} from '../png'
import {ogImageSize} from '../tags'
import {viteRuntime} from './vite'

// vitest.config.ts stands in for the bundler: the `.wasm` import arrives as
// a compiled module and the `?inline` fonts as data URLs, the shapes the
// Cloudflare Vite plugin and Vite hand a Worker bundle.
test('the Vite runtime carries a compiled wasm module and decoded Inter fonts', () => {
  expect(viteRuntime.takumi).toBeInstanceOf(WebAssembly.Module)
  expect(viteRuntime.fonts.map((font) => font.weight)).toEqual([400, 700])
  for (const font of viteRuntime.fonts) {
    expect(font.data.byteLength).toBeGreaterThan(10_000)
  }
})

test('a card renders through the Vite runtime', async () => {
  const png = await createOgRenderer(viteRuntime)({
    title: 'startchi.com',
    description: 'A directory.',
    siteName: 'startchi.com',
  })
  expect(pngSize(png)).toEqual(ogImageSize)
})
