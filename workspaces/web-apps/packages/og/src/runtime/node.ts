// The Node runtime: djf.io's prerendered endpoint and this package's tests.
// Node compiles wasm from bytes, so the binaries and fonts are simply read
// from the installed packages. Resolution starts from this file, so under
// bun's isolated linker they come from this package's own tree -- except when
// a Vite SSR build externalizes them, where the emitted chunk resolves from
// the app's tree instead and the app declares them itself (djf.io does).
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import type {OgRuntime} from '../image'
import {interFonts} from './fonts'

const require = createRequire(import.meta.url)
const read = (specifier: string): Promise<Buffer> => readFile(require.resolve(specifier))

export const nodeRuntime = async (): Promise<OgRuntime> => {
  const [yoga, resvg, regular, bold] = await Promise.all([
    read('satori/yoga.wasm'),
    read('@resvg/resvg-wasm/index_bg.wasm'),
    read('@fontsource/inter/files/inter-latin-400-normal.woff'),
    read('@fontsource/inter/files/inter-latin-700-normal.woff'),
  ])
  return {yoga, resvg, fonts: interFonts({regular, bold})}
}
