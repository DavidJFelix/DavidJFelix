// The runtime for Nitro-bundled Workers (Nuxt): unwasm's `?module` suffix
// yields the WebAssembly module (behind `nitro.experimental.wasm`; the
// cloudflare presets already import wasm as native modules) and Nitro's `raw:`
// prefix inlines each font file as bytes. Resolution starts from this file, so
// the binaries come from this package's own tree and no app declares them. The
// specifiers are declared in ./modules.d.ts; consumers get ./nitro.d.ts through
// the exports map instead.

import regular from 'raw:@fontsource/inter/files/inter-latin-400-normal.woff'
import bold from 'raw:@fontsource/inter/files/inter-latin-700-normal.woff'
import resvg from '@resvg/resvg-wasm/index_bg.wasm?module'
import yoga from 'satori/yoga.wasm?module'
import type {OgRuntime} from '../image'
import {interFonts} from './fonts'

export const nitroRuntime: OgRuntime = {yoga, resvg, fonts: interFonts({regular, bold})}
