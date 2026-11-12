// The runtime for Workers that Nitro bundles (Nuxt). unwasm's `?module` suffix
// gives the WebAssembly module, behind `nitro.experimental.wasm`; the
// cloudflare presets already import wasm as native modules. Nitro's `raw:`
// prefix puts each font file into the bundle as bytes. Resolution starts from
// this file, so the binary comes from this package's own tree and no app
// declares it. ./modules.d.ts declares these specifiers; consumers get
// ./nitro.d.ts through the exports map instead.

import regular from 'raw:@fontsource/inter/files/inter-latin-400-normal.woff2'
import bold from 'raw:@fontsource/inter/files/inter-latin-700-normal.woff2'
import takumi from '@takumi-rs/wasm/takumi_wasm_bg.wasm?module'
import type {OgRuntime} from '../image'
import {interFonts} from './fonts'

export const nitroRuntime: OgRuntime = {takumi, fonts: interFonts({regular, bold})}
