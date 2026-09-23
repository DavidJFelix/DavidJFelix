import {expect, test} from 'vitest'
import {createOgRenderer} from '../image'
import {pngSize} from '../png'
import {ogImageSize} from '../tags'
import {nitroRuntime} from './nitro'

// vitest.config.ts stands in for the bundler: the `?module` imports arrive as
// compiled modules and the `raw:` fonts as bytes, the shapes unwasm and Nitro
// hand a Worker bundle.
test('the Nitro runtime carries compiled wasm modules and Inter fonts', () => {
  expect(nitroRuntime.yoga).toBeInstanceOf(WebAssembly.Module)
  expect(nitroRuntime.resvg).toBeInstanceOf(WebAssembly.Module)
  expect(nitroRuntime.fonts.map((font) => font.weight)).toEqual([400, 700])
  for (const font of nitroRuntime.fonts) {
    expect(font.data.byteLength).toBeGreaterThan(10_000)
  }
})

test('a card renders through the Nitro runtime', async () => {
  const png = await createOgRenderer(nitroRuntime)({
    title: 'pkg.dog',
    description: 'Only the parts you use.',
    siteName: 'pkg.dog',
  })
  expect(pngSize(png)).toEqual(ogImageSize)
})
