// The runtime for Vite-bundled Workers (TanStack Start and Astro on the
// Cloudflare Vite plugin, SvelteKit): a `.wasm` import becomes a WebAssembly
// module uploaded with the Worker -- the only form Workers accept, since they
// refuse to compile wasm from bytes at runtime -- and `?inline` folds each
// font file into the bundle as a base64 data URL, so nothing is fetched per
// request. Resolution starts from this file, so the binaries come from this
// package's own tree and no app declares them. The specifiers are declared in
// ./modules.d.ts; consumers get ./vite.d.ts through the exports map instead.
import regular from '@fontsource/inter/files/inter-latin-400-normal.woff?inline'
import bold from '@fontsource/inter/files/inter-latin-700-normal.woff?inline'
import resvg from '@resvg/resvg-wasm/index_bg.wasm'
import yoga from 'satori/yoga.wasm'
import type {OgRuntime} from '../image'
import {fromDataUrl, interFonts} from './fonts'

export const viteRuntime: OgRuntime = {
  yoga,
  resvg,
  fonts: interFonts({regular: fromDataUrl(regular), bold: fromDataUrl(bold)}),
}
