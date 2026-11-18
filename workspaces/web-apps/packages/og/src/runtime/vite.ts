// The runtime for Workers that Vite bundles: TanStack Start and Astro on the
// Cloudflare Vite plugin, and SvelteKit. A `.wasm` import becomes a
// WebAssembly module that uploads with the Worker. Workers accept only this
// form, because they do not compile wasm from bytes at runtime. `?inline` puts
// each font file into the bundle as a base64 data URL, so no request fetches a
// file. Resolution starts from this file, so the binary comes from this
// package's own tree and no app declares it. ./modules.d.ts declares these
// specifiers; consumers get ./vite.d.ts through the exports map instead.
import regular from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline'
import bold from '@fontsource/inter/files/inter-latin-700-normal.woff2?inline'
import takumi from '@takumi-rs/wasm/takumi_wasm_bg.wasm'
import type {OgRuntime} from '../image'
import {fromDataUrl, interFonts} from './fonts'

export const viteRuntime: OgRuntime = {
  takumi,
  fonts: interFonts({regular: fromDataUrl(regular), bold: fromDataUrl(bold)}),
}
