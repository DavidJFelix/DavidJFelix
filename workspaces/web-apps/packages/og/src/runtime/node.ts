// The Node runtime, for djf.io's prerendered endpoint and this package's tests.
// Node compiles wasm from bytes, so this runtime reads the binary and the fonts
// from the installed packages. Resolution starts from this file, so under bun's
// isolated linker they come from this package's own tree. A Vite SSR build that
// externalizes them is the exception: the emitted chunk resolves them from the
// app's tree, so the app declares them itself (djf.io does).
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import type {OgRuntime} from '../image'
import {interFonts} from './fonts'

const require = createRequire(import.meta.url)
const read = (specifier: string): Promise<Buffer> => readFile(require.resolve(specifier))

export const nodeRuntime = async (): Promise<OgRuntime> => {
  const [takumi, regular, bold] = await Promise.all([
    read('@takumi-rs/wasm/takumi_wasm_bg.wasm'),
    read('@fontsource/inter/files/inter-latin-400-normal.woff2'),
    read('@fontsource/inter/files/inter-latin-700-normal.woff2'),
  ])
  return {takumi, fonts: interFonts({regular, bold})}
}
